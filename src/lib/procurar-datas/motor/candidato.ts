// ─────────────────────────────────────────────────────────────────────────────
// motor/candidato.ts  —  Montagem pura de candidato v2 preliminar
//
// Recebe dados já classificados (data, equipe, disponibilidade, classificação,
// distância, frete) e monta um objeto único de candidato preliminar.
//
// NÃO FAZ:
//   - Consulta agenda, planilha, Supabase, OSRM, Apps Script, Google Calendar
//   - Não gera candidatos finais nem aplica ranking
//   - Não recalcula regra de elegibilidade
//   - Não cria score/prioridade
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ClassificacaoCandidatoOperacionalV2,
  TipoClassificacaoCandidatoV2,
} from './classificacao-candidato'

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Entrada para montagem de um candidato preliminar v2. */
export interface MontarCandidatoPreliminarV2Input {
  dataISO: string
  indice: number
  diaSemana: number
  ehSabado: boolean
  ehDomingo: boolean
  slotTemPontos?: boolean

  equipe: string
  disponivelMin: number
  ativa: boolean
  suficienteParaServico: boolean

  tempoNecessarioMin: number | null

  distanciaKm: number | null
  kmAdicionalNaRotaM: number | null

  /** 'slot' quando km veio do mapa por slot; 'global-fallback' quando usou km global. */
  origemKmAdicional?: 'slot' | 'global-fallback' | null

  /** Chave do mapa por slot usada, ex: '2026-07-03::EQUIPE 1'. null se fallback global. */
  chaveSlotKm?: string | null

  valorFrete?: number | null
  tipoFrete?: string | null

  classificacao: ClassificacaoCandidatoOperacionalV2
}

/** Candidato preliminar v2 — objeto único e transparente para diagnóstico. */
export interface CandidatoPreliminarV2 {
  id: string
  elegivel: boolean
  tipo: TipoClassificacaoCandidatoV2
  horaMarcada?: boolean
  elegivelHoraMarcada?: boolean

  dataISO: string
  indice: number
  diaSemana: number
  ehSabado: boolean
  ehDomingo: boolean
  slotTemPontos?: boolean

  equipe: string

  operacional: {
    ativa: boolean
    disponivelMin: number
    suficienteParaServico: boolean
    tempoNecessarioMin: number | null
    slotAvailMin?: number | null
    serviceMin?: number | null
  }

  distancia: {
    distanciaKm: number | null
    kmAdicionalNaRotaM: number | null
    /** 'slot' quando km veio do mapa por slot; 'global-fallback' quando usou km global. */
    origemKmAdicional?: 'slot' | 'global-fallback' | null
    /** Chave do mapa por slot usada. null se fallback global. */
    chaveSlotKm?: string | null
  }

  frete: {
    valorFrete: number | null
    tipoFrete: string | null
  }

  motivos: string[]
  avisos: string[]

  /** Limites usados na classificação (em metros) — propagados dos detalhes da classificação. */
  limites: {
    limiteBaseM: number | null
    limiteEspecialM: number | null
    limitePremiumM: number | null
  }

  diagnostico: {
    origem: 'v2-preliminar'
    classificacaoTipo: TipoClassificacaoCandidatoV2
    classificacaoElegivel: boolean
    horaMarcada?: boolean
    elegivelHoraMarcada?: boolean
    motivoHoraMarcada?: string | null
    horaMarcadaHorasAMais?: number | null
    limiteMinimoHoraMarcadaMin?: number | null
    horaMarcadaCalculadaPorTempo?: boolean | null
  }
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/** Cria um ID determinístico a partir de data, equipe, tipo e índice. */
function gerarIdCandidatoV2(
  dataISO: string,
  equipe: string,
  tipo: string,
  indice: number
): string {
  const normalizado = equipe
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `v2-${dataISO}-${normalizado}-${tipo}-${indice}`
}

/** Remove duplicatas preservando ordem. */
function dedup<T extends string>(arr: T[]): T[] {
  return [...new Set(arr)]
}

// ─── Função principal ────────────────────────────────────────────────────────

/**
 * Monta um candidato preliminar v2 a partir de dados já classificados.
 *
 * Regras:
 *   - ID é determinístico (data + equipe normalizada + tipo + índice)
 *   - `elegivel` e `tipo` vêm diretamente da classificação
 *   - Motivos e avisos vêm da classificação, sem duplicar
 *   - Dados essenciais ausentes retornam `indisponivel` com motivo
 *   - Não cria score, ranking, label comercial, nem escolhe melhor candidato
 *   - Não muta o objeto de entrada
 */
export function montarCandidatoPreliminarV2(
  input: MontarCandidatoPreliminarV2Input
): CandidatoPreliminarV2 {
  const motivosProprios: string[] = []
  const avisosProprios: string[] = []

  // ── Validação mínima ───────────────────────────────────────────────────────
  if (!input.dataISO || typeof input.dataISO !== 'string') {
    motivosProprios.push('Data ISO ausente ou inválida.')
  }
  if (!input.equipe || typeof input.equipe !== 'string') {
    motivosProprios.push('Equipe ausente ou inválida.')
  }
  if (!input.classificacao || typeof input.classificacao !== 'object') {
    motivosProprios.push('Classificação ausente ou inválida.')
  }

  const dadosEssenciaisInvalidos = motivosProprios.length > 0

  const tipo: TipoClassificacaoCandidatoV2 = dadosEssenciaisInvalidos
    ? 'indisponivel'
    : input.classificacao.tipo

  const elegivel = dadosEssenciaisInvalidos ? false : input.classificacao.elegivel
  const horaMarcada = dadosEssenciaisInvalidos
    ? false
    : input.classificacao.elegivelHoraMarcada === true

  const motivos = dedup([
    ...motivosProprios,
    ...(input.classificacao?.motivos ?? []),
  ])

  const avisos = dedup([
    ...avisosProprios,
    ...(input.classificacao?.avisos ?? []),
  ])

  const id = gerarIdCandidatoV2(
    input.dataISO ?? 'sem-data',
    input.equipe ?? 'sem-equipe',
    tipo,
    input.indice ?? 0
  )

  return {
    id,
    elegivel,
    tipo,
    horaMarcada,
    elegivelHoraMarcada: horaMarcada,

    dataISO: input.dataISO ?? '',
    indice: input.indice ?? 0,
    diaSemana: input.diaSemana ?? 0,
    ehSabado: input.ehSabado ?? false,
    ehDomingo: input.ehDomingo ?? false,
    slotTemPontos: input.slotTemPontos ?? true,

    equipe: input.equipe ?? '',

    operacional: {
      ativa: input.ativa ?? false,
      disponivelMin: input.disponivelMin ?? 0,
      suficienteParaServico: input.suficienteParaServico ?? false,
      tempoNecessarioMin: input.tempoNecessarioMin ?? null,
      slotAvailMin: input.classificacao?.detalhes?.slotAvailMin ?? null,
      serviceMin: input.classificacao?.detalhes?.serviceMin ?? null,
    },

    distancia: {
      distanciaKm: input.distanciaKm ?? null,
      kmAdicionalNaRotaM: input.kmAdicionalNaRotaM ?? null,
      origemKmAdicional: input.origemKmAdicional ?? null,
      chaveSlotKm: input.chaveSlotKm ?? null,
    },

    frete: {
      valorFrete: input.valorFrete ?? null,
      tipoFrete: input.tipoFrete ?? null,
    },

    motivos,
    avisos,

    diagnostico: {
      origem: 'v2-preliminar',
      classificacaoTipo: tipo,
      classificacaoElegivel: elegivel,
      horaMarcada,
      elegivelHoraMarcada: horaMarcada,
      motivoHoraMarcada: input.classificacao?.detalhes?.motivoHoraMarcada ?? null,
      horaMarcadaHorasAMais: input.classificacao?.detalhes?.horaMarcadaHorasAMais ?? null,
      limiteMinimoHoraMarcadaMin:
        input.classificacao?.detalhes?.limiteMinimoHoraMarcadaMin ?? null,
      horaMarcadaCalculadaPorTempo:
        input.classificacao?.detalhes?.horaMarcadaCalculadaPorTempo ?? null,
    },

    limites: {
      limiteBaseM: input.classificacao?.detalhes?.limiteBaseM ?? null,
      limiteEspecialM: input.classificacao?.detalhes?.limiteEspecialM ?? null,
      limitePremiumM: input.classificacao?.detalhes?.limitePremiumM ?? null,
    },
  }
}
