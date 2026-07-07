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
    const now = new Date()
    const bloqueadoAte = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

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
      tipo: 'temporario_24h',
      motivo: 'Bloqueio temporario de 24h aplicado por administrador',
      bloqueado_por: access.email,
      bloqueado_ate: bloqueadoAte,
      ativo: true,
    })

    const { error: errUpdate } = await supabase
      .from('atendimento_automatico_sessoes')
      .update({
        status: 'bloqueado_24h',
        estado: 'bloqueado_24h',
        pausa_ate: bloqueadoAte,
        updated_at: now.toISOString(),
      })
      .eq('id', id)

    if (errUpdate) {
      console.error('[posvenda-bloquear-24h] erro ao atualizar:', errUpdate)
      return NextResponse.json({ ok: false, message: 'Erro ao bloquear sessao' }, { status: 500 })
    }

    await supabase.from('atendimento_automatico_eventos').insert({
      sessao_id: id,
      tipo: 'bloqueio',
      descricao: 'Bloqueio temporario de 24h aplicado por administrador',
      metadata: { email: access.email, bloqueado_ate: bloqueadoAte },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[posvenda-bloquear-24h] erro inesperado:', err)
    return NextResponse.json({ ok: false, message: 'Erro interno' }, { status: 500 })
  }
}
