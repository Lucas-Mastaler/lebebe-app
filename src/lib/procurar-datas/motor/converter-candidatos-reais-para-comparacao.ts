// ─────────────────────────────────────────────────────────────────────────────
// motor/converter-candidatos-reais-para-comparacao.ts
//
// Helper puro: converte candidatos v2 reais (CandidatoPreliminarV2[])
// para formato de comparação (CandidatoComparacaoLegadoV2[]).
//
// Usado na rota diagnóstica quando fonteV2ComparacaoDiagnostico = 'disponibilidade-real'.
//
// Escopo: exclusivamente diagnóstico.
//
// NÃO FAZ:
//   - Não lê planilha, Supabase, Apps Script, OSRM, Google Calendar
//   - Não recalcula nenhum campo
//   - Não gera comparacaoKey (isso é feito por gerarComparacaoKeyV2Diagnostico)
//   - Não muta entrada
//   - Não lança erros
// ─────────────────────────────────────────────────────────────────────────────

import type { CandidatoPreliminarV2 } from './candidato'
import type { CandidatoComparacaoLegadoV2 } from './comparacao-legado-v2'

// ─── Tipos ───────────────────────────────────────────────────────────────────

/**
 * Entrada para converterCandidatosReaisParaComparacaoV2.
 */
export interface ConverterCandidatosReaisParaComparacaoV2Input {
  /** Candidatos reais já ordenados por gerarCandidatosComDisponibilidadeRealV2(). */
  candidatosReais: CandidatoPreliminarV2[]
}

/**
 * Saída de converterCandidatosReaisParaComparacaoV2.
 */
export interface ConverterCandidatosReaisParaComparacaoV2Output {
  ok: boolean
  /** Quantidade de candidatos recebidos no input. */
  quantidadeRecebida: number
  /** Quantidade de candidatos convertidos. */
  quantidadeConvertida: number
  /** Candidatos convertidos para formato de comparação. */
  candidatos: CandidatoComparacaoLegadoV2[]
  /** Avisos acumulados. */
  avisos: string[]
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Converte candidatos v2 reais para formato de comparação legado × v2.
 *
 * Regras:
 *   - Mapeia campos do CandidatoPreliminarV2 para CandidatoComparacaoLegadoV2
 *   - Preserva dataISO, equipe, tipo, elegivel, horaMarcada, etc.
 *   - ordem é atribuído sequencialmente (1, 2, 3, …)
 *   - Não gera comparacaoKey (feito posteriormente por gerarComparacaoKeyV2Diagnostico)
 *   - ok: false apenas se candidatosReais não for array válido
 *   - Não faz I/O, não lança erros
 */
export function converterCandidatosReaisParaComparacaoV2(
  input: ConverterCandidatosReaisParaComparacaoV2Input
): ConverterCandidatosReaisParaComparacaoV2Output {
  const avisos: string[] = []

  // Garante que o input é válido
  if (!Array.isArray(input.candidatosReais)) {
    return {
      ok: false,
      quantidadeRecebida: 0,
      quantidadeConvertida: 0,
      candidatos: [],
      avisos: ['Input candidatosReais não é um array válido.'],
    }
  }

  const candidatosRecebidos = input.candidatosReais
  const quantidadeRecebida = candidatosRecebidos.length

  if (quantidadeRecebida === 0) {
    avisos.push('Nenhum candidato real recebido para conversão.')
  }

  // Converte cada candidato
  const candidatosConvertidos: CandidatoComparacaoLegadoV2[] = candidatosRecebidos.map(
    (candidato, idx) => {
      // Limites propagados da classificação para o candidato
      const limiteBaseM = candidato.limites?.limiteBaseM ?? null
      const limiteEspecialM = candidato.limites?.limiteEspecialM ?? null
      const limitePremiumM = candidato.limites?.limitePremiumM ?? null

      // Determinar fonte dos limites baseado em slotTemPontos
      const slotTemPontos = candidato.slotTemPontos ?? true
      const fonteLimites = slotTemPontos
        ? 'config-slot-pontos'
        : candidato.ehSabado
          ? 'config-sabado'
          : 'config-semana'

      // Determinar regra aplicada para tipo (string descritiva)
      let regraTipoAplicada: string = candidato.tipo
      if (candidato.tipo === 'normal' && candidato.elegivel) {
        regraTipoAplicada = 'normal-km-base'
      } else if (candidato.tipo === 'especial' && candidato.elegivel) {
        regraTipoAplicada = 'especial-limite-extendido'
      } else if (candidato.tipo === 'premium' && candidato.elegivel) {
        regraTipoAplicada = 'premium-limite-maximo'
      } else if (candidato.tipo === 'hora-marcada' && candidato.elegivel) {
        regraTipoAplicada = 'hora-marcada-tempo'
      } else if (candidato.tipo === 'indisponivel') {
        regraTipoAplicada = 'indisponivel-km-excedido'
      }

      // Determinar regra aplicada para hora marcada
      let regraHoraMarcadaAplicada = null
      if (candidato.elegivelHoraMarcada) {
        regraHoraMarcadaAplicada = 'tempo-suficiente'
      } else if (candidato.diagnostico?.motivoHoraMarcada) {
        if (candidato.diagnostico.motivoHoraMarcada.includes('km')) {
          regraHoraMarcadaAplicada = 'km-excedido'
        } else if (candidato.diagnostico.motivoHoraMarcada.includes('tempo')) {
          regraHoraMarcadaAplicada = 'tempo-insuficiente'
        } else {
          regraHoraMarcadaAplicada = 'bloqueado'
        }
      }

      // Determinar fonte do slotTemPontos
      const fonteSlotTemPontos = candidato.distancia?.origemKmAdicional === 'slot'
        ? 'agenda-real-via-mapa'
        : candidato.distancia?.origemKmAdicional === 'global-fallback'
          ? 'default-fallback'
          : 'desconhecida'

      return {
        dataISO: candidato.dataISO,
        equipe: candidato.equipe,
        team: candidato.equipe,
        tipo: candidato.tipo,
        elegivel: candidato.elegivel,
        horaMarcada: candidato.horaMarcada ?? null,
        elegivelHoraMarcada: candidato.elegivelHoraMarcada ?? null,
        kmAdicionalNaRotaM: candidato.distancia?.kmAdicionalNaRotaM ?? null,
        origemKmAdicional: candidato.distancia?.origemKmAdicional ?? null,
        chaveSlotKm: candidato.distancia?.chaveSlotKm ?? null,
        slotTemPontos: slotTemPontos,
        fonteSlotTemPontos: fonteSlotTemPontos,
        limiteBaseM: limiteBaseM,
        limiteEspecialM: limiteEspecialM,
        limitePremiumM: limitePremiumM,
        fonteLimites: fonteLimites,
        regraTipoAplicada: regraTipoAplicada,
        regraHoraMarcadaAplicada: regraHoraMarcadaAplicada,
        motivos: candidato.motivos ?? [],
        ordem: idx + 1,
        rank: idx + 1,
        etapaLista: 'ordenada', // candidatos reais vêm da lista ordenada
        // comparacaoKey será gerado posteriormente por gerarComparacaoKeyV2Diagnostico
      }
    }
  )

  if (quantidadeRecebida > 0) {
    avisos.push(
      `${quantidadeRecebida} candidatos reais convertidos para formato de comparação.`
    )
  }

  return {
    ok: true,
    quantidadeRecebida,
    quantidadeConvertida: candidatosConvertidos.length,
    candidatos: candidatosConvertidos,
    avisos,
  }
}
