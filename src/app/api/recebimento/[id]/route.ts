import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { isDescricaoVolumeAvulso } from '@/lib/recebimento/volume-avulso'

// Helper: remove leading zeros and trim spaces for matching (02685 -> 2685)
function normalizeCode(code: string): string {
  if (!code) return '0'
  return code.trim().replace(/^0+/, '') || '0'
}

// GET /api/recebimento/[id] — get full recebimento detail with items and volumes
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  // Fetch recebimento
  const { data: recebimento, error: recError } = await supabase
    .from('recebimentos')
    .select('*')
    .eq('id', id)
    .single()

  if (recError || !recebimento) {
    return NextResponse.json({ error: 'Recebimento não encontrado' }, { status: 404 })
  }

  // Fetch linked NFes with assistencias
  const { data: nfeLinks } = await supabase
    .from('recebimento_nfes')
    .select(`
      nfe_id, 
      nfe:nfe_id ( 
        numero_nf, 
        data_emissao, 
        peso_total, 
        volumes_total,
        obs,
        is_os,
        nfe_assistencias ( id, os_oc_numero )
      )
    `)
    .eq('recebimento_id', id)

  // Fetch recebimento items with NF item data and volumes
  const { data: itens, error: itensError } = await supabase
    .from('recebimento_itens')
    .select(`
      id,
      nfe_item_id,
      volumes_previstos_total,
      volumes_recebidos_total,
      volumes_por_item,
      corredor_final,
      nivel_final,
      prateleira_final,
      divergencia_tipo,
      divergencia_obs,
      avaria_foto_url,
      refs_display,
      nfe_item:nfe_item_id (
        codigo_produto,
        descricao,
        quantidade,
        volumes_por_item
      ),
      recebimento_item_volumes (
        id,
        volume_numero,
        qtd_prevista,
        qtd_recebida
      )
    `)
    .eq('recebimento_id', id)

  if (itensError) {
    console.error('[LOG] Erro ao buscar itens:', itensError)
    return NextResponse.json({ error: itensError.message }, { status: 500 })
  }

  // Fetch all matic_sku info (match ref_meia or ref_inteira with NF codigo_produto)
  // Normalize codes: remove leading zeros (02685 -> 2685)
  const { data: allSkus } = await supabase
    .from('matic_sku')
    .select('codigo_produto, ref_meia, ref_inteira, descricao, corredor_sugerido, nivel_sugerido, prateleira_sugerida, volumes_por_item')

  // Build map: normalized code -> SKU data
  // For each SKU, add entries for both ref_meia and ref_inteira (if present)
  const skuMap = new Map<string, { codigo_produto: string; descricao: string; ref_meia: string | null; ref_inteira: string | null; corredor_sugerido: string | null; nivel_sugerido: string | null; prateleira_sugerida: string | null; volumes_por_item: number }>()
  if (allSkus) {
    for (const sku of allSkus) {
      // Add entry for ref_meia (if present)
      if (sku.ref_meia) {
        const normalizedRefMeia = normalizeCode(sku.ref_meia)
        if (normalizedRefMeia && !skuMap.has(normalizedRefMeia)) {
          skuMap.set(normalizedRefMeia, sku)
        }
      }
      
      // Add entry for ref_inteira (if present and not already mapped)
      if (sku.ref_inteira) {
        const normalizedRefInteira = normalizeCode(sku.ref_inteira)
        if (normalizedRefInteira && !skuMap.has(normalizedRefInteira)) {
          skuMap.set(normalizedRefInteira, sku)
        }
      }
    }
  }

  // Separate OS NFes from normal ones
  const nfesOS = (nfeLinks || []).filter((link: Record<string, unknown>) => {
    const nfe = link.nfe as { is_os?: boolean } | null
    return nfe?.is_os
  })
  const nfeOSIds = new Set(nfesOS.map((link: Record<string, unknown>) => link.nfe_id))
  
  // Fetch nfe_itens for the items referenced in recebimento_itens
  // (used to identify which items belong to OS NFes)
  const itemNfeItemIds = (itens || []).map((item: Record<string, unknown>) => item.nfe_item_id).filter(Boolean)
  const { data: nfeItemsData } = await supabase
    .from('nfe_itens')
    .select('id, nfe_id, nfe:nfe_id(numero_nf)')
    .in('id', itemNfeItemIds)
    .limit(10000)
  
  const nfeItemToNfeMap = new Map((nfeItemsData || []).map(ni => [ni.id, ni.nfe_id]))
  const nfeItemToNumeroMap = new Map((nfeItemsData || []).map(ni => {
    const nfeArray = ni.nfe as { numero_nf: string }[] | { numero_nf: string } | null
    const nfe = Array.isArray(nfeArray) ? nfeArray[0] : nfeArray
    return [ni.id, nfe?.numero_nf || '']
  }))
  
  // Build nfeId -> numero_nf map from ALL linked NFes (nfeLinks already has this data)
  // This ensures ALL NFes are resolvable, not just those stored as item references
  const nfeIdToNumeroMap = new Map<string, string>()
  for (const nfeLink of (nfeLinks || [])) {
    const nfe = nfeLink.nfe as { numero_nf?: string } | null
    if (nfe?.numero_nf && nfeLink.nfe_id) {
      nfeIdToNumeroMap.set(nfeLink.nfe_id as string, nfe.numero_nf)
    }
  }

  // Fetch ALL nfe_itens for ALL NFes linked to this recebimento
  // (needed to correctly build nf_sources for grouped items spanning multiple NFes)
  const allLinkedNfeIds = (nfeLinks || []).map((l: Record<string, unknown>) => l.nfe_id as string).filter(Boolean)
  const { data: allNfeItemsForRecebimento } = await supabase
    .from('nfe_itens')
    .select('id, nfe_id, codigo_produto, descricao, quantidade, volumes_por_item')
    .in('nfe_id', allLinkedNfeIds)
    .limit(10000)

  // Build: codigo_produto -> [nfe_ids] from ALL linked items
  const codigoProdutoToNfeIds = new Map<string, string[]>()
  for (const ni of (allNfeItemsForRecebimento || [])) {
    const existing = codigoProdutoToNfeIds.get(ni.codigo_produto) || []
    if (!existing.includes(ni.nfe_id)) existing.push(ni.nfe_id)
    codigoProdutoToNfeIds.set(ni.codigo_produto, existing)
  }
  
  // Mark items from OS NFes
  const itensOSIds = new Set<string>()
  for (const item of (itens || [])) {
    const nfeItemId = item.nfe_item_id as string
    const nfeId = nfeItemToNfeMap.get(nfeItemId)
    if (nfeId && nfeOSIds.has(nfeId)) {
      itensOSIds.add(item.id as string)
    }
  }

  // Mark items de volume avulso: ref bate com produto cadastrado, mas a
  // descrição da própria linha da NFe indica "VOLUME" — não é o produto
  // completo (ver POST /api/recebimento, mesma regra). Cobre também
  // recebimento_itens já gravados no banco ANTES desta regra existir (ex.:
  // recebimento 33, produto 00061714) — sem isso, a linha ficaria
  // duplicada: uma vez aqui (errado) e outra na síntese de OS abaixo.
  const itensVolumeAvulsoIds = new Set<string>()
  for (const item of (itens || [])) {
    const nfeItem = item.nfe_item as { codigo_produto?: string; descricao?: string } | null
    if (!nfeItem?.codigo_produto) continue
    const sku = skuMap.get(normalizeCode(nfeItem.codigo_produto))
    if (sku && isDescricaoVolumeAvulso(nfeItem.descricao)) {
      itensVolumeAvulsoIds.add(item.id as string)
    }
  }

  // Enrich normal items (NOT from OS, NOT volume avulso)
  const enrichedItens = (itens || [])
    .filter((item: Record<string, unknown>) => !itensOSIds.has(item.id as string) && !itensVolumeAvulsoIds.has(item.id as string))
    .map((item: Record<string, unknown>) => {
      const nfeItem = item.nfe_item as { codigo_produto: string; descricao: string; quantidade: number; volumes_por_item: number } | null
      const sku = nfeItem ? skuMap.get(normalizeCode(nfeItem.codigo_produto)) : null
      const volumes = (item.recebimento_item_volumes as Array<{ id: string; volume_numero: number; qtd_prevista: number; qtd_recebida: number }>) || []

      volumes.sort((a, b) => a.volume_numero - b.volume_numero)

      const totalPrevisto = item.volumes_previstos_total as number
      const totalRecebido = item.volumes_recebidos_total as number
      let status = 'pendente'
      if (totalRecebido > 0 && totalRecebido < totalPrevisto) status = 'parcial'
      if (totalRecebido >= totalPrevisto && totalPrevisto > 0) status = 'concluido'

      const nfeItemId = item.nfe_item_id as string
      const numeroNf = nfeItemToNumeroMap.get(nfeItemId) || ''
      
      // Build nf_sources: ALL normal NFes that have this product
      // Uses the comprehensive allNfeItemsForRecebimento to find all contributing NFes
      const codigoProduto = nfeItem?.codigo_produto || ''
      const nfSources: string[] = []
      if (codigoProduto) {
        const nfeIdsForCodigo = codigoProdutoToNfeIds.get(codigoProduto) || []
        for (const nfeId of nfeIdsForCodigo) {
          if (!nfeOSIds.has(nfeId)) { // exclude OS NFes from nf_sources
            const nfNumero = nfeIdToNumeroMap.get(nfeId)
            if (nfNumero && !nfSources.includes(nfNumero)) {
              nfSources.push(nfNumero)
            }
          }
        }
      }

      // Build description with ref_meia suffix
      const skuDescricao = sku?.descricao 
        ? `${sku.descricao}${sku.ref_meia ? ` (${sku.ref_meia})` : ''}` 
        : nfeItem?.descricao || ''

      return {
        ...item,
        is_os: false,
        os_numero: null,
        numero_nf: numeroNf,
        nf_sources: nfSources.sort((a, b) => b.localeCompare(a)), // Sort DESC
        status_calculado: status,
        sku_descricao: skuDescricao,
        sku_corredor_sugerido: sku?.corredor_sugerido,
        sku_nivel_sugerido: sku?.nivel_sugerido,
        sku_prateleira_sugerida: sku?.prateleira_sugerida,
        sku_codigo_produto: sku?.codigo_produto || null,
        sku_ref_meia: sku?.ref_meia || null,
        sku_ref_inteira: sku?.ref_inteira || null,
        sku_existe: !!sku,
        recebimento_item_volumes: volumes,
      }
    })

  // Fetch OS tracking data
  const { data: osTracking } = await supabase
    .from('recebimento_os')
    .select('os_numero, volumes_previstos, volumes_recebidos, divergencia_tipo, divergencia_obs')
    .eq('recebimento_id', id)
  
  const osTrackingMap = new Map((osTracking || []).map(ot => [ot.os_numero, ot]))

  // Create virtual OS items (one per OS number)
  // For OS NFes with no assistencias extracted, a fallback item is created so they're visible
  const osItems = []
  for (const nfeLink of nfesOS) {
    const nfe = nfeLink.nfe as { volumes_total?: number; nfe_assistencias?: Array<{ id: string; os_oc_numero: string }>; numero_nf?: string }
    const assistencias = nfe?.nfe_assistencias || []
    const volumesTotal = nfe?.volumes_total || 0
    const numeroNfForOS = nfe?.numero_nf || (nfeIdToNumeroMap.get((nfeLink as { nfe_id: string }).nfe_id) || '')
    
    if (assistencias.length === 0) {
      // OS NFe with no assistencias extracted — create fallback item keyed by NF number
      const itemId = `os-nf-${numeroNfForOS || (nfeLink as { nfe_id: string }).nfe_id}`
      const tracking = osTrackingMap.get(itemId)
      const volumesRecebidos = tracking?.volumes_recebidos || 0
      const volumesPrevistos = tracking?.volumes_previstos || volumesTotal

      osItems.push({
        id: itemId,
        recebimento_id: id,
        nfe_item_id: null,
        volumes_previstos_total: volumesPrevistos,
        volumes_recebidos_total: volumesRecebidos,
        volumes_por_item: 1,
        corredor_final: null,
        nivel_final: null,
        divergencia_tipo: tracking?.divergencia_tipo || null,
        divergencia_obs: tracking?.divergencia_obs || null,
        avaria_foto_url: null,
        is_os: true,
        os_numero: itemId,
        numero_nf: numeroNfForOS,
        nfe_item: null,
        recebimento_item_volumes: [],
        status_calculado: volumesRecebidos >= volumesPrevistos ? 'concluido' : volumesRecebidos > 0 ? 'parcial' : 'pendente',
        sku_descricao: `OS-NF ${numeroNfForOS}`,
        sku_corredor_sugerido: null,
        sku_nivel_sugerido: null,
      })
    } else {
      for (const ass of assistencias) {
        const tracking = osTrackingMap.get(ass.os_oc_numero)
        const volumesRecebidos = tracking?.volumes_recebidos || 0
        const volumesPrevistos = tracking?.volumes_previstos || volumesTotal
        
        osItems.push({
          // ass.id garante chave única por registro: o mesmo os_oc_numero pode
          // se repetir legitimamente em mais de uma NFe/assistência (ex.: OS 4733).
          id: `os-${ass.os_oc_numero}-${ass.id}`,
          recebimento_id: id,
          nfe_item_id: null,
          volumes_previstos_total: volumesPrevistos,
          volumes_recebidos_total: volumesRecebidos,
          volumes_por_item: 1,
          corredor_final: null,
          nivel_final: null,
          divergencia_tipo: tracking?.divergencia_tipo || null,
          divergencia_obs: tracking?.divergencia_obs || null,
          avaria_foto_url: null,
          is_os: true,
          os_numero: ass.os_oc_numero,
          numero_nf: numeroNfForOS,
          nfe_item: null,
          recebimento_item_volumes: [],
          status_calculado: volumesRecebidos >= volumesPrevistos ? 'concluido' : volumesRecebidos > 0 ? 'parcial' : 'pendente',
          sku_descricao: `OS ${ass.os_oc_numero}`,
          sku_corredor_sugerido: null,
          sku_nivel_sugerido: null,
        })
      }
    }
  }

  // Volume avulso: ref bate com um produto cadastrado (matic_sku), mas a
  // descrição da própria linha da NFe indica "VOLUME" (ex.: "VOLUME 01- OFF
  // WHITE/FREIJO/ECO") — não é o produto completo. Essas linhas nunca geram
  // recebimento_itens (ver POST /api/recebimento), então são recalculadas
  // aqui a partir da NFe crua e tratadas como OS, uma entrada virtual por
  // nfe_item (mesmo padrão dos demais itens de OS acima).
  for (const ni of (allNfeItemsForRecebimento || [])) {
    if (nfeOSIds.has(ni.nfe_id)) continue // já tratado via nfe_assistencias acima

    const sku = skuMap.get(normalizeCode(ni.codigo_produto))
    if (!sku || !isDescricaoVolumeAvulso(ni.descricao)) continue

    const osNumero = `os-vol-${ni.id}`
    const tracking = osTrackingMap.get(osNumero)
    // A própria linha já é um volume avulso (ex.: "VOLUME 01"): a quantidade
    // da NFe já é a contagem de volumes físicos dessa linha. NÃO multiplicar
    // por volumes_por_item do produto completo (isso duplicaria a conta —
    // volumes_por_item descreve quantos volumes tem 1 unidade do produto
    // INTEIRO, não quantos volumes existem de um único tipo de volume já
    // identificado na descrição).
    const volumesPrevistos = tracking?.volumes_previstos ?? ni.quantidade
    const volumesRecebidos = tracking?.volumes_recebidos ?? 0
    const numeroNf = nfeIdToNumeroMap.get(ni.nfe_id) || ''

    osItems.push({
      id: osNumero,
      recebimento_id: id,
      nfe_item_id: null,
      volumes_previstos_total: volumesPrevistos,
      volumes_recebidos_total: volumesRecebidos,
      volumes_por_item: 1,
      corredor_final: null,
      nivel_final: null,
      divergencia_tipo: tracking?.divergencia_tipo || null,
      divergencia_obs: tracking?.divergencia_obs || null,
      avaria_foto_url: null,
      is_os: true,
      os_numero: osNumero,
      numero_nf: numeroNf,
      nfe_item: null,
      recebimento_item_volumes: [],
      status_calculado: volumesRecebidos >= volumesPrevistos ? 'concluido' : volumesRecebidos > 0 ? 'parcial' : 'pendente',
      sku_descricao: `Volume avulso — ${sku.descricao || ni.descricao}`,
      sku_corredor_sugerido: null,
      sku_nivel_sugerido: null,
    })
  }

  // Combine and sort
  const allItems = [...enrichedItens, ...osItems]
  allItems.sort((a: { sku_descricao: string }, b: { sku_descricao: string }) =>
    a.sku_descricao.localeCompare(b.sku_descricao, 'pt-BR')
  )

  // Calculate totals (regular items + OS)
  let totalPrevisto = 0
  let totalRecebido = 0
  for (const item of allItems) {
    totalPrevisto += (item as unknown as { volumes_previstos_total: number }).volumes_previstos_total || 0
    totalRecebido += (item as unknown as { volumes_recebidos_total: number }).volumes_recebidos_total || 0
  }

  return NextResponse.json({
    ...recebimento,
    nfes: nfeLinks || [],
    itens: allItems,
    total_previsto: totalPrevisto,
    total_recebido: totalRecebido,
  })
}
