import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

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

  // Fetch linked NFes
  const { data: nfeLinks } = await supabase
    .from('recebimento_nfes')
    .select('nfe_id, nfe:nfe_id ( numero_nf, data_emissao, peso_total, volumes_total )')
    .eq('recebimento_id', id)

  // Fetch recebimento items with NF item data and volumes
  const { data: itens, error: itensError } = await supabase
    .from('recebimento_itens')
    .select(`
      *,
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

  // Fetch matic_sku info for items
  const codigos = [...new Set((itens || []).map((i: Record<string, unknown>) => {
    const nfeItem = i.nfe_item as { codigo_produto: string } | null
    return nfeItem?.codigo_produto
  }).filter(Boolean))]

  let skuMap = new Map<string, { descricao: string; corredor_sugerido: string | null; nivel_sugerido: string | null }>()
  if (codigos.length > 0) {
    const { data: skus } = await supabase
      .from('matic_sku')
      .select('codigo_produto, descricao, corredor_sugerido, nivel_sugerido')
      .in('codigo_produto', codigos)

    skuMap = new Map((skus || []).map(s => [s.codigo_produto, s]))
  }

  // Enrich items with sku info and sort volumes
  const enrichedItens = (itens || []).map((item: Record<string, unknown>) => {
    const nfeItem = item.nfe_item as { codigo_produto: string; descricao: string; quantidade: number; volumes_por_item: number } | null
    const sku = nfeItem ? skuMap.get(nfeItem.codigo_produto) : null
    const volumes = (item.recebimento_item_volumes as Array<{ id: string; volume_numero: number; qtd_prevista: number; qtd_recebida: number }>) || []

    // Sort volumes by volume_numero
    volumes.sort((a, b) => a.volume_numero - b.volume_numero)

    // Calculate status
    const totalPrevisto = item.volumes_previstos_total as number
    const totalRecebido = item.volumes_recebidos_total as number
    let status = 'pendente'
    if (totalRecebido > 0 && totalRecebido < totalPrevisto) status = 'parcial'
    if (totalRecebido >= totalPrevisto && totalPrevisto > 0) status = 'concluido'

    return {
      ...item,
      status_calculado: status,
      sku_descricao: sku?.descricao || nfeItem?.descricao || '',
      sku_corredor_sugerido: sku?.corredor_sugerido,
      sku_nivel_sugerido: sku?.nivel_sugerido,
      recebimento_item_volumes: volumes,
    }
  })

  // Sort by sku description
  enrichedItens.sort((a: { sku_descricao: string }, b: { sku_descricao: string }) =>
    a.sku_descricao.localeCompare(b.sku_descricao, 'pt-BR')
  )

  // Calculate totals
  let totalPrevisto = 0
  let totalRecebido = 0
  for (const item of enrichedItens) {
    totalPrevisto += (item as unknown as { volumes_previstos_total: number }).volumes_previstos_total || 0
    totalRecebido += (item as unknown as { volumes_recebidos_total: number }).volumes_recebidos_total || 0
  }

  return NextResponse.json({
    ...recebimento,
    nfes: nfeLinks || [],
    itens: enrichedItens,
    total_previsto: totalPrevisto,
    total_recebido: totalRecebido,
  })
}
