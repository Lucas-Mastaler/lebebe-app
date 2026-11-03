import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { registrarAtividadeConferencia } from '@/lib/recebimento/timer-activity'
import type { PausaRevisavel } from '@/lib/recebimento/pausas-revisao'

export interface ResultadoConferencia {
  volumes: Array<{ id: string; volume_numero: number; qtd_prevista: number; qtd_recebida: number }>
  item_total_recebido: number
  item_total_previsto: number
  item_status: string
}

// Both operations share the database transaction/row lock. Do not replay deltas
// to complete an item, or write only its cached total.
export async function conferirVolumes(
  recebimentoId: string,
  itemId: string,
  alteracao?: { volumeNumero: number; delta: number },
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('conferir_recebimento_item', {
    p_recebimento_id: recebimentoId,
    p_item_id: itemId,
    p_volume_numero: alteracao?.volumeNumero ?? null,
    p_delta: alteracao?.delta ?? null,
  })
  if (error) {
    const mensagens: Record<string, { status: number; mensagem: string }> = {
      PT403: { status: 403, mensagem: 'Acesso negado' },
      PT404: { status: 404, mensagem: 'Produto ou volume não encontrado neste recebimento.' },
      PT409: { status: 409, mensagem: 'Recebimento não está aberto.' },
      PT422: { status: 422, mensagem: 'Revise a configuração dos volumes deste produto antes de conferir.' },
      PT400: { status: 400, mensagem: 'Quantidade fora dos limites previstos.' },
    }
    const falha = mensagens[error.code]
    if (!falha) console.error('[RECEBIMENTO] Falha na conferência de volumes', { recebimentoId, itemId, error })
    return NextResponse.json(
      { error: falha?.mensagem ?? 'Não foi possível salvar a conferência. Consulte o estado do produto antes de tentar novamente.' },
      { status: falha?.status ?? 500 },
    )
  }

  const resultado = data as ResultadoConferencia
  const volume = alteracao && resultado.volumes.find(v => v.volume_numero === alteracao.volumeNumero)
  // Quantities are committed. Never report a retryable failure for an already
  // saved delta just because activity registration failed afterwards.
  let pausaCriada: PausaRevisavel | null = null
  try {
    const atividade = await registrarAtividadeConferencia(supabase, recebimentoId)
    pausaCriada = atividade.pausaCriada
  } catch (error) {
    console.error('[RECEBIMENTO] Conferência salva; falha ao registrar atividade', { recebimentoId, itemId, error })
  }
  return NextResponse.json({
    ...resultado,
    ...(volume ? { volume_numero: volume.volume_numero, qtd_recebida: volume.qtd_recebida, qtd_prevista: volume.qtd_prevista } : {}),
    pausa_criada: pausaCriada,
  })
}
