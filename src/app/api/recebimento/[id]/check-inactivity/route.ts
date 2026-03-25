import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { verificarInatividade } from '@/lib/recebimento/timer-activity'

// POST /api/recebimento/[id]/check-inactivity
// Verifica inatividade e pausa timer se necessário
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

  const wasAutoPaused = await verificarInatividade(supabase, id)

  return NextResponse.json({ 
    auto_paused: wasAutoPaused,
    message: wasAutoPaused ? 'Timer pausado por inatividade' : 'Sem inatividade detectada'
  })
}
