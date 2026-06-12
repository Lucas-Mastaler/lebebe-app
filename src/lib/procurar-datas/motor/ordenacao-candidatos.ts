// ─────────────────────────────────────────────────────────────────────────────
// motor/ordenacao-candidatos.ts  —  Ordenacao preliminar/diagnostica de candidatos v2
//
// Recebe uma lista de candidatos preliminares v2 e retorna uma nova lista ordenada
// segundo regras simples e auditaveis de prioridade.
//
// NAO FAZ:
//   - Nao e ranking final de producao
//   - Nao cria score numerico
//   - Nao adiciona campo de ranking/prioridade nos candidatos
//   - Nao muta o array de entrada
//   - Nao consulta agenda, planilha, Supabase, OSRM, Apps Script, Google Calendar
// ─────────────────────────────────────────────────────────────────────────────

import type { CandidatoPreliminarV2 } from './candidato'
import type { TipoClassificacaoCandidatoV2 } from './classificacao-candidato'

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Entrada para ordenacao de candidatos preliminares v2. */
export interface OrdenarCandidatosDiagnosticosV2Input {
  candidatos: CandidatoPreliminarV2[]
}

/** Saida da ordenacao de candidatos preliminares v2. */
export interface OrdenarCandidatosDiagnosticosV2Output {
  candidatos: CandidatoPreliminarV2[]
  resumo: {
    total: number
    elegiveis: number
    indisponiveis: number
    primeiroElegivelId: string | null
  }
  avisos: string[]
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Prioridade dos tipos de classificacao para ordenacao preliminar.
 *  Menor numero = maior prioridade (vem primeiro).
 *  hora-marcada > premium > especial > normal > indisponivel */
const PRIORIDADE_TIPO: Record<TipoClassificacaoCandidatoV2, number> = {
  'hora-marcada': 0,
  premium: 1,
  especial: 2,
  normal: 3,
  indisponivel: 4,
}

/** Prioridade das equipes para ordenacao preliminar.
 *  Menor numero = maior prioridade (vem primeiro).
 *  EQUIPE 1 > EQUIPE 2 > demais equipes */
const PRIORIDADE_EQUIPE: Record<string, number> = {
  'EQUIPE 1': 1,
  'EQUIPE 2': 2,
}

/** Retorna a prioridade de uma equipe para ordenacao.
 *  Equipes conhecidas tem prioridade 1 ou 2.
 *  Demais equipes tem prioridade 99.
 */
function getPrioridadeEquipe(equipe: string): number {
  return PRIORIDADE_EQUIPE[equipe] ?? 99
}

// ─── Funcao principal ────────────────────────────────────────────────────────

/**
 * Ordena candidatos preliminares v2 de forma preliminar e diagnostica.
 *
 * Regras de ordenacao:
 *   1. Elegiveis primeiro (elegivel: true antes de false)
 *   2. Entre elegiveis: tipo por prioridade (hora-marcada > premium > especial > normal)
 *   3. Mesmo tipo: indice crescente (data mais proxima primeiro)
 *   4. Mesmo indice: equipe por prioridade (EQUIPE 1 > EQUIPE 2 > demais), depois alfabetica
 *   5. Indisponiveis ficam no final, ordenados por: indice, equipe, id
 *
 * Nao cria score numerico.
 * Nao adiciona campo de ranking nos candidatos.
 * Nao muta o array de entrada.
 * Totalmente pura — sem I/O, sem logs.
 */
export function ordenarCandidatosDiagnosticosV2(
  input: OrdenarCandidatosDiagnosticosV2Input
): OrdenarCandidatosDiagnosticosV2Output {
  const candidatos = input.candidatos ?? []

  // ── Ordenacao ──────────────────────────────────────────────────────────────
  const ordenados = [...candidatos].sort((a, b) => {
    // 1. Elegibilidade: true vem antes de false
    if (a.elegivel !== b.elegivel) {
      return a.elegivel ? -1 : 1
    }

    // 2. Tipo por prioridade
    const prioridadeA = PRIORIDADE_TIPO[a.tipo]
    const prioridadeB = PRIORIDADE_TIPO[b.tipo]
    if (prioridadeA !== prioridadeB) {
      return prioridadeA - prioridadeB
    }

    // 3. Indice crescente (data mais proxima primeiro)
    if (a.indice !== b.indice) {
      return a.indice - b.indice
    }

    // 4. Equipe por prioridade explicita, depois alfabetica
    if (a.equipe !== b.equipe) {
      const prioridadeEquipeA = getPrioridadeEquipe(a.equipe)
      const prioridadeEquipeB = getPrioridadeEquipe(b.equipe)
      if (prioridadeEquipeA !== prioridadeEquipeB) {
        return prioridadeEquipeA - prioridadeEquipeB
      }
      // Mesma prioridade (ambas desconhecidas): alfabetica
      return a.equipe.localeCompare(b.equipe, 'pt-BR')
    }

    // 5. ID como desempate final determinístico
    return a.id.localeCompare(b.id, 'pt-BR')
  })

  // ── Resumo ─────────────────────────────────────────────────────────────────
  const elegiveis = ordenados.filter((c) => c.elegivel)
  const indisponiveis = ordenados.filter((c) => !c.elegivel)
  const primeiroElegivel = elegiveis[0] ?? null

  const avisos: string[] = []
  if (candidatos.length === 0) {
    avisos.push('Nenhum candidato recebido para ordenacao.')
  }

  return {
    candidatos: ordenados,
    resumo: {
      total: ordenados.length,
      elegiveis: elegiveis.length,
      indisponiveis: indisponiveis.length,
      primeiroElegivelId: primeiroElegivel?.id ?? null,
    },
    avisos,
  }
}
