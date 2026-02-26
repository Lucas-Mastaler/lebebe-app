import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

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
        nfe:nfe_id ( numero_nf, data_emissao )
      ),
      recebimento_itens (
        id,
        volumes_previstos_total,
        volumes_recebidos_total
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[LOG] Erro ao listar recebimentos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate progress for each recebimento
  const result = (data || []).map((rec) => {
    const itens = rec.recebimento_itens || []
    const totalPrevisto = itens.reduce((s: number, i: { volumes_previstos_total: number }) => s + i.volumes_previstos_total, 0)
    const totalRecebido = itens.reduce((s: number, i: { volumes_recebidos_total: number }) => s + i.volumes_recebidos_total, 0)
    return {
      ...rec,
      total_previsto: totalPrevisto,
      total_recebido: totalRecebido,
      total_itens: itens.length,
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

  // 3) Fetch matic_sku data for suggested locations
  const codigos = [...new Set((nfeItens || []).map(i => i.codigo_produto))]
  const { data: skus } = await supabase
    .from('matic_sku')
    .select('codigo_produto, corredor_sugerido, nivel_sugerido, volumes_por_item')
    .in('codigo_produto', codigos)

  const skuMap = new Map((skus || []).map(s => [s.codigo_produto, s]))

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

  // 6) Create recebimento_itens + recebimento_item_volumes
  for (const item of (nfeItens || [])) {
    const sku = skuMap.get(item.codigo_produto)
    const volumesPorItem = sku?.volumes_por_item || item.volumes_por_item || 1
    const volumesPrevistos = item.quantidade * volumesPorItem

    const { data: recItem, error: riError } = await supabase
      .from('recebimento_itens')
      .insert({
        recebimento_id: recId,
        nfe_item_id: item.id,
        volumes_previstos_total: volumesPrevistos,
        volumes_recebidos_total: 0,
        corredor_final: sku?.corredor_sugerido || null,
        nivel_final: sku?.nivel_sugerido || null,
      })
      .select()
      .single()

    if (riError) {
      console.error('[LOG] Erro ao criar recebimento_item:', riError)
      continue
    }

    // Create volume records (1 to volumes_por_item)
    const volumes = []
    for (let v = 1; v <= volumesPorItem; v++) {
      volumes.push({
        recebimento_item_id: recItem.id,
        volume_numero: v,
        qtd_prevista: item.quantidade,
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
