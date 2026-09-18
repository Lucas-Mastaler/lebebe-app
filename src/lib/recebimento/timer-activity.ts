import { SupabaseClient } from '@supabase/supabase-js'
import { criarPausaSeNecessaria, PausaRevisavel } from './pausas-revisao'

/**
 * Janela de inatividade que pausa o timer automaticamente. Regra de negócio
 * sensível (AGENTS.md §7, rule de Recebimento) — não alterar sem decisão
 * humana explícita.
 */
export const JANELA_INATIVIDADE_MINUTOS = 5
const JANELA_INATIVIDADE_MS = JANELA_INATIVIDADE_MINUTOS * 60 * 1000

interface EstadoTimerParcial {
  timer_rodando: boolean
  timer_segundos_totais: number | null
  timer_ultima_acao: string | null
  ultima_atividade_conferencia: string | null
}

interface CalculoEncerramento {
  expirou: boolean
  timer_segundos_totais: number
  timer_ultima_acao: string
}

interface EstadoTimer {
  timer_rodando: boolean
  timer_segundos_totais: number
  timer_ultima_acao: string | null
}

interface ReconciliacaoResultado extends EstadoTimer {
  /** true somente quando ESTA chamada foi quem efetivamente pausou o timer agora. */
  pausadoAgora: boolean
  /** `ultima_atividade_conferencia` como estava ANTES desta chamada — usado para detectar pausas revisáveis (ver pausas-revisao.ts). */
  ultimaAtividadeAnterior: string | null
}

/**
 * Regra central e única de encerramento por inatividade.
 *
 * Se o timer está rodando e já se passaram >= 5 minutos desde
 * `ultima_atividade_conferencia`, o segmento ativo deve ser fechado
 * exatamente em `ultima_atividade_conferencia + 5min` — NUNCA em
 * `referencia`/`now()`. Isso garante que o atraso entre a expiração real da
 * janela e o momento em que a verificação de fato rodou (polling, aba em
 * segundo plano, navegador fechado por horas) nunca seja contado como tempo
 * ativo.
 *
 * Função pura — sem I/O — para ser testável isoladamente com datas
 * controladas.
 */
export function calcularEncerramentoPorInatividade(
  estado: EstadoTimerParcial,
  referencia: Date
): CalculoEncerramento {
  const totalAtual = estado.timer_segundos_totais || 0

  if (!estado.timer_rodando || !estado.timer_ultima_acao) {
    return {
      expirou: false,
      timer_segundos_totais: totalAtual,
      timer_ultima_acao: estado.timer_ultima_acao || referencia.toISOString(),
    }
  }

  const inicioSegmento = new Date(estado.timer_ultima_acao)
  const ultimaAtividade = new Date(estado.ultima_atividade_conferencia || estado.timer_ultima_acao)
  const limite = new Date(ultimaAtividade.getTime() + JANELA_INATIVIDADE_MS)

  if (referencia.getTime() < limite.getTime()) {
    // Ainda dentro da janela ativa — nada a reconciliar.
    return {
      expirou: false,
      timer_segundos_totais: totalAtual,
      timer_ultima_acao: estado.timer_ultima_acao,
    }
  }

  // Janela expirou: fecha o segmento no limite teórico, nunca no instante em
  // que a verificação rodou. Math.max evita negativo se timer_ultima_acao
  // por algum motivo já estiver depois do limite.
  const fimSegmento = limite.getTime() > inicioSegmento.getTime() ? limite : inicioSegmento
  const segundosSegmento = Math.max(0, Math.floor((fimSegmento.getTime() - inicioSegmento.getTime()) / 1000))

  return {
    expirou: true,
    timer_segundos_totais: totalAtual + segundosSegmento,
    timer_ultima_acao: fimSegmento.toISOString(),
  }
}

async function buscarEstadoTimer(
  supabase: SupabaseClient,
  recebimentoId: string
): Promise<EstadoTimerParcial | null> {
  const { data } = await supabase
    .from('recebimentos')
    .select('timer_rodando, timer_segundos_totais, timer_ultima_acao, ultima_atividade_conferencia')
    .eq('id', recebimentoId)
    .single()

  return (data as EstadoTimerParcial | null) ?? null
}

/**
 * Reconcilia o timer com a regra de inatividade: se o segmento ativo já
 * deveria ter sido pausado, fecha-o no limite correto e persiste.
 *
 * Idempotente — chamar várias vezes seguidas não acumula segundos
 * adicionais, porque uma vez pausado (`timer_rodando=false`) a função passa
 * a retornar sem alterar nada.
 *
 * Usa uma guarda otimista (`timer_ultima_acao` inalterado desde a leitura)
 * para não sobrescrever uma atividade real concorrente com um encerramento
 * por inatividade baseado em dado já obsoleto.
 */
export async function reconciliarInatividade(
  supabase: SupabaseClient,
  recebimentoId: string,
  referencia: Date = new Date()
): Promise<ReconciliacaoResultado | null> {
  const estado = await buscarEstadoTimer(supabase, recebimentoId)
  if (!estado) return null

  const calculo = calcularEncerramentoPorInatividade(estado, referencia)

  if (!calculo.expirou) {
    return {
      pausadoAgora: false,
      timer_rodando: estado.timer_rodando,
      timer_segundos_totais: estado.timer_segundos_totais || 0,
      timer_ultima_acao: estado.timer_ultima_acao,
      ultimaAtividadeAnterior: estado.ultima_atividade_conferencia,
    }
  }

  const { data: atualizado, error } = await supabase
    .from('recebimentos')
    .update({
      timer_rodando: false,
      timer_segundos_totais: calculo.timer_segundos_totais,
      timer_ultima_acao: calculo.timer_ultima_acao,
    })
    .eq('id', recebimentoId)
    .eq('timer_ultima_acao', estado.timer_ultima_acao as string)
    .select('id')

  if (error) {
    console.error('[LOG][TIMER] Erro ao reconciliar inatividade:', error)
    return {
      pausadoAgora: false,
      timer_rodando: estado.timer_rodando,
      timer_segundos_totais: estado.timer_segundos_totais || 0,
      timer_ultima_acao: estado.timer_ultima_acao,
      ultimaAtividadeAnterior: estado.ultima_atividade_conferencia,
    }
  }

  if (!atualizado || atualizado.length === 0) {
    // Uma atividade concorrente já mudou o timer entre a leitura e esta
    // escrita (ex.: check-inactivity e um clique de conferência quase
    // simultâneos) — não sobrescrever; relê o estado real em vez de assumir.
    const fresco = await buscarEstadoTimer(supabase, recebimentoId)
    console.log(`[LOG][TIMER] Reconciliação de inatividade abortada por concorrência no recebimento ${recebimentoId}`)
    return {
      pausadoAgora: false,
      timer_rodando: fresco?.timer_rodando ?? estado.timer_rodando,
      timer_segundos_totais: fresco?.timer_segundos_totais ?? (estado.timer_segundos_totais || 0),
      timer_ultima_acao: fresco?.timer_ultima_acao ?? estado.timer_ultima_acao,
      ultimaAtividadeAnterior: estado.ultima_atividade_conferencia,
    }
  }

  console.log(`[LOG][TIMER] Timer pausado por inatividade no recebimento ${recebimentoId} — encerrado em ${calculo.timer_ultima_acao}, total acumulado ${calculo.timer_segundos_totais}s`)

  return {
    pausadoAgora: true,
    timer_rodando: false,
    timer_segundos_totais: calculo.timer_segundos_totais,
    timer_ultima_acao: calculo.timer_ultima_acao,
    ultimaAtividadeAnterior: estado.ultima_atividade_conferencia,
  }
}

/**
 * Registra atividade de conferência e inicia/retoma o timer se necessário.
 * Deve ser chamada sempre que houver uma ação real de conferência (volume,
 * local, divergência, OS).
 *
 * Reconcilia primeiro: se o timer estava marcado como rodando mas já
 * deveria ter sido pausado por inatividade (ex.: aba fechada por horas),
 * fecha o segmento antigo no limite correto antes de iniciar um novo
 * segmento agora — o clique nunca "reabre" o intervalo abandonado.
 *
 * Também avalia (via pausas-revisao.ts) se a lacuna desde a última
 * atividade justifica uma pausa revisável (>15min sem interação). Se sim,
 * a pausa é criada ANTES de iniciar o novo segmento — a ação de conferência
 * em si (quantidade, local, OS) sempre é aplicada normalmente pelo chamador
 * em seguida; é o chamador quem decide, com base no retorno, se mostra o
 * modal ao operador.
 */
export async function registrarAtividadeConferencia(
  supabase: SupabaseClient,
  recebimentoId: string
): Promise<{ pausaCriada: PausaRevisavel | null }> {
  const now = new Date()
  const reconciliado = await reconciliarInatividade(supabase, recebimentoId, now)
  if (!reconciliado) return { pausaCriada: null }

  const pausaCriada = reconciliado.ultimaAtividadeAnterior
    ? await criarPausaSeNecessaria(
        supabase,
        recebimentoId,
        new Date(reconciliado.ultimaAtividadeAnterior),
        now,
        JANELA_INATIVIDADE_MS
      )
    : null

  if (!reconciliado.timer_rodando) {
    await supabase
      .from('recebimentos')
      .update({
        timer_rodando: true,
        timer_ultima_acao: now.toISOString(),
        ultima_atividade_conferencia: now.toISOString(),
      })
      .eq('id', recebimentoId)

    console.log(`[LOG][TIMER] Novo intervalo ativo iniciado no recebimento ${recebimentoId}`)
    return { pausaCriada }
  }

  // Já estava rodando dentro da janela ativa: só renova a marca de atividade,
  // preservando timer_ultima_acao/timer_segundos_totais do segmento em curso.
  await supabase
    .from('recebimentos')
    .update({ ultima_atividade_conferencia: now.toISOString() })
    .eq('id', recebimentoId)

  return { pausaCriada }
}

/**
 * Verifica inatividade e pausa o timer se necessário. Chamada
 * periodicamente pelo endpoint `check-inactivity`. Retorna true só quando
 * esta chamada foi quem efetivamente pausou o timer agora.
 */
export async function verificarInatividade(
  supabase: SupabaseClient,
  recebimentoId: string
): Promise<boolean> {
  const resultado = await reconciliarInatividade(supabase, recebimentoId)
  return resultado?.pausadoAgora ?? false
}

/**
 * Pausa manual (botão da tela). Reconcilia primeiro: se o segmento já havia
 * expirado por inatividade, o encerramento no limite correto prevalece e o
 * clique não soma tempo além dele. Caso contrário, encerra normalmente no
 * instante do clique.
 */
export async function pausarTimerManualmente(
  supabase: SupabaseClient,
  recebimentoId: string,
  referencia: Date = new Date()
): Promise<EstadoTimer | null> {
  const reconciliado = await reconciliarInatividade(supabase, recebimentoId, referencia)
  if (!reconciliado) return null

  if (!reconciliado.timer_rodando) {
    // Já estava pausado (ou acabou de ser pausado pela própria reconciliação
    // por inatividade) — nada a fazer, o estado já está correto.
    return reconciliado
  }

  const inicioSegmento = new Date(reconciliado.timer_ultima_acao as string)
  const elapsed = Math.max(0, Math.floor((referencia.getTime() - inicioSegmento.getTime()) / 1000))
  const novoTotal = reconciliado.timer_segundos_totais + elapsed

  await supabase
    .from('recebimentos')
    .update({
      timer_rodando: false,
      timer_segundos_totais: novoTotal,
      timer_ultima_acao: referencia.toISOString(),
    })
    .eq('id', recebimentoId)

  console.log(`[LOG][TIMER] Timer pausado manualmente no recebimento ${recebimentoId} — total ${novoTotal}s`)

  return { timer_rodando: false, timer_segundos_totais: novoTotal, timer_ultima_acao: referencia.toISOString() }
}

/**
 * Retomada manual (botão da tela). Sempre inicia um novo segmento a partir
 * de `referencia` — nunca reabre nem recalcula um segmento antigo já
 * contabilizado. Mantém a mesma intenção do comportamento anterior de
 * também atualizar `ultima_atividade_conferencia` ao retomar.
 */
export async function retomarTimerManualmente(
  supabase: SupabaseClient,
  recebimentoId: string,
  referencia: Date = new Date()
): Promise<EstadoTimer | null> {
  // Reconciliação defensiva: garante que nenhum tempo indevido de um
  // segmento antigo abandonado fique pendurado antes de abrir o novo.
  const reconciliado = await reconciliarInatividade(supabase, recebimentoId, referencia)
  const totalBase = reconciliado?.timer_segundos_totais ?? 0

  await supabase
    .from('recebimentos')
    .update({
      timer_rodando: true,
      timer_ultima_acao: referencia.toISOString(),
      ultima_atividade_conferencia: referencia.toISOString(),
    })
    .eq('id', recebimentoId)

  console.log(`[LOG][TIMER] Timer retomado manualmente no recebimento ${recebimentoId}`)

  return { timer_rodando: true, timer_segundos_totais: totalBase, timer_ultima_acao: referencia.toISOString() }
}

/**
 * Encerra o timer na finalização do recebimento, usando a mesma regra
 * central de inatividade, e retorna o tempo efetivo total em segundos para
 * ser usado no relatório (`tempo_total_formatado`).
 *
 * Não persiste `status`/`data_fim`/campos do timer — isso é feito pela rota
 * de finalização em uma única escrita combinada, para manter um único
 * ponto de gravação do estado final.
 */
export async function encerrarTimerParaFinalizacao(
  supabase: SupabaseClient,
  recebimentoId: string,
  referencia: Date
): Promise<number> {
  const reconciliado = await reconciliarInatividade(supabase, recebimentoId, referencia)
  if (!reconciliado) return 0

  if (!reconciliado.timer_rodando) {
    // Ou nunca esteve rodando, ou a reconciliação acima já fechou o
    // segmento obsoleto no limite correto — nada a somar além disso.
    return reconciliado.timer_segundos_totais
  }

  // Ainda legitimamente ativo no momento da finalização: fecha o segmento agora.
  const inicioSegmento = new Date(reconciliado.timer_ultima_acao as string)
  const elapsed = Math.max(0, Math.floor((referencia.getTime() - inicioSegmento.getTime()) / 1000))

  return reconciliado.timer_segundos_totais + elapsed
}
