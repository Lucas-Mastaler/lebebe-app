import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// POST /api/recebimento/[id]/os/[osNumero] — update OS volumes
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; osNumero: string }> }
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id, osNumero } = await params
  const body = await request.json()
  const { volumes_recebidos, volumes_previstos } = body

  if (typeof volumes_recebidos !== 'number') {
    return NextResponse.json({ error: 'volumes_recebidos é obrigatório' }, { status: 400 })
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

  // Upsert OS tracking
  const { data, error } = await supabase
    .from('recebimento_os')
    .upsert({
      recebimento_id: id,
      os_numero: osNumero,
      volumes_previstos: volumes_previstos || 0,
      volumes_recebidos: Math.max(0, volumes_recebidos),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'recebimento_id,os_numero'
    })
    .select()
    .single()

  if (error) {
    console.error('[LOG] Erro ao atualizar OS:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
