import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// POST /api/recebimento/[id]/recalcular — recalculate volumes_recebidos_total for all items
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

  // Get all items from this recebimento
  const { data: itens, error: itensError } = await supabase
    .from('recebimento_itens')
    .select('id')
    .eq('recebimento_id', id)

  if (itensError) {
    console.error('[LOG] Erro ao buscar itens:', itensError)
    return NextResponse.json({ error: itensError.message }, { status: 500 })
  }

  let updated = 0
  let errors = 0

  for (const item of (itens || [])) {
    // Get all volumes for this item
    const { data: volumes } = await supabase
      .from('recebimento_item_volumes')
      .select('qtd_recebida')
      .eq('recebimento_item_id', item.id)

    // Calculate total received
    const totalRecebido = (volumes || []).reduce((sum, v) => sum + v.qtd_recebida, 0)

    // Update item
    const { error: updateError } = await supabase
      .from('recebimento_itens')
      .update({ volumes_recebidos_total: totalRecebido })
      .eq('id', item.id)

    if (updateError) {
      console.error('[LOG] Erro ao atualizar item:', item.id, updateError)
      errors++
    } else {
      updated++
      console.log('[LOG] Item atualizado:', item.id, '→ volumes_recebidos_total:', totalRecebido)
    }
  }

  console.log(`[LOG] Recálculo concluído: ${updated} itens atualizados, ${errors} erros`)

  return NextResponse.json({
    message: 'Recálculo concluído',
    itens_atualizados: updated,
    erros: errors,
  })
}
