import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// POST /api/recebimento/[id]/item/[itemId]/volume/[volumeNumero]
// Body: { delta: +1 or -1 }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; volumeNumero: string }> }
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id, itemId, volumeNumero } = await params
  const body = await request.json()
  const delta = body.delta as number

  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: 'Delta deve ser +1 ou -1' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify recebimento is open
  const { data: rec } = await supabase
    .from('recebimentos')
    .select('status')
    .eq('id', id)
    .single()

  if (!rec || rec.status !== 'aberto') {
    return NextResponse.json({ error: 'Recebimento não está aberto' }, { status: 400 })
  }

  // Get the volume record
  const { data: volume, error: volError } = await supabase
    .from('recebimento_item_volumes')
    .select('*')
    .eq('recebimento_item_id', itemId)
    .eq('volume_numero', parseInt(volumeNumero))
    .single()

  if (volError || !volume) {
    return NextResponse.json({ error: 'Volume não encontrado' }, { status: 404 })
  }

  const newQtd = volume.qtd_recebida + delta

  // Validate bounds: 0 <= qtd_recebida <= qtd_prevista
  if (newQtd < 0) {
    return NextResponse.json({ error: 'Quantidade não pode ser negativa' }, { status: 400 })
  }
  if (newQtd > volume.qtd_prevista) {
    return NextResponse.json({ error: 'Quantidade excede o previsto' }, { status: 400 })
  }

  // Update volume
  const { error: updateError } = await supabase
    .from('recebimento_item_volumes')
    .update({ qtd_recebida: newQtd })
    .eq('id', volume.id)

  if (updateError) {
    console.error('[LOG] Erro ao atualizar volume:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Recalculate recebimento_item totals
  const { data: allVolumes } = await supabase
    .from('recebimento_item_volumes')
    .select('qtd_recebida')
    .eq('recebimento_item_id', itemId)

  const totalRecebido = (allVolumes || []).reduce((sum, v) => sum + v.qtd_recebida, 0)

  // Get item to check totals
  const { data: recItem } = await supabase
    .from('recebimento_itens')
    .select('volumes_previstos_total')
    .eq('id', itemId)
    .single()

  const { error: itemUpdateError } = await supabase
    .from('recebimento_itens')
    .update({ volumes_recebidos_total: totalRecebido })
    .eq('id', itemId)

  if (itemUpdateError) {
    console.error('[LOG] Erro ao atualizar item:', itemUpdateError)
  }

  // Determine status
  let status = 'pendente'
  if (totalRecebido > 0 && totalRecebido < (recItem?.volumes_previstos_total || 0)) {
    status = 'parcial'
  } else if (totalRecebido >= (recItem?.volumes_previstos_total || 0) && (recItem?.volumes_previstos_total || 0) > 0) {
    status = 'concluido'
  }

  return NextResponse.json({
    volume_numero: parseInt(volumeNumero),
    qtd_recebida: newQtd,
    qtd_prevista: volume.qtd_prevista,
    item_total_recebido: totalRecebido,
    item_total_previsto: recItem?.volumes_previstos_total || 0,
    item_status: status,
  })
}
