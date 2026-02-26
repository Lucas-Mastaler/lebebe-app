import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// POST /api/recebimento/importar-xml — upload and parse NFe XML files
export async function POST(request: NextRequest) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const formData = await request.formData()
  const files = formData.getAll('xml') as File[]

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'Nenhum arquivo XML enviado' }, { status: 400 })
  }

  const supabase = await createClient()
  const results: Array<{ file: string; status: string; numero_nf?: string; error?: string }> = []

  for (const file of files) {
    const fileName = file.name
    try {
      const xmlText = await file.text()
      const parsed = parseNFeXML(xmlText)

      if (!parsed) {
        results.push({ file: fileName, status: 'erro', error: 'XML inválido ou não é NFe' })
        continue
      }

      console.log(`[LOG] Processando XML: ${fileName} - NF ${parsed.numero_nf}`)

      // Normalize numero_nf (only digits)
      const numeroNfNorm = parsed.numero_nf.replace(/\D/g, '')

      // Upsert NFe (idempotent)
      const { data: nfe, error: nfeError } = await supabase
        .from('nfe')
        .upsert(
          {
            numero_nf: numeroNfNorm,
            data_emissao: parsed.data_emissao,
            peso_total: parsed.peso_total,
            volumes_total: parsed.volumes_total,
            is_os: parsed.is_os,
          },
          { onConflict: 'numero_nf' }
        )
        .select()
        .single()

      if (nfeError) {
        console.error(`[LOG] Erro ao inserir NF ${numeroNfNorm}:`, nfeError)
        results.push({ file: fileName, status: 'erro', numero_nf: numeroNfNorm, error: nfeError.message })
        continue
      }

      // Delete existing items to re-import (idempotent)
      await supabase
        .from('nfe_itens')
        .delete()
        .eq('nfe_id', nfe.id)

      // Insert items
      for (const item of parsed.itens) {
        // Look up matic_sku for volumes_por_item
        const { data: sku } = await supabase
          .from('matic_sku')
          .select('volumes_por_item')
          .eq('codigo_produto', item.codigo_produto)
          .single()

        const volumesPorItem = sku?.volumes_por_item || 1
        const volumesPrevistosTotal = item.quantidade * volumesPorItem

        const { error: itemError } = await supabase
          .from('nfe_itens')
          .insert({
            nfe_id: nfe.id,
            codigo_produto: item.codigo_produto,
            descricao: item.descricao,
            quantidade: item.quantidade,
            volumes_por_item: volumesPorItem,
            volumes_previstos_total: volumesPrevistosTotal,
            status: 'pendente',
          })

        if (itemError) {
          console.error(`[LOG] Erro ao inserir item ${item.codigo_produto}:`, itemError)
        }
      }

      // Insert assistencias (OS/OC) if found
      if (parsed.assistencias.length > 0) {
        await supabase
          .from('nfe_assistencias')
          .delete()
          .eq('nfe_id', nfe.id)

        for (const os of parsed.assistencias) {
          await supabase
            .from('nfe_assistencias')
            .insert({
              nfe_id: nfe.id,
              os_oc_numero: os,
            })
        }
      }

      console.log(`[LOG] NF ${numeroNfNorm} importada: ${parsed.itens.length} itens, ${parsed.assistencias.length} OS/OC`)
      results.push({ file: fileName, status: 'ok', numero_nf: numeroNfNorm })
    } catch (err) {
      console.error(`[LOG] Erro ao processar ${fileName}:`, err)
      results.push({ file: fileName, status: 'erro', error: String(err) })
    }
  }

  return NextResponse.json({ results })
}

// =========================================================
// XML Parser (simple regex-based for NFe XML)
// =========================================================

interface ParsedNFe {
  numero_nf: string
  data_emissao: string
  peso_total: number
  volumes_total: number
  is_os: boolean
  itens: Array<{
    codigo_produto: string
    descricao: string
    quantidade: number
  }>
  assistencias: string[]
}

function parseNFeXML(xml: string): ParsedNFe | null {
  try {
    // Extract nNF
    const nNF = extractTag(xml, 'nNF')
    if (!nNF) return null

    // Extract dhEmi
    const dhEmi = extractTag(xml, 'dhEmi') || extractTag(xml, 'dEmi') || ''
    const dataEmissao = dhEmi.substring(0, 10) // YYYY-MM-DD

    // Extract volumes info
    const pesoL = parseFloat(extractTag(xml, 'pesoL') || '0')
    const qVol = parseInt(extractTag(xml, 'qVol') || '0')

    // Extract products (det blocks)
    const itens: ParsedNFe['itens'] = []
    const detRegex = /<det[^>]*>[\s\S]*?<\/det>/g
    let detMatch
    while ((detMatch = detRegex.exec(xml)) !== null) {
      const det = detMatch[0]
      const cProd = extractTag(det, 'cProd') || ''
      const xProd = extractTag(det, 'xProd') || ''
      const qCom = parseFloat(extractTag(det, 'qCom') || '0')

      if (cProd) {
        itens.push({
          codigo_produto: cProd,
          descricao: xProd,
          quantidade: Math.round(qCom),
        })
      }
    }

    // Detect OS/OC in infCpl
    const infCpl = extractTag(xml, 'infCpl') || ''
    const assistencias: string[] = []
    const osRegex = /(?:OS|OC|O\.S\.|O\.C\.)\s*[:\-]?\s*(\d+)/gi
    let osMatch
    while ((osMatch = osRegex.exec(infCpl)) !== null) {
      assistencias.push(osMatch[1])
    }

    const isOs = assistencias.length > 0

    return {
      numero_nf: nNF,
      data_emissao: dataEmissao,
      peso_total: pesoL,
      volumes_total: qVol,
      is_os: isOs,
      itens,
      assistencias,
    }
  } catch (err) {
    console.error('[LOG] Erro ao parsear XML:', err)
    return null
  }
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`)
  const match = regex.exec(xml)
  return match ? match[1].trim() : null
}
