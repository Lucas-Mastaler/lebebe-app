import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// POST /api/recebimento/[id]/cancelar
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
    return NextResponse.json({ error: 'Recebimento não está aberto' }, { status: 400 })
  }

  // Cancel
  const { error } = await supabase
    .from('recebimentos')
    .update({
      status: 'cancelado',
      data_fim: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[LOG] Erro ao cancelar recebimento:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[LOG] Recebimento ${id} cancelado por ${auth.email}`)

  return NextResponse.json({ message: 'Recebimento cancelado com sucesso' })
}
