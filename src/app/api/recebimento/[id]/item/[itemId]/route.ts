import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// PATCH /api/recebimento/[id]/item/[itemId] — update local or divergência
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id, itemId } = await params
  const body = await request.json()

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

  // Build update object with only allowed fields
  const updateFields: Record<string, unknown> = {}
  if (body.corredor_final !== undefined) updateFields.corredor_final = body.corredor_final
  if (body.nivel_final !== undefined) updateFields.nivel_final = body.nivel_final
  if (body.divergencia_tipo !== undefined) updateFields.divergencia_tipo = body.divergencia_tipo || null
  if (body.divergencia_obs !== undefined) updateFields.divergencia_obs = body.divergencia_obs || null
  if (body.avaria_foto_url !== undefined) updateFields.avaria_foto_url = body.avaria_foto_url || null

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('recebimento_itens')
    .update(updateFields)
    .eq('id', itemId)
    .eq('recebimento_id', id)
    .select()
    .single()

  if (error) {
    console.error('[LOG] Erro ao atualizar item:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
