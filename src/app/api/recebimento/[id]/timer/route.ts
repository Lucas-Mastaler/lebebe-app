import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

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
    .select('status, timer_segundos_totais, timer_rodando, timer_ultima_acao')
    .eq('id', id)
    .single()

  if (!rec) {
    return NextResponse.json({ error: 'Recebimento não encontrado' }, { status: 404 })
  }

  if (rec.status !== 'aberto') {
    return NextResponse.json({ error: 'Recebimento já está fechado' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  const now = new Date().toISOString()

  // If toggling timer state
  if (body.timer_rodando !== undefined) {
    const isStarting = body.timer_rodando === true
    
    if (isStarting) {
      // Starting timer - just update state and timestamp
      updateData.timer_rodando = true
      updateData.timer_ultima_acao = now
    } else {
      // Pausing timer - accumulate elapsed time
      if (rec.timer_rodando && rec.timer_ultima_acao) {
        const lastAction = new Date(rec.timer_ultima_acao)
        const elapsed = Math.floor((new Date().getTime() - lastAction.getTime()) / 1000)
        updateData.timer_segundos_totais = (rec.timer_segundos_totais || 0) + elapsed
      }
      updateData.timer_rodando = false
      updateData.timer_ultima_acao = now
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('recebimentos')
    .update(updateData)
    .eq('id', id)
    .select('timer_segundos_totais, timer_rodando, timer_ultima_acao')
    .single()

  if (error) {
    console.error('[LOG] Erro ao atualizar timer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[LOG] Timer do recebimento ${id} atualizado por ${auth.email}`)
  return NextResponse.json(data)
}
