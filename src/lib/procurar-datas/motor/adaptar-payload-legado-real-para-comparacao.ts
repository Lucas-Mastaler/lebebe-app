// ─────────────────────────────────────────────────────────────────────────────
// motor/adaptar-payload-legado-real-para-comparacao.ts
//
// Adaptador diagnóstico para converter payload legado real em formato
// compatível com legadoComparacaoDiagnostico.candidatos.
//
// NÃO FAZ:
//   - Não chama Apps Script
//   - Não chama APIs externas
//   - Não altera produção
//   - Não é integrado em rota de produção
// ─────────────────────────────────────────────────────────────────────────────

import type { CandidatoComparacaoLegadoV2 } from './comparacao-legado-v2'
import { gerarComparacaoKeyV2Diagnostico } from './comparacao-legado-v2'
import { normalizarEquipe } from './equipe'

/**
 * Estrutura de um candidato no payload legado real (responseDone.progress.payload.candidates).
 * Baseado nas fixtures reais capturadas em docs/fixtures/procurar-datas/legado/
 */
export interface CandidatoLegadoReal {
  dateISO: string
  dateDM: string
  weekday: string
  tipo: string
  isExtra: boolean
  frete: string
  rank: number
  team: string
  daysLeftTxt: string
  encomenda: string
  avisoHoraMarcada?: string
}

/**
 * Estrutura do payload legado real completo (responseDone.progress.payload).
 */
export interface PayloadLegadoReal {
  candidates?: CandidatoLegadoReal[]
  normais?: CandidatoLegadoReal[]
  extras?: CandidatoLegadoReal[]
  [key: string]: unknown
}

/**
 * Estrutura do fixture legado real completo.
 */
export interface FixtureLegadoReal {
  responseDone?: {
    body?: {
      progress?: {
        payload?: PayloadLegadoReal
      }
    }
  }
  [key: string]: unknown
}

/**
 * Adapta um candidato legado real (do payload do Apps Script) para o formato
 * CandidatoComparacaoLegadoV2 usado pelo comparador diagnóstico.
 *
 * Campos mapeados:
 * - dateISO → dataISO (extraído YYYY-MM-DD do formato legado-gmt3)
 * - team → equipe (normalizado)
 * - tipo → tipo (preservado)
 * - isExtra → elegivel (true para normal, false para indisponível)
 * - rank → ordem (preservado)
 * - avisoHoraMarcada → horaMarcada/elegivelHoraMarcada (parseado)
 *
 * Campos derivados:
 * - slotTemPontos: null (não disponível no payload legado)
 * - kmAdicionalNaRotaM: null (não disponível no payload legado)
 * - limite*M: null (não disponíveis no payload legado)
 */
export function adaptarCandidatoLegadoRealParaComparacao(
  candidato: CandidatoLegadoReal,
  indice: number
): CandidatoComparacaoLegadoV2 {
  // Extrair dataISO no formato YYYY-MM-DD do dateISO legado (formato legado-gmt3: YYYY-MM-DDTHH:mm:ss.sssZ)
  const dataISO = candidato.dateISO?.split('T')[0] ?? ''

  // Normalizar equipe (team do legado → equipe da v2)
  // normalizarEquipe pode retornar null, então convertemos para string
  const equipeNormalizada = normalizarEquipe(candidato.team ?? '')
  const equipe = equipeNormalizada ?? candidato.team ?? ''

  // Determinar elegibilidade baseada no tipo
  // No legado, candidatos indisponíveis não aparecem no payload final
  // Então todos os candidatos do payload são elegíveis
  const elegivel = true

  // Parse de hora marcada do avisoHoraMarcada
  // Legado: string vazia = não tem hora marcada; string preenchida = tem hora marcada
  const horaMarcada = !!(candidato.avisoHoraMarcada && candidato.avisoHoraMarcada.trim().length > 0)
  const elegivelHoraMarcada = horaMarcada

  return {
    dataISO,
    equipe,
    tipo: candidato.tipo ?? null,
    elegivel,
    horaMarcada,
    elegivelHoraMarcada,
    kmAdicionalNaRotaM: null, // Não disponível no payload legado real
    slotTemPontos: null, // Não disponível no payload legado real
    limiteBaseM: null, // Não disponível no payload legado real
    limiteEspecialM: null, // Não disponível no payload legado real
    limitePremiumM: null, // Não disponível no payload legado real
    motivos: null, // Não disponível no payload legado real
    ordem: candidato.rank ?? indice + 1,
    // Não geramos comparacaoKey aqui - isso é feito depois pelo helper gerarComparacaoKeyV2Diagnostico
  }
}

/**
 * Adapta um array de candidatos legado real para o formato do comparador.
 */
export function adaptarCandidatosLegadoRealParaComparacao(
  candidatos: CandidatoLegadoReal[]
): CandidatoComparacaoLegadoV2[] {
  return candidatos.map((c, idx) => adaptarCandidatoLegadoRealParaComparacao(c, idx))
}

/**
 * Extrai candidatos de um fixture legado real completo.
 * Tenta extrair de responseDone.body.progress.payload.candidates primeiro,
 * depois faz fallback para payload.candidates.
 */
export function extrairCandidatosDoFixtureLegadoReal(
  fixture: FixtureLegadoReal | unknown
): CandidatoLegadoReal[] {
  if (!fixture || typeof fixture !== 'object') {
    return []
  }

  const f = fixture as FixtureLegadoReal

  // Tentar extrair do path completo
  const payload = f.responseDone?.body?.progress?.payload
  if (payload && Array.isArray(payload.candidates)) {
    return payload.candidates
  }

  // Fallback: tentar extrair diretamente se o payload foi passado
  if (Array.isArray((f as PayloadLegadoReal).candidates)) {
    return (f as PayloadLegadoReal).candidates as CandidatoLegadoReal[]
  }

  return []
}

/**
 * Adaptador principal: recebe um fixture legado real e retorna o formato
 * esperado por legadoComparacaoDiagnostico.candidatos.
 *
 * Uso:
 * ```typescript
 * const fixtureLegado = /* payload real do Apps Script * /
 * const candidatosParaComparacao = adaptarPayloadLegadoRealParaComparacao(fixtureLegado)
 * // Usar em: legadoComparacaoDiagnostico: { candidatos: candidatosParaComparacao }
 * ```
 */
export function adaptarPayloadLegadoRealParaComparacao(
  fixture: FixtureLegadoReal | unknown
): CandidatoComparacaoLegadoV2[] {
  const candidatosLegado = extrairCandidatosDoFixtureLegadoReal(fixture)

  if (candidatosLegado.length === 0) {
    return []
  }

  return adaptarCandidatosLegadoRealParaComparacao(candidatosLegado)
}

/**
 * Adaptador com geração de comparacaoKey compatível com a v2.
 * Usa o helper gerarComparacaoKeyV2Diagnostico para gerar chaves no mesmo
 * formato da v2: dataISO::equipeNormalizada::fonteV2::ordemLocal
 *
 * A fonte default é 'diagnostico-candidatos' (válida na rota diagnóstica)
 * para garantir pareamento correto entre legado e v2 na comparação diagnóstica.
 * Isso evita ausências falsas causadas por fontes diferentes.
 *
 * Fontes válidas na rota: 'diagnostico-candidatos', 'disponibilidade-real',
 * 'reclassificacao-com-km-mapa-slot'.
 *
 * Uso:
 * ```typescript
 * const fixtureLegado = /* payload real do Apps Script * /
 * const candidatosComChave = adaptarPayloadLegadoRealParaComparacaoComChave(fixtureLegado)
 * // candidatosComChave terão comparacaoKey preenchida com fonte 'diagnostico-candidatos'
 * ```
 */
export function adaptarPayloadLegadoRealParaComparacaoComChave(
  fixture: FixtureLegadoReal | unknown,
  fonteV2: string = 'diagnostico-candidatos'
): CandidatoComparacaoLegadoV2[] {
  const candidatos = adaptarPayloadLegadoRealParaComparacao(fixture)

  if (candidatos.length === 0) {
    return []
  }

  // Usar o helper de geracao de chave da v2
  return gerarComparacaoKeyV2Diagnostico(candidatos, fonteV2)
}
