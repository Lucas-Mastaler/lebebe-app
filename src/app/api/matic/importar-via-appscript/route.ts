import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// POST /api/matic/importar-via-appscript
export async function POST(request: NextRequest) {
  // 1) Validate matic user
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  // 2) Parse body
  let body: { inicio?: string; fim?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  const { inicio, fim } = body
  if (!inicio || !fim) {
    return NextResponse.json({ ok: false, error: 'inicio e fim são obrigatórios' }, { status: 400 })
  }

  // Validate dates
  const dInicio = new Date(inicio + 'T00:00:00')
  const dFim = new Date(fim + 'T23:59:59')

  if (isNaN(dInicio.getTime()) || isNaN(dFim.getTime())) {
    return NextResponse.json({ ok: false, error: 'Datas inválidas' }, { status: 400 })
  }

  if (dInicio > dFim) {
    return NextResponse.json({ ok: false, error: 'inicio deve ser <= fim' }, { status: 400 })
  }

  const diffDays = (dFim.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays > 90) {
    return NextResponse.json({ ok: false, error: 'Janela máxima de 90 dias' }, { status: 400 })
  }

  // 3) Call Apps Script Web App
  const appscriptUrl = process.env.APPSCRIPT_IMPORT_URL
  const appscriptToken = process.env.APPSCRIPT_IMPORT_TOKEN

  if (!appscriptUrl || !appscriptToken) {
    console.error('[LOG] APPSCRIPT_IMPORT_URL ou APPSCRIPT_IMPORT_TOKEN não configurados')
    return NextResponse.json({ ok: false, error: 'Configuração do Apps Script ausente no servidor' }, { status: 500 })
  }

  console.log(`[LOG] Chamando Apps Script: ${inicio} a ${fim}`)

  let appscriptData: AppScriptResponse
  try {
    const res = await fetch(appscriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: appscriptToken, inicio, fim }),
    })

    const text = await res.text()
    try {
      appscriptData = JSON.parse(text)
    } catch {
      console.error('[LOG] Resposta do Apps Script não é JSON:', text.substring(0, 500))
      return NextResponse.json({ ok: false, error: 'Resposta inválida do Apps Script' }, { status: 502 })
    }

    if (!appscriptData.ok) {
      console.error('[LOG] Apps Script retornou erro:', appscriptData.error)
      return NextResponse.json({ ok: false, error: appscriptData.error || 'Erro no Apps Script' }, { status: 502 })
    }
  } catch (err) {
    console.error('[LOG] Erro ao chamar Apps Script:', err)
    return NextResponse.json({ ok: false, error: 'Falha ao conectar com Apps Script' }, { status: 502 })
  }

  console.log(`[LOG] Apps Script retornou ${appscriptData.nfs?.length || 0} NFs`)

  // 4) Upsert into Supabase
  const supabase = await createClient()
  const nfsImportadas: string[] = []
  const nfsAtualizadas: string[] = []
  const skusSemCadastro: string[] = []
  const erros: Array<{ etapa: string; message: string }> = []
  let itensTotal = 0

  for (const nf of (appscriptData.nfs || [])) {
    const numeroNfNorm = nf.numero_nf.replace(/\D/g, '')

    try {
      // Check if NF already exists
      const { data: existing } = await supabase
        .from('nfe')
        .select('id')
        .eq('numero_nf', numeroNfNorm)
        .single()

      const isNew = !existing

      // Upsert NFe
      const { data: nfeRow, error: nfeError } = await supabase
        .from('nfe')
        .upsert(
          {
            numero_nf: numeroNfNorm,
            data_emissao: nf.data_emissao,
            peso_total: nf.peso_total,
            volumes_total: nf.volumes_total,
            is_os: nf.is_os,
          },
          { onConflict: 'numero_nf' }
        )
        .select()
        .single()

      if (nfeError || !nfeRow) {
        console.error(`[LOG] Erro upsert NF ${numeroNfNorm}:`, nfeError)
        erros.push({ etapa: 'upsert_nfe', message: `NF ${numeroNfNorm}: ${nfeError?.message}` })
        continue
      }

      if (isNew) {
        nfsImportadas.push(numeroNfNorm)
      } else {
        nfsAtualizadas.push(numeroNfNorm)
      }

      // Upsert itens
      for (const item of nf.itens) {
        itensTotal++

        // Lookup matic_sku
        const codigoProduto = item.codigo_produto.replace(/^0+/, '') || item.codigo_produto
        const { data: sku } = await supabase
          .from('matic_sku')
          .select('volumes_por_item, corredor_sugerido, nivel_sugerido')
          .eq('codigo_produto', codigoProduto)
          .single()

        const volumesPorItem = sku?.volumes_por_item || 1
        const volumesPrevistosTotal = item.quantidade * volumesPorItem

        if (!sku && !skusSemCadastro.includes(codigoProduto)) {
          skusSemCadastro.push(codigoProduto)
        }

        // Upsert nfe_itens using (nfe_id, n_item) unique
        const { error: itemError } = await supabase
          .from('nfe_itens')
          .upsert(
            {
              nfe_id: nfeRow.id,
              n_item: item.nItem,
              codigo_produto: codigoProduto,
              descricao: item.descricao,
              quantidade: item.quantidade,
              volumes_por_item: volumesPorItem,
              volumes_previstos_total: volumesPrevistosTotal,
              corredor_sugerido: sku?.corredor_sugerido || null,
              nivel_sugerido: sku?.nivel_sugerido || null,
              status: 'pendente',
            },
            { onConflict: 'nfe_id,n_item', ignoreDuplicates: false }
          )

        if (itemError) {
          console.error(`[LOG] Erro upsert item ${codigoProduto} NF ${numeroNfNorm}:`, itemError)
          erros.push({ etapa: 'upsert_item', message: `Item ${codigoProduto} NF ${numeroNfNorm}: ${itemError.message}` })
        }
      }

      // Upsert nfe_assistencias (OS/OC dedupe)
      if (nf.os_oc && nf.os_oc.length > 0) {
        for (const os of nf.os_oc) {
          const { error: osError } = await supabase
            .from('nfe_assistencias')
            .upsert(
              {
                nfe_id: nfeRow.id,
                os_oc_numero: os,
              },
              { onConflict: 'nfe_id,os_oc_numero', ignoreDuplicates: true }
            )

          if (osError) {
            console.error(`[LOG] Erro upsert OS ${os} NF ${numeroNfNorm}:`, osError)
          }
        }
      }

      console.log(`[LOG] NF ${numeroNfNorm}: ${nf.itens.length} itens, ${nf.os_oc?.length || 0} OS/OC`)
    } catch (err) {
      console.error(`[LOG] Erro processando NF ${numeroNfNorm}:`, err)
      erros.push({ etapa: 'process_nf', message: `NF ${numeroNfNorm}: ${String(err)}` })
    }
  }

  console.log(`[LOG] Importação concluída: ${nfsImportadas.length} novas, ${nfsAtualizadas.length} atualizadas, ${itensTotal} itens`)

  return NextResponse.json({
    ok: true,
    query: appscriptData.query || '',
    nfs_total: (appscriptData.nfs || []).length,
    nfs_importadas: nfsImportadas,
    nfs_atualizadas: nfsAtualizadas,
    itens_total: itensTotal,
    skus_sem_cadastro: skusSemCadastro,
    erros: [...(appscriptData.erros || []), ...erros],
  })
}

// =========================================================
// Types for Apps Script response
// =========================================================
interface AppScriptResponse {
  ok: boolean
  error?: string
  query?: string
  inicio?: string
  fim?: string
  nfs?: Array<{
    numero_nf: string
    data_emissao: string
    peso_total: number
    volumes_total: number
    is_os: boolean
    os_oc: string[]
    itens: Array<{
      nItem: number
      codigo_produto: string
      descricao: string
      quantidade: number
    }>
  }>
  erros?: Array<{ etapa: string; message: string; emailMessageId?: string }>
}
