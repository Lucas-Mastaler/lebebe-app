import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

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

  // Validate: all items must be complete OR have divergência
  const { data: itens } = await supabase
    .from('recebimento_itens')
    .select('id, volumes_previstos_total, volumes_recebidos_total, divergencia_tipo')
    .eq('recebimento_id', id)

  const pendentes = (itens || []).filter(item => {
    const incompleto = item.volumes_recebidos_total < item.volumes_previstos_total
    const semDivergencia = !item.divergencia_tipo
    return incompleto && semDivergencia
  })

  if (pendentes.length > 0) {
    return NextResponse.json({
      error: `Existem ${pendentes.length} item(ns) incompleto(s) sem divergência registrada`,
      itens_pendentes: pendentes.map(p => p.id),
    }, { status: 400 })
  }

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
