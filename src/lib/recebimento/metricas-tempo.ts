/**
 * Limite de plausibilidade para métricas de TEMPO do módulo de Recebimento.
 * O recebimento real mais demorado da operação chega a ~8h; 12h dá margem
 * para exceções sem aceitar valores claramente irreais. Acima disso, o
 * recebimento é excluído do cálculo — nunca arredondado para 12h.
 *
 * Aplica-se sobre a duração efetivamente usada pela métrica (ver
 * `obterDuracaoFinalDoRecebimento`), não sempre sobre o tempo corrido bruto.
 *
 * Não alterar sem nova decisão de negócio (ver auditoria do timer de
 * Recebimento).
 */
export const LIMITE_TEMPO_RECEBIMENTO_HORAS = 12
export const LIMITE_TEMPO_RECEBIMENTO_SEGUNDOS = LIMITE_TEMPO_RECEBIMENTO_HORAS * 60 * 60

/**
 * DECISÃO PENDENTE DE DEPLOY — NÃO preencher com uma data adivinhada.
 *
 * A partir deste instante (UTC), a finalização passa a gravar
 * `timer_segundos_totais` já reconciliado pela regra corrigida do timer
 * (ver `src/lib/recebimento/timer-activity.ts`) — nesse ponto ele se torna
 * fonte confiável de tempo efetivo. Antes disso, `timer_segundos_totais`
 * pode estar zerado, parcial ou nunca ter pausado (bug histórico já
 * confirmado na auditoria) e não deve ser usado para métricas.
 *
 * Não existe, nos dados atuais, um jeito seguro de inferir esse corte
 * automaticamente: `timer_segundos_totais > 0`, `timer_rodando = false` e a
 * presença de `ultima_atividade_conferencia` já existiam antes da correção
 * e aparecem em registros antigos não confiáveis, então não diferenciam
 * corretamente histórico de novo.
 *
 * Enquanto este valor for `null`, TODOS os recebimentos (novos e antigos)
 * usam a fonte histórica (`data_fim - data_inicio`) — é o comportamento
 * seguro por padrão, idêntico ao que já existia. Ajustar para a
 * data/hora real em que esta correção do timer entrar em produção
 * (deploy), e só então recebimentos CRIADOS (`data_inicio`) a partir desse
 * instante passam a usar o tempo efetivo do timer nas métricas — um
 * recebimento aberto antes do deploy e finalizado depois continua usando a
 * fonte histórica, porque parte da sua vida rodou sob o timer antigo (ver
 * `timerCorrigidoAplicavel`).
 */
export const CORTE_TIMER_CORRIGIDO: Date | null = null

export interface RecebimentoParaMetricaTempo {
  data_inicio: string | null
  data_fim: string | null
  timer_segundos_totais: number | null
  /** true quando o operador confirmou manualmente início/fim reais no fallback de finalização (>12h). */
  tempo_correcao_manual?: boolean | null
}

/** Duração em horas entre duas datas ISO/Date. */
export function duracaoEmHoras(dataInicio: string | Date, dataFim: string | Date): number {
  const inicio = dataInicio instanceof Date ? dataInicio : new Date(dataInicio)
  const fim = dataFim instanceof Date ? dataFim : new Date(dataFim)
  return (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60)
}

/** true se a duração (em horas) é plausível o suficiente para entrar em métricas de tempo. */
export function tempoValidoParaMetricas(horas: number): boolean {
  return horas <= LIMITE_TEMPO_RECEBIMENTO_HORAS
}

/**
 * true se este recebimento foi CRIADO (`data_inicio`) depois do corte do
 * timer corrigido — ou seja, se `timer_segundos_totais` é fonte confiável
 * para ele.
 *
 * Deliberadamente usa `data_inicio`, não `data_fim`: um recebimento aberto
 * antes do deploy e finalizado depois carregaria, em parte, o
 * comportamento antigo do timer (e possivelmente um `timer_segundos_totais`
 * já contaminado por esse trecho) — classificá-lo pela data de término
 * marcaria erroneamente esse caso como "novo confiável". Exigir que o
 * recebimento tenha sido criado inteiramente sob a correção evita essa
 * janela de transição.
 *
 * `corte` é parametrizável só para permitir testar os dois cenários sem
 * depender de mutar a constante global.
 */
export function timerCorrigidoAplicavel(
  recebimento: RecebimentoParaMetricaTempo,
  corte: Date | null = CORTE_TIMER_CORRIGIDO
): boolean {
  if (!corte || !recebimento.data_inicio) return false
  return new Date(recebimento.data_inicio).getTime() >= corte.getTime()
}

/**
 * Fonte ÚNICA da duração final de um recebimento — usada igualmente por
 * finalização, planilha e dashboard/métricas, para que nunca mostrem
 * números diferentes para o mesmo recebimento. Prioridade:
 *
 * 1. Correção manual válida (`tempo_correcao_manual=true`, fallback de
 *    finalização quando o tempo automático passou de 12h — ver
 *    `src/lib/recebimento/correcao-manual-tempo.ts`): usa
 *    `timer_segundos_totais`, que nesse caso já foi sobrescrito na
 *    finalização com `fim_manual - inicio_manual` — é a duração oficial,
 *    não o valor automático problemático.
 * 2. Recebimento novo (criado a partir de `CORTE_TIMER_CORRIGIDO` — ver
 *    `timerCorrigidoAplicavel`): tempo efetivo já consolidado pelo timer na
 *    finalização (`timer_segundos_totais`).
 * 3. Recebimento histórico (criado antes do corte, ou corte ainda não
 *    definido): tempo corrido (`data_fim - data_inicio`) —
 *    `timer_segundos_totais` histórico não é confiável (auditoria já
 *    encontrou registros onde o timer nunca pausou ou não acumulou
 *    corretamente) e nunca é usado aqui.
 *
 * Retorna `null` quando não há dados suficientes (recebimento sem
 * `data_fim`, por exemplo, ainda aberto).
 */
export function obterDuracaoFinalDoRecebimento(
  recebimento: RecebimentoParaMetricaTempo,
  corte: Date | null = CORTE_TIMER_CORRIGIDO
): number | null {
  if (!recebimento.data_inicio || !recebimento.data_fim) return null

  if (recebimento.tempo_correcao_manual) {
    return (recebimento.timer_segundos_totais || 0) / 3600
  }

  if (timerCorrigidoAplicavel(recebimento, corte)) {
    return (recebimento.timer_segundos_totais || 0) / 3600
  }

  return duracaoEmHoras(recebimento.data_inicio, recebimento.data_fim)
}

export interface MetricasTempo {
  tempoMedio: number
  tempoTotal: number
  quantidadeValida: number
  quantidadeExcluida: number
}

/**
 * Calcula tempo médio/total de uma lista de recebimentos, decidindo a
 * duração de cada um via `obterDuracaoFinalDoRecebimento` (correção manual >
 * timer novo > histórico) e ignorando COMPLETAMENTE (não recorta para o
 * limite) qualquer resultado que ultrapasse `LIMITE_TEMPO_RECEBIMENTO_HORAS`.
 * Uma correção manual válida já foi validada como <=12h na finalização, então
 * nunca é excluída aqui — mas o filtro roda do mesmo jeito, por defesa em
 * profundidade. Não afeta nenhuma outra métrica (quantidade, peso, volumes,
 * etc.) — só tempo.
 */
export function calcularMetricasDeTempo(
  recebimentos: RecebimentoParaMetricaTempo[],
  corte: Date | null = CORTE_TIMER_CORRIGIDO
): MetricasTempo {
  const duracoes = recebimentos
    .map(r => obterDuracaoFinalDoRecebimento(r, corte))
    .filter((h): h is number => h !== null)

  const validas = duracoes.filter(tempoValidoParaMetricas)
  const tempoTotal = validas.reduce((sum, h) => sum + h, 0)
  const tempoMedio = validas.length > 0 ? tempoTotal / validas.length : 0

  return {
    tempoMedio,
    tempoTotal,
    quantidadeValida: validas.length,
    quantidadeExcluida: duracoes.length - validas.length,
  }
}
