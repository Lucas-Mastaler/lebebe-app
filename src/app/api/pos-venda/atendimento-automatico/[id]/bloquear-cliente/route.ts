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
      .select('id, digisac_contact_id, telefone')
      .eq('id', id)
      .maybeSingle()

    if (errBusca || !sessao) {
      return NextResponse.json({ ok: false, message: 'Sessao nao encontrada' }, { status: 404 })
    }

    await supabase.from('atendimento_automatico_bloqueios').insert({
      digisac_contact_id: sessao.digisac_contact_id,
      telefone: sessao.telefone,
      tipo: 'permanente',
      motivo: 'Bloqueio permanente aplicado por administrador',
      bloqueado_por: access.email,
      ativo: true,
    })

    const { error: errUpdate } = await supabase
      .from('atendimento_automatico_sessoes')
      .update({
        status: 'bloqueado_permanente',
        estado: 'bloqueado_permanente',
        bloqueio_permanente: true,
        updated_at: now,
      })
      .eq('id', id)

    if (errUpdate) {
      console.error('[posvenda-bloquear-cliente] erro ao atualizar:', errUpdate)
      return NextResponse.json({ ok: false, message: 'Erro ao bloquear cliente' }, { status: 500 })
    }

    await supabase.from('atendimento_automatico_eventos').insert({
      sessao_id: id,
      tipo: 'bloqueio',
      descricao: 'Bloqueio permanente aplicado por administrador',
      metadata: { email: access.email },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[posvenda-bloquear-cliente] erro inesperado:', err)
    return NextResponse.json({ ok: false, message: 'Erro interno' }, { status: 500 })
  }
}
