import { LIMITE_TEMPO_RECEBIMENTO_SEGUNDOS } from './metricas-tempo'

/**
 * Fallback manual de duração — usado na finalização de `/recebimento/[id]`
 * quando o tempo efetivo calculado pelo timer (automático, já reconciliado
 * pela regra de inatividade) ultrapassa `LIMITE_TEMPO_RECEBIMENTO_SEGUNDOS`
 * (12h). Nesse caso o operador confirma manualmente o início/fim reais da
 * conferência, e essa duração passa a ser a oficial do recebimento — ver
 * `obterDuracaoFinalDoRecebimento` em `metricas-tempo.ts`.
 */

/** true quando o tempo automático (já reconciliado) exige confirmação manual antes de finalizar. */
export function precisaCorrecaoManual(segundosAutomaticos: number): boolean {
  return segundosAutomaticos > LIMITE_TEMPO_RECEBIMENTO_SEGUNDOS
}

export interface CorrecaoManualInput {
  inicio: string | null | undefined
  fim: string | null | undefined
}

export type ResultadoValidacaoCorrecaoManual =
  | { valido: true; segundos: number; inicioIso: string; fimIso: string }
  | { valido: false; erro: string }

/**
 * Valida a correção manual de início/fim informada pelo operador.
 *
 * Regras (todas conferidas no backend — o frontend nunca decide sozinho):
 * - início e fim obrigatórios e representando datas válidas;
 * - fim estritamente posterior ao início (sem duração zero/negativa);
 * - a duração resultante também precisa respeitar o limite de 12h — o
 *   fallback existe para corrigir um valor irreal, não para aceitar outro
 *   igualmente irreal. Não há regra de negócio que autorize um recebimento
 *   real acima de 12h nesta operação (o caso mais demorado conhecido chega
 *   a ~8h), então tratamos >12h manual como entrada inválida, com mensagem
 *   clara para o operador corrigir.
 */
export function validarCorrecaoManual(input: CorrecaoManualInput): ResultadoValidacaoCorrecaoManual {
  if (!input.inicio) {
    return { valido: false, erro: 'Informe a data e o horário reais de início da conferência.' }
  }
  if (!input.fim) {
    return { valido: false, erro: 'Informe a data e o horário reais de término da conferência.' }
  }

  const inicio = new Date(input.inicio)
  const fim = new Date(input.fim)

  if (Number.isNaN(inicio.getTime())) {
    return { valido: false, erro: 'Data/horário de início inválido.' }
  }
  if (Number.isNaN(fim.getTime())) {
    return { valido: false, erro: 'Data/horário de término inválido.' }
  }

  const segundos = Math.floor((fim.getTime() - inicio.getTime()) / 1000)

  if (segundos <= 0) {
    return { valido: false, erro: 'O horário de término precisa ser posterior ao horário de início.' }
  }

  if (segundos > LIMITE_TEMPO_RECEBIMENTO_SEGUNDOS) {
    return {
      valido: false,
      erro: 'A duração informada também ultrapassa 12 horas. Confirme os horários reais de início e término da conferência — recebimentos acima de 12h fogem do padrão esperado da operação.',
    }
  }

  return { valido: true, segundos, inicioIso: inicio.toISOString(), fimIso: fim.toISOString() }
}
