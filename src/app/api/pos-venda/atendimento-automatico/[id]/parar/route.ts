import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireModuleAccess('pos_venda_atendimento_automatico')
  if (!access.ok) return access.response

  try {
    const { id } = await params
    const supabase = createServiceClient()
    const now = new Date().toISOString()

    const { data: sessao, error: errBusca } = await supabase
      .from('atendimento_automatico_sessoes')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (errBusca || !sessao) {
      return NextResponse.json({ ok: false, message: 'Sessao nao encontrada' }, { status: 404 })
    }

    if (sessao.status === 'finalizado') {
      return NextResponse.json({ ok: false, message: 'Sessao ja finalizada' }, { status: 400 })
    }

    const { error: errUpdate } = await supabase
      .from('atendimento_automatico_sessoes')
      .update({
        status: 'finalizado',
        estado: 'finalizado',
        updated_at: now,
      })
      .eq('id', id)

    if (errUpdate) {
      console.error('[posvenda-parar] erro ao atualizar:', errUpdate)
      return NextResponse.json({ ok: false, message: 'Erro ao parar atendimento' }, { status: 500 })
    }

    await supabase.from('atendimento_automatico_eventos').insert({
      sessao_id: id,
      tipo: 'finalizacao',
      descricao: 'Atendimento parado manualmente por administrador',
      metadata: { email: access.email },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[posvenda-parar] erro inesperado:', err)
    return NextResponse.json({ ok: false, message: 'Erro interno' }, { status: 500 })
  }
}
