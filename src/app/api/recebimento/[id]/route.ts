import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// Helper: remove leading zeros for matching (02685 -> 2685)
function normalizeCode(code: string): string {
  return code.replace(/^0+/, '') || '0'
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
        nfe_assistencias ( os_oc_numero )
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

  // Fetch matic_sku info for items (using ref_meia to match NF codigo_produto)
  // Normalize codes: remove leading zeros (02685 -> 2685)
  const codigosNF = [...new Set((itens || []).map((i: Record<string, unknown>) => {
    const nfeItem = i.nfe_item as { codigo_produto: string } | null
    return nfeItem?.codigo_produto
  }).filter(Boolean))] as string[]

  const codigosNormalizados = codigosNF.map(c => normalizeCode(c))

  let skuMap = new Map<string, { descricao: string; corredor_sugerido: string | null; nivel_sugerido: string | null; prateleira_sugerida: string | null; volumes_por_item: number }>()
  if (codigosNormalizados.length > 0) {
    // Fetch all SKUs and normalize ref_meia for comparison
    const { data: skus } = await supabase
      .from('matic_sku')
      .select('ref_meia, descricao, corredor_sugerido, nivel_sugerido, prateleira_sugerida, volumes_por_item')
      .not('ref_meia', 'is', null)

    // Build map with normalized codes
    if (skus) {
      for (const sku of skus) {
        const normalizedRefMeia = normalizeCode(sku.ref_meia || '')
        if (codigosNormalizados.includes(normalizedRefMeia)) {
          skuMap.set(normalizedRefMeia, sku)
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
  
  // Fetch all nfe_itens to identify which items belong to OS NFes (single query optimization)
  const itemNfeItemIds = (itens || []).map((item: Record<string, unknown>) => item.nfe_item_id).filter(Boolean)
  const { data: nfeItemsData } = await supabase
    .from('nfe_itens')
    .select('id, nfe_id')
    .in('id', itemNfeItemIds)
  
  const nfeItemToNfeMap = new Map((nfeItemsData || []).map(ni => [ni.id, ni.nfe_id]))
  
  // Mark items from OS NFes
  const itensOSIds = new Set<string>()
  for (const item of (itens || [])) {
    const nfeItemId = item.nfe_item_id as string
    const nfeId = nfeItemToNfeMap.get(nfeItemId)
    if (nfeId && nfeOSIds.has(nfeId)) {
      itensOSIds.add(item.id as string)
    }
  }

  // Enrich normal items (NOT from OS)
  const enrichedItens = (itens || [])
    .filter((item: Record<string, unknown>) => !itensOSIds.has(item.id as string))
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

      return {
        ...item,
        is_os: false,
        os_numero: null,
        status_calculado: status,
        sku_descricao: sku?.descricao || nfeItem?.descricao || '',
        sku_corredor_sugerido: sku?.corredor_sugerido,
        sku_nivel_sugerido: sku?.nivel_sugerido,
        sku_prateleira_sugerida: sku?.prateleira_sugerida,
        recebimento_item_volumes: volumes,
      }
    })

  // Fetch OS tracking data
  const { data: osTracking } = await supabase
    .from('recebimento_os')
    .select('os_numero, volumes_previstos, volumes_recebidos')
    .eq('recebimento_id', id)
  
  const osTrackingMap = new Map((osTracking || []).map(ot => [ot.os_numero, ot]))

  // Create virtual OS items (one per OS number)
  const osItems = []
  for (const nfeLink of nfesOS) {
    const nfe = nfeLink.nfe as { volumes_total?: number; nfe_assistencias?: Array<{ os_oc_numero: string }> }
    const assistencias = nfe?.nfe_assistencias || []
    const volumesTotal = nfe?.volumes_total || 0
    
    for (const ass of assistencias) {
      const tracking = osTrackingMap.get(ass.os_oc_numero)
      const volumesRecebidos = tracking?.volumes_recebidos || 0
      const volumesPrevistos = tracking?.volumes_previstos || volumesTotal
      
      osItems.push({
        id: `os-${ass.os_oc_numero}`,
        recebimento_id: id,
        nfe_item_id: null,
        volumes_previstos_total: volumesPrevistos,
        volumes_recebidos_total: volumesRecebidos,
        volumes_por_item: 1,
        corredor_final: null,
        nivel_final: null,
        divergencia_tipo: null,
        divergencia_obs: null,
        avaria_foto_url: null,
        is_os: true,
        os_numero: ass.os_oc_numero,
        nfe_item: null,
        recebimento_item_volumes: [],
        status_calculado: volumesRecebidos >= volumesPrevistos ? 'concluido' : volumesRecebidos > 0 ? 'parcial' : 'pendente',
        sku_descricao: `OS ${ass.os_oc_numero}`,
        sku_corredor_sugerido: null,
        sku_nivel_sugerido: null,
      })
    }
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
