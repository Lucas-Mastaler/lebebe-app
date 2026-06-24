// ─────────────────────────────────────────────────────────────────────────────
// motor/recortar-candidatos-legado-equivalente.ts
//
// Helper puro: aplica o recorte final legado-equivalente nos candidatos v2.
//
// Implementa a mesma lógica de seleção da função selecionarConjuntoApp3ComExtras_
// do legado Apps Script (CEP-APIBACK.gs, linhas 836-873), modo 'app-3-com-extras'.
//
// Regra legado confirmada (CEP-APIBACK.gs, selecionarConjuntoApp3ComExtras_):
//   1. Para cada tipo, ordena candidatos por data crescente.
//   2. Usa um Set compartilhado (chosenDays) para garantir datas únicas entre tipos.
//   3. Preenche normais primeiro (até maxNormais, 1 por data).
//   4. Em seguida especiais (até 1, data não usada por normais).
//   5. Em seguida premiums (até 1, data não usada por normais/especiais).
//   6. Em seguida hora marcada (até 1, data não usada pelos anteriores).
//   7. Lista final = concat(normais, especiais, premiums, horaMarcada), ordenada por data.
//
// DIVERGÊNCIA INTENCIONAL v2 vs legado (decisão de produto aprovada, 22/06/2026):
//   - Legado: maxNormais default = 5 (MAX_NORMAIS_RETORNO do Apps Script).
//   - v2 aprovada: maxNormais default = 3.
//   - Estrutura de seleção e extras (1 especial, 1 premium, 1 hora marcada) permanecem
//     idênticos ao legado. Apenas o limite de normais difere.
//   - Esta diferença é intencional e NÃO deve ser reaberta como bug de equivalência.
//
// REGRA ADICIONAL v2 (decisão de produto aprovada, 22/06/2026):
//   Full-window controlado para extras úteis:
//   - A v2 pesquisa a janela inteira para encontrar extras (especial/premium/hora-marcada).
//   - Mas só mantém extras cuja dataISO seja ANTERIOR à última data normal selecionada.
//   - Extras com dataISO >= última normal são removidos (não antecipam a entrega).
//   - Se não houver normais selecionados, a regra não se aplica (todos os extras ficam).
//   - Motivo de exclusão: 'extra-posterior-ultima-normal'.
//
// Diferença do legado:
//   - No legado, porDiaBestNormal/Especial/Premium/HoraMarcada já armazenam 1 por
//     data (melhor delta). Aqui pode haver múltiplos candidatos por data/tipo.
//   - A v2 resolve: dentro de cada tipo, seleciona o melhor (menor kmAdicionalNaRotaM)
//     por data antes de aplicar o recorte.
//
// NÃO FAZ:
//   - Não lê planilha, Supabase, Apps Script, OSRM, Google Calendar
//   - Não recalcula kmAdicionalNaRotaM
//   - Não altera classificação, elegibilidade ou hora marcada
//   - Não muta o array de entrada
//   - Não lança erros
// ─────────────────────────────────────────────────────────────────────────────

import type { CandidatoPreliminarV2 } from './candidato'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface RecortarCandidatosLegadoEquivalenteInput {
  /** Lista ampla de candidatos v2 (qualquer ordenação). */
  candidatos: CandidatoPreliminarV2[]
  /**
   * Número máximo de normais a selecionar.
   * Legado literal: MAX_NORMAIS_RETORNO = 5 (CEP-APIBACK.gs, linha 831).
   * v2 aprovada: default = 3 (decisão de produto, 22/06/2026).
   * O parâmetro permanece flexível para testes; a integração v2 usa o default 3.
   */
  maxNormais?: number
}

export type MotivoExclusaoCandidatoRecorte =
  | 'limite-normais-atingido'
  | 'limite-especiais-atingido'
  | 'limite-premiums-atingido'
  | 'limite-hora-marcada-atingido'
  | 'data-ja-escolhida'
  | 'duplicata-por-data-tipo'
  | 'inelegivel'
  | 'extra-posterior-ultima-normal'

export interface ExclusaoCandidatoRecorte {
  id: string
  dataISO: string
  equipe: string
  tipo: string
  motivo: MotivoExclusaoCandidatoRecorte
}

export interface RecortarCandidatosLegadoEquivalenteOutput {
  ok: boolean
  /** Candidatos finais selecionados, ordenados cronologicamente. */
  candidatosFinais: CandidatoPreliminarV2[]
  normais: CandidatoPreliminarV2[]
  especiais: CandidatoPreliminarV2[]
  premiums: CandidatoPreliminarV2[]
  horaMarcada: CandidatoPreliminarV2[]
  /** Datas usadas (dataISO) no conjunto final (chosenDays equivalente). */
  diasUsados: string[]
  /** Candidatos elegíveis excluídos do recorte e o motivo. */
  exclusoes: ExclusaoCandidatoRecorte[]
  resumo: {
    totalRecebidos: number
    totalElegiveis: number
    totalRecortados: number
    normaisRecortados: number
    especiaisRecortados: number
    premiumsRecortados: number
    horaMarcadaRecortados: number
    maxNormaisAplicado: number
    /**
     * dataISO da última normal selecionada.
     * null quando não há normais — nesse caso a regra de extras não é aplicada.
     */
    ultimaNormalDataISO: string | null
    /** Quantidade de extras removidos por serem posteriores ou iguais à última normal. */
    extrasRemovidosPorDataPosterior: number
  }
  avisos: string[]
}

// ─── Função principal ────────────────────────────────────────────────────────

/**
 * Aplica o recorte final legado-equivalente nos candidatos v2.
 *
 * Equivalente a selecionarConjuntoApp3ComExtras_ do legado Apps Script
 * (CEP-APIBACK.gs, linhas 836-873).
 */
export function recortarCandidatosLegadoEquivalente(
  input: RecortarCandidatosLegadoEquivalenteInput
): RecortarCandidatosLegadoEquivalenteOutput {
  const avisos: string[] = []
  const exclusoes: ExclusaoCandidatoRecorte[] = []

  if (!Array.isArray(input.candidatos)) {
    return {
      ok: false,
      candidatosFinais: [],
      normais: [],
      especiais: [],
      premiums: [],
      horaMarcada: [],
      diasUsados: [],
      exclusoes: [],
      resumo: {
        totalRecebidos: 0,
        totalElegiveis: 0,
        totalRecortados: 0,
        normaisRecortados: 0,
        especiaisRecortados: 0,
        premiumsRecortados: 0,
        horaMarcadaRecortados: 0,
        maxNormaisAplicado: 0,
        ultimaNormalDataISO: null,
        extrasRemovidosPorDataPosterior: 0,
      },
      avisos: ['Input candidatos nao e um array valido.'],
    }
  }

  const maxNormais =
    typeof input.maxNormais === 'number' &&
    Number.isFinite(input.maxNormais) &&
    input.maxNormais > 0
      ? Math.floor(input.maxNormais)
      : 3

  const totalRecebidos = input.candidatos.length

  // ── 1. Separar elegíveis ──────────────────────────────────────────────────

  const elegiveis: CandidatoPreliminarV2[] = []
  for (const c of input.candidatos) {
    if (c.elegivel) {
      elegiveis.push(c)
    } else {
      exclusoes.push({ id: c.id, dataISO: c.dataISO, equipe: c.equipe, tipo: c.tipo, motivo: 'inelegivel' })
    }
  }

  const totalElegiveis = elegiveis.length

  // ── 2. Separar por tipo ───────────────────────────────────────────────────

  const porTipo: Record<string, CandidatoPreliminarV2[]> = {
    normal: [],
    especial: [],
    premium: [],
    'hora-marcada': [],
  }
  for (const c of elegiveis) {
    if (c.tipo in porTipo) {
      porTipo[c.tipo].push(c)
    }
  }

  // ── 3. Melhor por data dentro de cada tipo ───────────────────────────────
  //
  // No legado: porDiaBestNormal[date.toDateString()] = cand com menor delta.
  // Aqui: pode haver múltiplas equipes por data/tipo — selecionamos a de menor
  // kmAdicionalNaRotaM. Candidatos descartados registrados como duplicata.

  function melhorPorData(candidatos: CandidatoPreliminarV2[]): CandidatoPreliminarV2[] {
    const mapa = new Map<string, CandidatoPreliminarV2>()
    for (const c of candidatos) {
      const existing = mapa.get(c.dataISO)
      if (!existing) {
        mapa.set(c.dataISO, c)
      } else {
        const kmC = c.distancia?.kmAdicionalNaRotaM ?? Infinity
        const kmEx = existing.distancia?.kmAdicionalNaRotaM ?? Infinity
        if (kmC < kmEx) {
          exclusoes.push({ id: existing.id, dataISO: existing.dataISO, equipe: existing.equipe, tipo: existing.tipo, motivo: 'duplicata-por-data-tipo' })
          mapa.set(c.dataISO, c)
        } else {
          exclusoes.push({ id: c.id, dataISO: c.dataISO, equipe: c.equipe, tipo: c.tipo, motivo: 'duplicata-por-data-tipo' })
        }
      }
    }
    return [...mapa.values()].sort((a, b) => a.dataISO.localeCompare(b.dataISO))
  }

  const melhoresPorTipo = {
    normal: melhorPorData(porTipo.normal),
    especial: melhorPorData(porTipo.especial),
    premium: melhorPorData(porTipo.premium),
    'hora-marcada': melhorPorData(porTipo['hora-marcada']),
  }

  // ── 4. Recorte com chosenDays compartilhado ───────────────────────────────
  //
  // Legado (selecionarConjuntoApp3ComExtras_, linha 857-860):
  //   pushUnicos(normalsIn,     MAX_NORMAIS_RETORNO, listaNormalApp,    chosenDays)
  //   pushUnicos(especiaisIn,   1,                   listaEspecialApp,  chosenDays)
  //   pushUnicos(premiumsIn,    1,                   listaPremiumApp,   chosenDays)
  //   pushUnicos(horaMarcadasIn,1,                   listaHoraMarcadaApp, chosenDays)

  const chosenDays = new Set<string>()
  const normais: CandidatoPreliminarV2[] = []
  const especiais: CandidatoPreliminarV2[] = []
  const premiums: CandidatoPreliminarV2[] = []
  const horaMarcada: CandidatoPreliminarV2[] = []

  function pushUnicos(
    origem: CandidatoPreliminarV2[],
    limite: number,
    destino: CandidatoPreliminarV2[],
    motivoLimite: MotivoExclusaoCandidatoRecorte
  ): void {
    for (const c of origem) {
      if (destino.length >= limite) {
        exclusoes.push({ id: c.id, dataISO: c.dataISO, equipe: c.equipe, tipo: c.tipo, motivo: motivoLimite })
        continue
      }
      if (chosenDays.has(c.dataISO)) {
        exclusoes.push({ id: c.id, dataISO: c.dataISO, equipe: c.equipe, tipo: c.tipo, motivo: 'data-ja-escolhida' })
        continue
      }
      destino.push(c)
      chosenDays.add(c.dataISO)
    }
  }

  pushUnicos(melhoresPorTipo.normal, maxNormais, normais, 'limite-normais-atingido')
  pushUnicos(melhoresPorTipo.especial, 1, especiais, 'limite-especiais-atingido')
  pushUnicos(melhoresPorTipo.premium, 1, premiums, 'limite-premiums-atingido')
  pushUnicos(melhoresPorTipo['hora-marcada'], 1, horaMarcada, 'limite-hora-marcada-atingido')

  // ── 5. Filtro full-window: remover extras posteriores à última normal ────────
  //
  // Regra aprovada (22/06/2026): extra útil = candidato especial/premium/hora-marcada
  // cuja dataISO seja ANTERIOR à última data normal selecionada.
  // Extras com dataISO >= última normal são removidos.
  // Se não há normais, a regra não se aplica (todos os extras ficam).

  const ultimaNormalDataISO: string | null =
    normais.length > 0 ? normais[normais.length - 1].dataISO : null

  function filtrarExtrasPorUltimaNormal(
    extras: CandidatoPreliminarV2[]
  ): CandidatoPreliminarV2[] {
    if (ultimaNormalDataISO === null) return extras
    const mantidos: CandidatoPreliminarV2[] = []
    for (const c of extras) {
      if (c.dataISO < ultimaNormalDataISO) {
        mantidos.push(c)
      } else {
        exclusoes.push({
          id: c.id,
          dataISO: c.dataISO,
          equipe: c.equipe,
          tipo: c.tipo,
          motivo: 'extra-posterior-ultima-normal',
        })
      }
    }
    return mantidos
  }

  const especiaisFiltrados = filtrarExtrasPorUltimaNormal(especiais)
  const premiumsFiltrados = filtrarExtrasPorUltimaNormal(premiums)
  const horaMarcadaFiltrada = filtrarExtrasPorUltimaNormal(horaMarcada)

  const extrasRemovidosPorDataPosterior =
    (especiais.length - especiaisFiltrados.length) +
    (premiums.length - premiumsFiltrados.length) +
    (horaMarcada.length - horaMarcadaFiltrada.length)

  if (extrasRemovidosPorDataPosterior > 0) {
    avisos.push(
      `${extrasRemovidosPorDataPosterior} extra(s) removido(s) por nao antecipar a ultima normal (${ultimaNormalDataISO}).`
    )
  }

  // ── 6. Lista final ordenada por data crescente ────────────────────────────
  //
  // Legado: listaApp.sort(function(a,b){ return a.date - b.date; })

  const candidatosFinais = [
    ...normais,
    ...especiaisFiltrados,
    ...premiumsFiltrados,
    ...horaMarcadaFiltrada,
  ].sort((a, b) => a.dataISO.localeCompare(b.dataISO))

  const totalRecortados = candidatosFinais.length

  if (totalRecortados === 0 && totalElegiveis > 0) {
    avisos.push('Recorte resultou em 0 candidatos finais apesar de haver elegíveis.')
  }

  return {
    ok: true,
    candidatosFinais,
    normais,
    especiais: especiaisFiltrados,
    premiums: premiumsFiltrados,
    horaMarcada: horaMarcadaFiltrada,
    diasUsados: [...chosenDays],
    exclusoes,
    resumo: {
      totalRecebidos,
      totalElegiveis,
      totalRecortados,
      normaisRecortados: normais.length,
      especiaisRecortados: especiaisFiltrados.length,
      premiumsRecortados: premiumsFiltrados.length,
      horaMarcadaRecortados: horaMarcadaFiltrada.length,
      maxNormaisAplicado: maxNormais,
      ultimaNormalDataISO,
      extrasRemovidosPorDataPosterior,
    },
    avisos,
  }
}
