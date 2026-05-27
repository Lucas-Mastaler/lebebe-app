import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// Helper: remove leading zeros and trim spaces for matching (02685 -> 2685)
function normalizeCode(code: string): string {
  if (!code) return '0'
  return code.trim().replace(/^0+/, '') || '0'
}

// GET /api/recebimento — list all recebimentos with filters and pagination
export async function GET(request: NextRequest) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const dataInicio = searchParams.get('data_inicio')
  const dataFim = searchParams.get('data_fim')
  const numeroNF = searchParams.get('numero_nf')

  const supabase = await createClient()

  // Build query with filters
  let query = supabase
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
    `, { count: 'exact' })

  // Apply date filters
  if (dataInicio) {
    query = query.gte('data_inicio', dataInicio)
  }
  if (dataFim) {
    query = query.lte('data_inicio', dataFim)
  }

  query = query.order('created_at', { ascending: false })

  // Apply pagination
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

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

  // Apply numero_nf filter (dynamic partial search)
  let filteredResult = result
  if (numeroNF) {
    filteredResult = result.filter(rec => {
      const nfes = rec.recebimento_nfes || []
      return nfes.some((nfeLink: any) => 
        nfeLink.nfe?.numero_nf?.toString().includes(numeroNF)
      )
    })
  }

  // Return with pagination metadata
  return NextResponse.json({
    data: filteredResult,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  })
}

// POST /api/recebimento — create a new recebimento
export async function POST(request: NextRequest) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await request.json()
  const { periodo_inicio, periodo_fim, motorista, quantos_chapas, obs, nfe_ids } = body

  if (!periodo_inicio || !periodo_fim) {
    return NextResponse.json({ error: 'Período obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()

  let nfeIds: string[]

  // 1) Use provided nfe_ids or find all NFes in the period
  if (nfe_ids && Array.isArray(nfe_ids) && nfe_ids.length > 0) {
    // Use selected NFes
    nfeIds = nfe_ids
  } else {
    // Find all NFes in the period
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

    nfeIds = nfes.map(n => n.id)
  }

  // 2) Find NFe items (limit high to avoid Supabase default 1000-row truncation)
  const { data: nfeItens, error: itensError } = await supabase
    .from('nfe_itens')
    .select(`
      id,
      nfe_id,
      codigo_produto,
      descricao,
      quantidade,
      volumes_por_item,
      volumes_previstos_total
    `)
    .in('nfe_id', nfeIds)
    .limit(10000)

  if (itensError) {
    console.error('[LOG] Erro ao buscar itens NF:', itensError)
    return NextResponse.json({ error: itensError.message }, { status: 500 })
  }

  // Buscar informações das NFes para logs legíveis
  const { data: nfesInfo } = await supabase
    .from('nfe')
    .select('id, numero_nf, is_os')
    .in('id', nfeIds)

  const nfeMap = new Map(nfesInfo?.map(n => [n.id, { numero_nf: n.numero_nf, is_os: n.is_os }]) || [])

  // Audit: log item count per NF
  const itensPerNf = new Map<string, number>()
  for (const item of (nfeItens || [])) {
    itensPerNf.set(item.nfe_id, (itensPerNf.get(item.nfe_id) || 0) + 1)
  }
  console.log(`[LOG][AUDIT] Total nfe_itens retornados: ${(nfeItens || []).length}`)
  for (const [nfeId, count] of itensPerNf) {
    const nfeInfo = nfeMap.get(nfeId)
    const nfLabel = nfeInfo ? `NF ${nfeInfo.numero_nf}${nfeInfo.is_os ? ' (OS)' : ''}` : `ID ${nfeId.slice(0,8)}...`
    console.log(`[LOG][AUDIT]   ${nfLabel}: ${count} itens`)
  }

  // Detectar NFes sem itens
  const nfesComItens = new Set(nfeItens?.map(i => i.nfe_id) || [])
  const nfesSemItens = nfeIds.filter(id => !nfesComItens.has(id))
  if (nfesSemItens.length > 0) {
    console.log(`[LOG][WARN] ${nfesSemItens.length} NFes vinculadas SEM itens:`)
    for (const nfeId of nfesSemItens) {
      const nfeInfo = nfeMap.get(nfeId)
      const nfLabel = nfeInfo ? `NF ${nfeInfo.numero_nf}${nfeInfo.is_os ? ' (OS - esperado sem itens em nfe_itens)' : ' (NORMAL - verificar!)'}` : `ID ${nfeId.slice(0,8)}...`
      console.log(`[LOG][WARN]   - ${nfLabel}: 0 itens encontrados`)
    }
  }

  // Resumo de NFes por tipo
  const nfesNormais: string[] = []
  const nfesOS: string[] = []
  for (const [nfeId, info] of nfeMap) {
    if (info.is_os) {
      nfesOS.push(info.numero_nf)
    } else {
      nfesNormais.push(info.numero_nf)
    }
  }
  console.log(`[LOG][AUDIT] Resumo de NFes vinculadas:`)
  console.log(`[LOG][AUDIT]   - Total de NFes: ${nfeIds.length}`)
  console.log(`[LOG][AUDIT]   - NFes com itens: ${nfesComItens.size}`)
  console.log(`[LOG][AUDIT]   - NFes SEM itens: ${nfesSemItens.length}`)
  console.log(`[LOG][AUDIT]   - NFes normais: ${nfesNormais.length} (${nfesNormais.join(', ')})`)
  console.log(`[LOG][AUDIT]   - NFes OS: ${nfesOS.length} (${nfesOS.join(', ')})`)

  // 3) Fetch matic_sku data for suggested locations (using ref_meia or ref_inteira to match NF codigo_produto)
  // Normalize codes: remove leading zeros (02685 -> 2685)
  const codigos = [...new Set((nfeItens || []).map(i => i.codigo_produto))]
  const codigosNormalizados = codigos.map(c => normalizeCode(c))

  const { data: skus } = await supabase
    .from('matic_sku')
    .select('codigo_produto, descricao, ref_meia, ref_inteira, corredor_sugerido, nivel_sugerido, prateleira_sugerida, volumes_por_item')
    .or('ref_meia.not.is.null,ref_inteira.not.is.null')

  // Build map: normalized code from NF -> SKU data (including internal codigo_produto)
  const skuMap = new Map<string, { codigo_produto: string; descricao: string; ref_meia: string | null; ref_inteira: string | null; corredor_sugerido: string | null; nivel_sugerido: string | null; prateleira_sugerida: string | null; volumes_por_item: number }>()
  if (skus) {
    for (const sku of skus) {
      // Match via ref_meia (priority 1)
      const normalizedRefMeia = normalizeCode(sku.ref_meia || '')
      if (normalizedRefMeia && codigosNormalizados.includes(normalizedRefMeia)) {
        skuMap.set(normalizedRefMeia, sku)
      }
      
      // Fallback: match via ref_inteira (priority 2)
      const normalizedRefInteira = normalizeCode(sku.ref_inteira || '')
      if (normalizedRefInteira && codigosNormalizados.includes(normalizedRefInteira)) {
        // Only add if not already found via ref_meia (ref_meia has priority)
        if (!skuMap.has(normalizedRefInteira)) {
          skuMap.set(normalizedRefInteira, sku)
        }
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
  // Skip items from OS NFes — they are tracked via nfe_assistencias, not recebimento_itens
  const nfeOsIdSet = new Set(nfesInfo?.filter(n => n.is_os).map(n => n.id) || [])
  const nfeItensParaAgrupar = (nfeItens || []).filter(item => !nfeOsIdSet.has(item.nfe_id))
  if (nfeItensParaAgrupar.length < (nfeItens || []).length) {
    const excluidos = (nfeItens || []).length - nfeItensParaAgrupar.length
    console.log(`[LOG][AUDIT] Excluindo ${excluidos} itens de NFes OS do agrupamento (serão tratados via assistencias)`)
  }

  const groupedItems = new Map<string, { 
    codigo_produto: string
    descricao: string
    quantidade_total: number
    nfe_item_ids: string[]
    volumes_por_item: number
    refs_usadas: Set<string>
  }>()

  for (const item of nfeItensParaAgrupar) {
    const codigoNormalizado = normalizeCode(item.codigo_produto)
    const sku = skuMap.get(codigoNormalizado)
    const volumesPorItem = sku?.volumes_por_item || item.volumes_por_item || 1
    
    // Group by internal SKU codigo_produto (if found), otherwise by normalized NF code
    const groupKey = sku?.codigo_produto || codigoNormalizado
    const existing = groupedItems.get(groupKey)
    
    // Build description with ref_meia suffix
    const descricao = sku?.descricao 
      ? `${sku.descricao}${sku.ref_meia ? ` (${sku.ref_meia})` : ''}` 
      : item.descricao

    if (existing) {
      existing.quantidade_total += item.quantidade
      existing.nfe_item_ids.push(item.id)
      // Track all refs used for this SKU
      existing.refs_usadas.add(item.codigo_produto)
    } else {
      groupedItems.set(groupKey, {
        codigo_produto: item.codigo_produto,
        descricao: descricao,
        quantidade_total: item.quantidade,
        nfe_item_ids: [item.id],
        volumes_por_item: volumesPorItem,
        refs_usadas: new Set([item.codigo_produto])
      })
    }
  }

  console.log(`[LOG] Agrupados ${nfeItensParaAgrupar.length} itens de NFes normais em ${groupedItems.size} itens únicos`)
  
  // Audit: log items that came from multiple NFs with NF numbers
  for (const [codigo, group] of groupedItems) {
    if (group.nfe_item_ids.length > 1) {
      // Descobrir quais NFes contribuíram para este item
      const nfesDoItem = new Set<string>()
      for (const itemId of group.nfe_item_ids) {
        const nfeItem = nfeItens?.find(i => i.id === itemId)
        if (nfeItem) {
          const nfeInfo = nfeMap.get(nfeItem.nfe_id)
          if (nfeInfo) {
            nfesDoItem.add(nfeInfo.numero_nf)
          }
        }
      }
      console.log(`[LOG][AUDIT] Item ${group.codigo_produto} (norm: ${codigo}) agrupado de ${group.nfe_item_ids.length} itens de NFs: ${Array.from(nfesDoItem).join(', ')} - qty_total=${group.quantidade_total}, vol/item=${group.volumes_por_item}`)
    }
  }

  // 7) Create recebimento_itens + recebimento_item_volumes (grouped)
  console.log(`[LOG][AUDIT] Criando ${groupedItems.size} recebimento_itens...`)
  let itensCreated = 0
  let itensFailed = 0

  for (const [codigoNormalizado, group] of groupedItems) {
    const sku = skuMap.get(codigoNormalizado)
    const volumesPorItem = group.volumes_por_item
    const volumesPrevistos = group.quantidade_total * volumesPorItem
    
    // Build refs_display: all unique refs used, sorted and joined by /
    const refsArray = Array.from(group.refs_usadas).sort()
    const refsDisplay = refsArray.join('/')

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
        refs_display: refsDisplay,
      })
      .select()
      .single()

    if (riError) {
      itensFailed++
      console.error(`[LOG][ERROR] Falha ao criar item ${group.codigo_produto}:`, riError)
      continue
    }
    
    itensCreated++

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

  console.log(`[LOG][AUDIT] Resumo: ${itensCreated} itens criados, ${itensFailed} falharam`)
  console.log(`[LOG] Recebimento ${recId} criado com ${nfeIds.length} NFs e ${(nfeItens || []).length} itens`)

  return NextResponse.json({ id: recId, message: 'Recebimento criado com sucesso' }, { status: 201 })
}
