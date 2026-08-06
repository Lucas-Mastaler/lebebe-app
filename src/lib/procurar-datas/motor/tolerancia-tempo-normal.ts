// ─────────────────────────────────────────────────────────────────────────────
// motor/tolerancia-tempo-normal.ts  —  Tolerância de tempo para candidatos NORMAL
//
// Decide se um candidato com tempo disponível insuficiente pode ser aceito
// mediante tolerância de até 30 minutos, restrita à classificação NORMAL e
// apenas em dias úteis que não sejam quarta-feira nem sábado.
//
// Regra aprovada:
//   - Tempo suficiente → sem tolerância (fluxo normal)
//   - Tempo insuficiente + classificação NORMAL + não quarta + não sábado
//     + falta > 0 + falta <= 30 → aplica tolerância
//   - Demais casos → não aplica
//
// NÃO FAZ:
//   - Consulta agenda, planilha, Supabase, OSRM, Apps Script, Google Calendar
//   - Não recalcula classificação de distância (recebe o tipo já determinado)
//   - Não muta o objeto de entrada
//   - Não lança erros — problemas são sinalizados via `motivo`
//
// Unidades:
//   - disponivelMin, tempoNecessarioMin, diferencaMin → minutos (inteiros)
//
// Totalmente determinístico — sem I/O, sem logs.
// ─────────────────────────────────────────────────────────────────────────────

import type { TipoClassificacaoCandidatoV2 } from './classificacao-candidato'

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Tolerância máxima em minutos (inclusiva: 30 aceita, 31 rejeita). */
export const TOLERANCIA_TEMPONORMAL_MAX_MIN = 30

/** diaSemana que bloqueia tolerância: quarta-feira. */
const DIA_SEMANA_QUARTA = 3

/** diaSemana que bloqueia tolerância: sábado. */
const DIA_SEMANA_SABADO = 6

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Entrada para verificação de tolerância de tempo. */
export interface VerificarToleranciaTempoNormalInput {
  /** Flag de suficiência já calculada pelo filtro de disponibilidade. */
  suficienteParaServico: boolean
  /**
   * Tempo disponível real da equipe na data (minutos).
   * Deve ser o mesmo valor que originou `suficienteParaServico`.
   */
  disponivelMin: number
  /** Tempo necessário do serviço (minutos). */
  tempoNecessarioMin: number | null
  /** Dia da semana (0=domingo, 3=quarta, 6=sábado). Derivado de getUTCDay(). */
  diaSemana: number
  /** Classificação de distância já determinada. */
  tipoClassificacao: TipoClassificacaoCandidatoV2
}

/** Saída da verificação de tolerância de tempo. */
export interface VerificarToleranciaTempoNormalOutput {
  /** true se a tolerância se aplica e o candidato pode ser aceito. */
  aplicaTolerancia: boolean
  /** Diferença em minutos (tempoNecessarioMin - disponivelMin). Positivo = falta. */
  diferencaMin: number
  /** Motivo humano-legível da decisão. */
  motivo: string
}

// ─── Função principal ────────────────────────────────────────────────────────

/**
 * Decide se a tolerância de tempo se aplica a um candidato.
 *
 * Regras (ordem de verificação):
 *   1. Tempo suficiente → não aplica (não há o que tolerar)
 *   2. tempoNecessarioMin ausente/inválido → não aplica
 *   3. disponivelMin ausente/inválido → não aplica
 *   4. Quarta-feira (diaSemana === 3) → não aplica
 *   5. Sábado (diaSemana === 6) → não aplica
 *   6. Classificação ≠ normal → não aplica
 *   7. diferencaMin <= 0 → não aplica (tempo suficiente, não deveria chegar aqui)
 *   8. diferencaMin > 30 → não aplica (excede limite)
 *   9. diferencaMin <= 30 → aplica
 *
 * Não lança erros. Não muta o objeto de entrada. Totalmente determinística.
 */
export function verificarToleranciaTempoNormal(
  input: VerificarToleranciaTempoNormalInput
): VerificarToleranciaTempoNormalOutput {
  // 1. Tempo suficiente — tolerância não necessária
  if (input.suficienteParaServico === true) {
    return {
      aplicaTolerancia: false,
      diferencaMin: 0,
      motivo: 'Tempo suficiente, tolerância não necessária.',
    }
  }

  // 2. tempoNecessarioMin ausente/inválido
  if (
    input.tempoNecessarioMin === null ||
    !Number.isFinite(input.tempoNecessarioMin)
  ) {
    return {
      aplicaTolerancia: false,
      diferencaMin: 0,
      motivo: 'Tempo necessário ausente ou inválido para tolerância.',
    }
  }

  // 3. disponivelMin ausente/inválido
  if (
    input.disponivelMin === null ||
    !Number.isFinite(input.disponivelMin)
  ) {
    return {
      aplicaTolerancia: false,
      diferencaMin: 0,
      motivo: 'Tempo disponível ausente ou inválido para tolerância.',
    }
  }

  // 4. Quarta-feira — bloqueia tolerância
  if (input.diaSemana === DIA_SEMANA_QUARTA) {
    return {
      aplicaTolerancia: false,
      diferencaMin: input.tempoNecessarioMin - input.disponivelMin,
      motivo: 'Quarta-feira não permite tolerância de tempo.',
    }
  }

  // 5. Sábado — bloqueia tolerância
  if (input.diaSemana === DIA_SEMANA_SABADO) {
    return {
      aplicaTolerancia: false,
      diferencaMin: input.tempoNecessarioMin - input.disponivelMin,
      motivo: 'Sábado não permite tolerância de tempo.',
    }
  }

  // 6. Classificação ≠ normal — tolerância exclusiva de NORMAL
  if (input.tipoClassificacao !== 'normal') {
    return {
      aplicaTolerancia: false,
      diferencaMin: input.tempoNecessarioMin - input.disponivelMin,
      motivo: `Tolerância exclusiva de NORMAL (classificação atual: ${input.tipoClassificacao}).`,
    }
  }

  // 7-9. Diferença de tempo
  const diferencaMin = input.tempoNecessarioMin - input.disponivelMin

  // 7. diferencaMin <= 0 — tempo suficiente (não deveria chegar aqui, mas defensivo)
  if (diferencaMin <= 0) {
    return {
      aplicaTolerancia: false,
      diferencaMin,
      motivo: 'Tempo disponível é suficiente (diferença <= 0).',
    }
  }

  // 8. diferencaMin > 30 — excede limite
  if (diferencaMin > TOLERANCIA_TEMPONORMAL_MAX_MIN) {
    return {
      aplicaTolerancia: false,
      diferencaMin,
      motivo: `Diferença de ${diferencaMin}min excede limite de ${TOLERANCIA_TEMPONORMAL_MAX_MIN}min.`,
    }
  }

  // 9. diferencaMin <= 30 — aplica tolerância
  return {
    aplicaTolerancia: true,
    diferencaMin,
    motivo: `Tolerância de ${diferencaMin}min aplicada (classificação NORMAL, dia útil não-quarta).`,
  }
}
