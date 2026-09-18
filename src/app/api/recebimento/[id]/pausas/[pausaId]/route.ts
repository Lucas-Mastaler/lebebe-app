import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { aplicarDecisaoPausa, DecisaoPausa } from '@/lib/recebimento/pausas-revisao'

const DECISOES_VALIDAS: DecisaoPausa[] = ['trabalhando', 'pausado', 'editado']

// PATCH /api/recebimento/[id]/pausas/[pausaId] — aplica ou muda a decisão do
// operador sobre uma pausa revisável (SIM / NÃO / EDITAR PERÍODO).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pausaId: string }> }
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id, pausaId } = await params
  const body = await request.json().catch(() => ({}))
  const supabase = await createClient()

  // Recebimento precisa existir e estar aberto — pausas só fazem sentido
  // durante a conferência (não é possível reabrir um recebimento fechado
  // para corrigir uma pausa retroativamente).
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

  if (!DECISOES_VALIDAS.includes(body.decisao)) {
    return NextResponse.json({ error: 'Decisão inválida' }, { status: 400 })
  }

  const resultado = await aplicarDecisaoPausa(supabase, id, pausaId, {
    decisao: body.decisao,
    periodoInicio: body.periodo_trabalhado_inicio,
    periodoFim: body.periodo_trabalhado_fim,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.erro }, { status: 400 })
  }

  console.log(`[LOG] Pausa ${pausaId} do recebimento ${id} atualizada por ${auth.email}`)
  return NextResponse.json(resultado.pausa)
}
