import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// Helper: remove leading zeros for matching (02685 -> 2685)
function normalizeCode(code: string): string {
  return code.replace(/^0+/, '') || '0'
}

// POST /api/recebimento/[id]/finalizar
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  // Verify recebimento exists and is open
  const { data: rec } = await supabase
    .from('recebimentos')
    .select('status')
    .eq('id', id)
    .single()

  if (!rec) {
    return NextResponse.json({ error: 'Recebimento não encontrado' }, { status: 404 })
  }

  if (rec.status !== 'aberto') {
    return NextResponse.json({ error: 'Recebimento já está fechado' }, { status: 400 })
  }

  // Identify which NFs are OS type (to exclude their items from validation)
  const { data: nfeLinks } = await supabase
    .from('recebimento_nfes')
    .select('nfe_id, nfe:nfe_id(is_os)')
    .eq('recebimento_id', id)

  const nfeOSIds = new Set(
    (nfeLinks || [])
      .filter((link: Record<string, unknown>) => (link.nfe as { is_os?: boolean } | null)?.is_os)
      .map((link: Record<string, unknown>) => link.nfe_id as string)
  )

  // Fetch all items with their nfe_item link
  const { data: itens } = await supabase
    .from('recebimento_itens')
    .select('id, nfe_item_id, volumes_previstos_total, volumes_recebidos_total, divergencia_tipo')
    .eq('recebimento_id', id)

  // Get nfe_item -> nfe mapping to identify OS items
  const nfeItemIds = (itens || []).map(i => i.nfe_item_id).filter(Boolean)
  let osItemIds = new Set<string>()
  
  if (nfeItemIds.length > 0 && nfeOSIds.size > 0) {
    const { data: nfeItemsData } = await supabase
      .from('nfe_itens')
      .select('id, nfe_id')
      .in('id', nfeItemIds)

    for (const ni of (nfeItemsData || [])) {
      if (nfeOSIds.has(ni.nfe_id)) {
        // Find item with this nfe_item_id and mark as OS
        const item = (itens || []).find(i => i.nfe_item_id === ni.id)
        if (item) osItemIds.add(item.id)
      }
    }
  }

  // Filter to only normal items (exclude OS items which are tracked via recebimento_os)
  const itensNormais = (itens || []).filter(item => !osItemIds.has(item.id))

  console.log(`[LOG] Validação: ${(itens || []).length} itens total, ${osItemIds.size} OS excluídos, ${itensNormais.length} normais para validar`)

  // Recalculate volumes_recebidos_total from actual volume records (fix any desync)
  for (const item of itensNormais) {
    const { data: volumes } = await supabase
      .from('recebimento_item_volumes')
      .select('qtd_recebida')
      .eq('recebimento_item_id', item.id)

    const realTotal = (volumes || []).reduce((sum, v) => sum + (v.qtd_recebida || 0), 0)

    if (realTotal !== item.volumes_recebidos_total) {
      console.log(`[LOG] Corrigindo dessincronia item ${item.id}: banco=${item.volumes_recebidos_total}, real=${realTotal}`)
      await supabase
        .from('recebimento_itens')
        .update({ volumes_recebidos_total: realTotal })
        .eq('id', item.id)
      item.volumes_recebidos_total = realTotal
    }
  }

  // Validate: all normal items must be complete OR have divergência
  const pendentesItens = itensNormais.filter(item => {
    const incompleto = item.volumes_recebidos_total < item.volumes_previstos_total
    const semDivergencia = !item.divergencia_tipo
    return incompleto && semDivergencia
  })

  if (pendentesItens.length > 0) {
    console.log('[LOG] Itens normais incompletos sem divergência:', pendentesItens.map(p => ({
      id: p.id,
      recebido: p.volumes_recebidos_total,
      previsto: p.volumes_previstos_total,
      divergencia: p.divergencia_tipo
    })))
    return NextResponse.json({
      error: `Existem ${pendentesItens.length} item(ns) incompleto(s) sem divergência registrada`,
      itens_pendentes: pendentesItens.map(p => p.id),
    }, { status: 400 })
  }

  // Update matic_sku with learned data (volumes_por_item, corredor, nivel, prateleira)
  const { data: itensCompletos } = await supabase
    .from('recebimento_itens')
    .select(`
      nfe_item_id,
      volumes_por_item,
      corredor_final,
      nivel_final,
      prateleira_final,
      nfe_itens!inner (codigo_produto)
    `)
    .eq('recebimento_id', id)

  for (const item of (itensCompletos || [])) {
    const nfeItem = item.nfe_itens as unknown as { codigo_produto: string }
    const codigoNF = nfeItem?.codigo_produto // Código da NF
    
    if (!codigoNF) continue

    const codigoNormalizado = normalizeCode(codigoNF)

    // Check if SKU exists by normalized ref_meia
    const { data: allSkus } = await supabase
      .from('matic_sku')
      .select('codigo_produto, ref_meia')
      .not('ref_meia', 'is', null)

    // Find SKU with matching normalized ref_meia
    const existingSku = allSkus?.find(sku => 
      normalizeCode(sku.ref_meia || '') === codigoNormalizado
    )

    const updateData: Record<string, unknown> = {
      ref_meia: codigoNormalizado, // Store normalized version
      ativo: true,
      updated_at: new Date().toISOString(),
    }

    // If exists, use its codigo_produto, otherwise create new with normalized code
    if (existingSku) {
      updateData.codigo_produto = existingSku.codigo_produto
    } else {
      updateData.codigo_produto = codigoNormalizado // Use normalized code as internal code for new items
    }

    if (item.volumes_por_item) updateData.volumes_por_item = item.volumes_por_item
    if (item.corredor_final) updateData.corredor_sugerido = item.corredor_final
    if (item.nivel_final) updateData.nivel_sugerido = item.nivel_final
    if (item.prateleira_final) updateData.prateleira_sugerida = item.prateleira_final

    await supabase
      .from('matic_sku')
      .upsert(updateData, { onConflict: 'codigo_produto' })
  }

  console.log(`[LOG] matic_sku atualizada com ${(itensCompletos || []).length} produtos`)

  // Finalize
  const { error } = await supabase
    .from('recebimentos')
    .update({
      status: 'fechado',
      data_fim: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[LOG] Erro ao finalizar recebimento:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[LOG] Recebimento ${id} finalizado por ${auth.email}`)

  return NextResponse.json({ message: 'Recebimento finalizado com sucesso' })
}
