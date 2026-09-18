import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Pausas revisáveis — camada adicional sobre o timer automático para o caso
 * em que o operador fica muito tempo sem interagir com o app mas pode ter
 * continuado trabalhando fisicamente (ver auditoria da tarefa). Não altera
 * a regra de 5 minutos do auto-pause (`timer-activity.ts`) — só decide se a
 * lacuna que sobrou depois dela merece ser perguntada ao operador.
 */
export const JANELA_REVISAO_PAUSA_MINUTOS = 15
const JANELA_REVISAO_PAUSA_MS = JANELA_REVISAO_PAUSA_MINUTOS * 60 * 1000

export type DecisaoPausa = 'trabalhando' | 'pausado' | 'editado'
export type StatusPausa = 'pendente' | 'revisado'

export interface PausaRevisavel {
  id: string
  recebimento_id: string
  ultima_atividade: string
  inicio_pausa: string
  fim_pausa: string
  duracao_pausa_segundos: number
  status: StatusPausa
  decisao: DecisaoPausa | null
  periodo_trabalhado_inicio: string | null
  periodo_trabalhado_fim: string | null
  created_at: string
  updated_at: string
}

interface AvaliacaoPausaRevisavel {
  ultimaAtividade: string
  inicioPausa: string
  fimPausa: string
  duracaoPausaSegundos: number
}

/**
 * Decide, de forma pura, se a lacuna entre duas atividades merece virar uma
 * pausa revisável.
 *
 * Regra (confirmada e testada explicitamente na fronteira):
 * - gap <= 15min → não cria (14m59s não cria; 15min exatos também NÃO cria —
 *   limite estritamente ">15min", diferente do limite de 5min do auto-pause,
 *   que já usa ">="; são dois limiares independentes, cada um com seu
 *   próprio boundary documentado e testado);
 * - gap > 15min → cria, com `inicio_pausa = ultimaAtividadeAnterior + 5min`
 *   (o mesmo limite já usado pelo auto-pause) e `fim_pausa = novaAtividade`.
 *   Os primeiros 5 minutos já pertencem ao timer automático — a pausa
 *   revisável nunca os inclui.
 *
 * `janelaAutoPauseMs` vem de `JANELA_INATIVIDADE_MINUTOS` em
 * `timer-activity.ts` (passado como parâmetro, não importado, para evitar
 * dependência circular entre os dois módulos — timer-activity.ts é quem
 * importa deste arquivo, não o contrário).
 */
export function avaliarPausaRevisavel(
  ultimaAtividadeAnterior: Date,
  novaAtividade: Date,
  janelaAutoPauseMs: number
): AvaliacaoPausaRevisavel | null {
  const gapMs = novaAtividade.getTime() - ultimaAtividadeAnterior.getTime()

  if (gapMs <= JANELA_REVISAO_PAUSA_MS) return null

  const inicioPausa = new Date(ultimaAtividadeAnterior.getTime() + janelaAutoPauseMs)
  const duracaoPausaSegundos = Math.floor((novaAtividade.getTime() - inicioPausa.getTime()) / 1000)

  if (duracaoPausaSegundos <= 0) return null

  return {
    ultimaAtividade: ultimaAtividadeAnterior.toISOString(),
    inicioPausa: inicioPausa.toISOString(),
    fimPausa: novaAtividade.toISOString(),
    duracaoPausaSegundos,
  }
}

/**
 * Cria a pausa revisável se a lacuna justificar, de forma idempotente: a
 * constraint `recebimento_pausas_gap_unico (recebimento_id, ultima_atividade)`
 * garante que duas requisições concorrentes fechando o mesmo gap não
 * duplicam a pendência — a segunda relê a pausa já criada pela primeira.
 */
export async function criarPausaSeNecessaria(
  supabase: SupabaseClient,
  recebimentoId: string,
  ultimaAtividadeAnterior: Date,
  novaAtividade: Date,
  janelaAutoPauseMs: number
): Promise<PausaRevisavel | null> {
  const avaliacao = avaliarPausaRevisavel(ultimaAtividadeAnterior, novaAtividade, janelaAutoPauseMs)
  if (!avaliacao) return null

  const { data, error } = await supabase
    .from('recebimento_pausas')
    .insert({
      recebimento_id: recebimentoId,
      ultima_atividade: avaliacao.ultimaAtividade,
      inicio_pausa: avaliacao.inicioPausa,
      fim_pausa: avaliacao.fimPausa,
      duracao_pausa_segundos: avaliacao.duracaoPausaSegundos,
      status: 'pendente',
    })
    .select('*')
    .single()

  if (error) {
    // 23505 = unique_violation — outra requisição concorrente já criou a
    // mesma pausa (mesmo recebimento + mesma ultima_atividade). Não é uma
    // falha real: é a guarda de idempotência funcionando. Relê a existente.
    if (error.code === '23505') {
      const { data: existente } = await supabase
        .from('recebimento_pausas')
        .select('*')
        .eq('recebimento_id', recebimentoId)
        .eq('ultima_atividade', avaliacao.ultimaAtividade)
        .single()
      return (existente as PausaRevisavel) ?? null
    }
    console.error('[LOG][PAUSA] Erro ao criar pausa revisável:', error)
    return null
  }

  console.log(`[LOG][PAUSA] Pausa revisável criada no recebimento ${recebimentoId}: ${avaliacao.inicioPausa} a ${avaliacao.fimPausa} (${avaliacao.duracaoPausaSegundos}s)`)

  return data as PausaRevisavel
}

/** Lista as pausas de um recebimento, mais antigas primeiro. */
export async function listarPausas(supabase: SupabaseClient, recebimentoId: string): Promise<PausaRevisavel[]> {
  const { data } = await supabase
    .from('recebimento_pausas')
    .select('*')
    .eq('recebimento_id', recebimentoId)
    .order('inicio_pausa', { ascending: true })

  return (data as PausaRevisavel[] | null) ?? []
}

export function existePausaPendente(pausas: Array<{ status: string }>): boolean {
  return pausas.some(p => p.status === 'pendente')
}

export interface PausaParaCalculo {
  status: string
  decisao: string | null
  duracao_pausa_segundos: number
  periodo_trabalhado_inicio: string | null
  periodo_trabalhado_fim: string | null
}

/**
 * Fonte ÚNICA da contribuição de uma pausa para o tempo oficial —
 * recalculada sempre a partir dos dados persistidos, nunca de um valor
 * derivado armazenado. Isso garante que mudar a decisão (SIM→NÃO→EDITADO,
 * quantas vezes for) nunca soma/subtrai incrementalmente: o valor é sempre
 * recomputado do zero.
 *
 * - `pendente` → 0 (ainda não decidida, não conta);
 * - `trabalhando` → duração integral da pausa;
 * - `pausado` → 0;
 * - `editado` → `periodo_trabalhado_fim - periodo_trabalhado_inicio`.
 */
export function calcularSegundosReintegrados(pausa: PausaParaCalculo): number {
  if (pausa.status !== 'revisado') return 0

  if (pausa.decisao === 'trabalhando') return pausa.duracao_pausa_segundos

  if (pausa.decisao === 'pausado') return 0

  if (pausa.decisao === 'editado' && pausa.periodo_trabalhado_inicio && pausa.periodo_trabalhado_fim) {
    const segundos = Math.floor(
      (new Date(pausa.periodo_trabalhado_fim).getTime() - new Date(pausa.periodo_trabalhado_inicio).getTime()) / 1000
    )
    return Math.max(0, segundos)
  }

  return 0
}

/** Soma a contribuição de todas as pausas — a única forma de obter o total reintegrado. */
export function somarSegundosReintegrados(pausas: PausaParaCalculo[]): number {
  return pausas.reduce((soma, pausa) => soma + calcularSegundosReintegrados(pausa), 0)
}

export interface RecebimentoParaTempoExibido {
  status: string
  timer_segundos_totais: number | null
  timer_rodando: boolean
  timer_ultima_acao: string | null
  pausas: PausaParaCalculo[]
}

/**
 * Fonte única do tempo mostrado na tela de conferência — usada tanto
 * enquanto o recebimento está aberto quanto depois de fechado.
 *
 * ABERTO: `timer_segundos_totais` (automático) + pausas já revisadas
 * (recalculado sempre do zero, nunca de valor persistido) + trecho ativo
 * atual, quando o timer estiver rodando.
 *
 * FECHADO/CANCELADO: `timer_segundos_totais` já é a duração oficial
 * consolidada pelo bake-in único da finalização (automático + pausas
 * reintegradas, gravado uma vez só ali). As linhas de `recebimento_pausas`
 * continuam existindo depois (histórico/rastreabilidade), mas somar sua
 * contribuição de novo aqui duplicaria o tempo — por isso, uma vez fechado,
 * o valor é só `timer_segundos_totais`, direto, sem somar pausas de novo.
 */
export function calcularTempoExibido(
  recebimento: RecebimentoParaTempoExibido,
  referencia: Date = new Date()
): number {
  const automatico = recebimento.timer_segundos_totais || 0

  if (recebimento.status !== 'aberto') {
    return automatico
  }

  const pausasReintegradas = somarSegundosReintegrados(recebimento.pausas || [])

  let trechoAtivo = 0
  if (recebimento.timer_rodando && recebimento.timer_ultima_acao) {
    trechoAtivo = Math.max(
      0,
      Math.floor((referencia.getTime() - new Date(recebimento.timer_ultima_acao).getTime()) / 1000)
    )
  }

  return automatico + pausasReintegradas + trechoAtivo
}

export interface EdicaoPeriodoInput {
  inicio: string | null | undefined
  fim: string | null | undefined
}

export type ResultadoValidacaoPeriodo =
  | { valido: true; inicioIso: string; fimIso: string }
  | { valido: false; erro: string }

/**
 * Valida o período editado manualmente para a opção "EDITAR PERÍODO":
 * início e fim obrigatórios e válidos, fim > início, e o intervalo inteiro
 * dentro de `[inicio_pausa, fim_pausa]` — nunca antes nem depois da janela
 * real da pausa.
 */
export function validarPeriodoTrabalhadoEditado(
  pausa: { inicio_pausa: string; fim_pausa: string },
  input: EdicaoPeriodoInput
): ResultadoValidacaoPeriodo {
  if (!input.inicio) return { valido: false, erro: 'Informe o início do período trabalhado.' }
  if (!input.fim) return { valido: false, erro: 'Informe o fim do período trabalhado.' }

  const inicio = new Date(input.inicio)
  const fim = new Date(input.fim)

  if (Number.isNaN(inicio.getTime())) return { valido: false, erro: 'Início do período inválido.' }
  if (Number.isNaN(fim.getTime())) return { valido: false, erro: 'Fim do período inválido.' }
  if (fim.getTime() <= inicio.getTime()) {
    return { valido: false, erro: 'O fim precisa ser posterior ao início.' }
  }

  const janelaInicio = new Date(pausa.inicio_pausa).getTime()
  const janelaFim = new Date(pausa.fim_pausa).getTime()

  if (inicio.getTime() < janelaInicio || fim.getTime() > janelaFim) {
    return { valido: false, erro: 'O período informado precisa estar dentro da janela da pausa.' }
  }

  return { valido: true, inicioIso: inicio.toISOString(), fimIso: fim.toISOString() }
}

export interface AplicarDecisaoInput {
  decisao: DecisaoPausa
  periodoInicio?: string | null
  periodoFim?: string | null
}

export type ResultadoAplicarDecisao =
  | { ok: true; pausa: PausaRevisavel }
  | { ok: false; erro: string }

/**
 * Aplica (ou muda) a decisão do operador sobre uma pausa. Sempre uma
 * sobrescrita completa da linha — nunca soma/subtrai de um total externo —
 * então mudar de decisão quantas vezes for é seguro e idempotente.
 */
export async function aplicarDecisaoPausa(
  supabase: SupabaseClient,
  recebimentoId: string,
  pausaId: string,
  input: AplicarDecisaoInput
): Promise<ResultadoAplicarDecisao> {
  const { data: pausa } = await supabase
    .from('recebimento_pausas')
    .select('*')
    .eq('id', pausaId)
    .eq('recebimento_id', recebimentoId)
    .single()

  if (!pausa) return { ok: false, erro: 'Pausa não encontrada.' }

  const updateData: Record<string, unknown> = {
    status: 'revisado',
    decisao: input.decisao,
    updated_at: new Date().toISOString(),
  }

  if (input.decisao === 'editado') {
    const validacao = validarPeriodoTrabalhadoEditado(pausa, { inicio: input.periodoInicio, fim: input.periodoFim })
    if (!validacao.valido) return { ok: false, erro: validacao.erro }
    updateData.periodo_trabalhado_inicio = validacao.inicioIso
    updateData.periodo_trabalhado_fim = validacao.fimIso
  } else {
    // trabalhando/pausado não usam período customizado — limpa resíduo de
    // uma edição anterior, se o operador mudou de EDITADO para SIM/NÃO.
    updateData.periodo_trabalhado_inicio = null
    updateData.periodo_trabalhado_fim = null
  }

  const { data: atualizada, error } = await supabase
    .from('recebimento_pausas')
    .update(updateData)
    .eq('id', pausaId)
    .eq('recebimento_id', recebimentoId)
    .select('*')
    .single()

  if (error || !atualizada) {
    console.error('[LOG][PAUSA] Erro ao aplicar decisão:', error)
    return { ok: false, erro: 'Erro ao salvar a decisão.' }
  }

  console.log(`[LOG][PAUSA] Pausa ${pausaId} do recebimento ${recebimentoId} marcada como "${input.decisao}"`)

  return { ok: true, pausa: atualizada as PausaRevisavel }
}
