import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// Helper: remove leading zeros for matching (02685 -> 2685)
function normalizeCode(code: string): string {
  return code.replace(/^0+/, '') || '0'
}

// GET /api/recebimento — list all recebimentos
export async function GET() {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recebimentos')
    .select(`
      *,
      recebimento_nfes (
        nfe_id,
        nfe:nfe_id ( 
          numero_nf, 
          data_emissao, 
          peso_total, 
          volumes_total,
          is_os,
          nfe_assistencias ( os_oc_numero )
        )
      ),
      recebimento_itens (
        id,
        volumes_previstos_total,
        volumes_recebidos_total,
        nfe_item:nfe_item_id (
          nfe:nfe_id (
            is_os
          )
        )
      ),
      recebimento_os (
        os_numero,
        volumes_previstos,
        volumes_recebidos
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[LOG] Erro ao listar recebimentos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate progress for each recebimento
  const result = (data || []).map((rec) => {
    const allItens = rec.recebimento_itens || []
    const nfes = rec.recebimento_nfes || []
    const osTracking = rec.recebimento_os || []
    
    // Filter: only items from NORMAL NFes (is_os=false)
    const itens = allItens.filter((item: { nfe_item?: { nfe?: { is_os?: boolean } } | null }) => {
      const nfe = item.nfe_item?.nfe
      return !nfe?.is_os // exclude items from OS NFes
    })
    
    // Sum volumes from regular items only
    const itensVolumes = itens.reduce((s: number, i: { volumes_previstos_total: number }) => s + i.volumes_previstos_total, 0)
    const itensRecebidos = itens.reduce((s: number, i: { volumes_recebidos_total: number }) => s + i.volumes_recebidos_total, 0)
    
    // Count OS same way as conferência: iterate nfe_assistencias from OS NFes
    const nfesOS = nfes.filter((nfeLink: { nfe: { is_os?: boolean } | null }) => nfeLink.nfe?.is_os)
    const osTrackingMap = new Map((osTracking || []).map((ot: { os_numero: string; volumes_previstos: number; volumes_recebidos: number }) => [ot.os_numero, ot]))
    
    console.log(`[LOG][OS DEBUG] NFes OS: ${nfesOS.length}`)
    console.log(`[LOG][OS DEBUG] recebimento_os entries: ${osTracking.length}`)
    if (osTracking.length > 0) {
      console.log(`[LOG][OS DEBUG] recebimento_os data:`, osTracking)
    }
    
    let osVolumes = 0
    let osRecebidos = 0
    let osCount = 0
    
    for (const nfeLink of nfesOS) {
      const nfe = nfeLink.nfe as { volumes_total?: number; nfe_assistencias?: Array<{ os_oc_numero: string }> }
      const assistencias = nfe?.nfe_assistencias || []
      const volumesTotal = nfe?.volumes_total || 0
      
      console.log(`[LOG][OS DEBUG] NF volumes_total: ${volumesTotal}, assistencias: ${assistencias.length}`)
      
      for (const ass of assistencias) {
        osCount++
        const tracking = osTrackingMap.get(ass.os_oc_numero) as { volumes_previstos: number; volumes_recebidos: number } | undefined
        const volPrevistos = tracking?.volumes_previstos ?? volumesTotal
        const volRecebidos = tracking?.volumes_recebidos ?? 0
        
        console.log(`[LOG][OS DEBUG]   OS ${ass.os_oc_numero}: tracking=${!!tracking}, previstos=${volPrevistos}, recebidos=${volRecebidos}`)
        
        osVolumes += volPrevistos
        osRecebidos += volRecebidos
      }
    }
    
    console.log(`[LOG][RECEBIMENTO LIST] ID: ${rec.id}`)
    console.log(`[LOG]   Itens total: ${allItens.length} | Itens NFes normais: ${itens.length}`)
    console.log(`[LOG]   Volumes itens normais: ${itensVolumes}`)
    console.log(`[LOG]   OS count: ${osCount} | Volumes OS: ${osVolumes}`)
    console.log(`[LOG]   Total (itens normais + OS): ${itensVolumes + osVolumes}`)
    
    const totalPrevisto = itensVolumes + osVolumes
    const totalRecebido = itensRecebidos + osRecebidos
    
    // Calculate total weight and extract OS numbers
    const pesoTotal = nfes.reduce((s: number, nfeLink: { nfe: { peso_total?: number } | null }) => {
      return s + (nfeLink.nfe?.peso_total || 0)
    }, 0)
    
    const numerosOS: string[] = []
    for (const nfeLink of nfes) {
      const assistencias = (nfeLink.nfe as { nfe_assistencias?: Array<{ os_oc_numero: string }> })?.nfe_assistencias || []
      for (const ass of assistencias) {
        if (ass.os_oc_numero && !numerosOS.includes(ass.os_oc_numero)) {
          numerosOS.push(ass.os_oc_numero)
        }
      }
    }
    
    return {
      ...rec,
      total_previsto: totalPrevisto,
      total_recebido: totalRecebido,
      total_itens: itens.length,
      peso_total: pesoTotal,
      qtd_os: numerosOS.length,
      numeros_os: numerosOS,
    }
  })

  return NextResponse.json(result)
}

// POST /api/recebimento — create a new recebimento
export async function POST(request: NextRequest) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await request.json()
  const { periodo_inicio, periodo_fim, motorista, quantos_chapas, obs } = body

  if (!periodo_inicio || !periodo_fim) {
    return NextResponse.json({ error: 'Período obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1) Find NFes in the period
  const { data: nfes, error: nfeError } = await supabase
    .from('nfe')
    .select('id')
    .gte('data_emissao', periodo_inicio)
    .lte('data_emissao', periodo_fim)

  if (nfeError) {
    console.error('[LOG] Erro ao buscar NFs:', nfeError)
    return NextResponse.json({ error: nfeError.message }, { status: 500 })
  }

  if (!nfes || nfes.length === 0) {
    return NextResponse.json({ error: 'Nenhuma NF encontrada no período selecionado' }, { status: 404 })
  }

  const nfeIds = nfes.map(n => n.id)

  // 2) Find NFe items
  const { data: nfeItens, error: itensError } = await supabase
    .from('nfe_itens')
    .select(`
      id,
      codigo_produto,
      descricao,
      quantidade,
      volumes_por_item,
      volumes_previstos_total
    `)
    .in('nfe_id', nfeIds)

  if (itensError) {
    console.error('[LOG] Erro ao buscar itens NF:', itensError)
    return NextResponse.json({ error: itensError.message }, { status: 500 })
  }

  // 3) Fetch matic_sku data for suggested locations (using ref_meia to match NF codigo_produto)
  // Normalize codes: remove leading zeros (02685 -> 2685)
  const codigos = [...new Set((nfeItens || []).map(i => i.codigo_produto))]
  const codigosNormalizados = codigos.map(c => normalizeCode(c))

  const { data: skus } = await supabase
    .from('matic_sku')
    .select('ref_meia, corredor_sugerido, nivel_sugerido, prateleira_sugerida, volumes_por_item')
    .not('ref_meia', 'is', null)

  // Build map with normalized codes
  const skuMap = new Map<string, { ref_meia: string; corredor_sugerido: string | null; nivel_sugerido: string | null; prateleira_sugerida: string | null; volumes_por_item: number }>()
  if (skus) {
    for (const sku of skus) {
      const normalizedRefMeia = normalizeCode(sku.ref_meia || '')
      if (codigosNormalizados.includes(normalizedRefMeia)) {
        skuMap.set(normalizedRefMeia, sku)
      }
    }
  }

  // 4) Create recebimento
  const { data: recebimento, error: recError } = await supabase
    .from('recebimentos')
    .insert({
      periodo_inicio,
      periodo_fim,
      motorista: motorista || null,
      quantos_chapas: quantos_chapas || null,
      obs: obs || null,
      status: 'aberto',
      criado_por: auth.userId,
    })
    .select()
    .single()

  if (recError) {
    console.error('[LOG] Erro ao criar recebimento:', recError)
    return NextResponse.json({ error: recError.message }, { status: 500 })
  }

  const recId = recebimento.id

  // 5) Link NFes to recebimento
  const nfeLinks = nfeIds.map(nfe_id => ({
    recebimento_id: recId,
    nfe_id,
  }))

  const { error: linkError } = await supabase
    .from('recebimento_nfes')
    .insert(nfeLinks)

  if (linkError) {
    console.error('[LOG] Erro ao vincular NFs:', linkError)
  }

  // 6) Group items by codigo_produto (merge duplicates from different NFs)
  const groupedItems = new Map<string, { 
    codigo_produto: string
    descricao: string
    quantidade_total: number
    nfe_item_ids: string[]
    volumes_por_item: number 
  }>()

  for (const item of (nfeItens || [])) {
    const codigoNormalizado = normalizeCode(item.codigo_produto)
    const existing = groupedItems.get(codigoNormalizado)
    const sku = skuMap.get(codigoNormalizado)
    const volumesPorItem = sku?.volumes_por_item || item.volumes_por_item || 1

    if (existing) {
      existing.quantidade_total += item.quantidade
      existing.nfe_item_ids.push(item.id)
    } else {
      groupedItems.set(codigoNormalizado, {
        codigo_produto: item.codigo_produto,
        descricao: item.descricao,
        quantidade_total: item.quantidade,
        nfe_item_ids: [item.id],
        volumes_por_item: volumesPorItem,
      })
    }
  }

  console.log(`[LOG] Agrupados ${(nfeItens || []).length} itens de NF em ${groupedItems.size} itens únicos`)

  // 7) Create recebimento_itens + recebimento_item_volumes (grouped)
  for (const [codigoNormalizado, group] of groupedItems) {
    const sku = skuMap.get(codigoNormalizado)
    const volumesPorItem = group.volumes_por_item
    const volumesPrevistos = group.quantidade_total * volumesPorItem

    // Use first nfe_item_id as reference
    const { data: recItem, error: riError } = await supabase
      .from('recebimento_itens')
      .insert({
        recebimento_id: recId,
        nfe_item_id: group.nfe_item_ids[0], // First item as reference
        volumes_previstos_total: volumesPrevistos,
        volumes_recebidos_total: 0,
        volumes_por_item: volumesPorItem,
        corredor_final: sku?.corredor_sugerido || null,
        nivel_final: sku?.nivel_sugerido || null,
      })
      .select()
      .single()

    if (riError) {
      console.error('[LOG] Erro ao criar recebimento_item:', riError)
      continue
    }

    // Create volume records (1 per volume type)
    const volumes = []
    for (let v = 1; v <= volumesPorItem; v++) {
      volumes.push({
        recebimento_item_id: recItem.id,
        volume_numero: v,
        qtd_prevista: group.quantidade_total, // Total quantity from all NFs
        qtd_recebida: 0,
      })
    }

    if (volumes.length > 0) {
      const { error: volError } = await supabase
        .from('recebimento_item_volumes')
        .insert(volumes)

      if (volError) {
        console.error('[LOG] Erro ao criar volumes:', volError)
      }
    }
  }

  console.log(`[LOG] Recebimento ${recId} criado com ${nfeIds.length} NFs e ${(nfeItens || []).length} itens`)

  return NextResponse.json({ id: recId, message: 'Recebimento criado com sucesso' }, { status: 201 })
}
