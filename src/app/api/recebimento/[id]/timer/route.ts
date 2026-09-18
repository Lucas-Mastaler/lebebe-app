import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { pausarTimerManualmente, retomarTimerManualmente } from '@/lib/recebimento/timer-activity'

// PATCH /api/recebimento/[id]/timer - update timer state
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
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

  if (body.timer_rodando === undefined) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const isStarting = body.timer_rodando === true
  const now = new Date()

  // Toda a regra de acumulação/reconciliação por inatividade fica
  // centralizada em timer-activity.ts — esta rota só decide qual transição
  // (retomar/pausar) o clique representa.
  const data = isStarting
    ? await retomarTimerManualmente(supabase, id, now)
    : await pausarTimerManualmente(supabase, id, now)

  if (!data) {
    return NextResponse.json({ error: 'Recebimento não encontrado' }, { status: 404 })
  }

  console.log(`[LOG] Timer do recebimento ${id} atualizado por ${auth.email}`)
  return NextResponse.json(data)
}
