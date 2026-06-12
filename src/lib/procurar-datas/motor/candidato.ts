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

  equipe: string
  disponivelMin: number
  ativa: boolean
  suficienteParaServico: boolean

  tempoNecessarioMin: number | null

  distanciaKm: number | null
  kmAdicionalNaRotaM: number | null

  valorFrete?: number | null
  tipoFrete?: string | null

  classificacao: ClassificacaoCandidatoOperacionalV2
}

/** Candidato preliminar v2 — objeto único e transparente para diagnóstico. */
export interface CandidatoPreliminarV2 {
  id: string
  elegivel: boolean
  tipo: TipoClassificacaoCandidatoV2

  dataISO: string
  indice: number
  diaSemana: number
  ehSabado: boolean
  ehDomingo: boolean

  equipe: string

  operacional: {
    ativa: boolean
    disponivelMin: number
    suficienteParaServico: boolean
    tempoNecessarioMin: number | null
  }

  distancia: {
    distanciaKm: number | null
    kmAdicionalNaRotaM: number | null
  }

  frete: {
    valorFrete: number | null
    tipoFrete: string | null
  }

  motivos: string[]
  avisos: string[]

  diagnostico: {
    origem: 'v2-preliminar'
    classificacaoTipo: TipoClassificacaoCandidatoV2
    classificacaoElegivel: boolean
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

    dataISO: input.dataISO ?? '',
    indice: input.indice ?? 0,
    diaSemana: input.diaSemana ?? 0,
    ehSabado: input.ehSabado ?? false,
    ehDomingo: input.ehDomingo ?? false,

    equipe: input.equipe ?? '',

    operacional: {
      ativa: input.ativa ?? false,
      disponivelMin: input.disponivelMin ?? 0,
      suficienteParaServico: input.suficienteParaServico ?? false,
      tempoNecessarioMin: input.tempoNecessarioMin ?? null,
    },

    distancia: {
      distanciaKm: input.distanciaKm ?? null,
      kmAdicionalNaRotaM: input.kmAdicionalNaRotaM ?? null,
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
    },
  }
}
