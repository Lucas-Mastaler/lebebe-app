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

    if (sessao.digisac_contact_id) {
      const { error: errDesbloquear } = await supabase
        .from('atendimento_automatico_bloqueios')
        .update({ ativo: false, updated_at: now })
        .eq('digisac_contact_id', sessao.digisac_contact_id)
        .eq('ativo', true)

      if (errDesbloquear) {
        console.error('[posvenda-desbloquear] erro ao desativar bloqueios:', errDesbloquear)
        return NextResponse.json({ ok: false, message: 'Erro ao desbloquear cliente' }, { status: 500 })
      }
    }

    const { error: errUpdate } = await supabase
      .from('atendimento_automatico_sessoes')
      .update({
        status: 'ativa',
        estado: 'inicio',
        bloqueio_permanente: false,
        pausa_ate: null,
        updated_at: now,
      })
      .eq('id', id)

    if (errUpdate) {
      console.error('[posvenda-desbloquear] erro ao atualizar sessao:', errUpdate)
      return NextResponse.json({ ok: false, message: 'Erro ao atualizar sessao' }, { status: 500 })
    }

    await supabase.from('atendimento_automatico_eventos').insert({
      sessao_id: id,
      tipo: 'desbloqueio',
      descricao: 'Cliente desbloqueado por administrador',
      metadata: { email: access.email },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[posvenda-desbloquear] erro inesperado:', err)
    return NextResponse.json({ ok: false, message: 'Erro interno' }, { status: 500 })
  }
}
