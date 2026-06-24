// ─────────────────────────────────────────────────────────────────────────────
// motor/comparacao-legado-v2.ts  —  Comparação estrutural de fixture legado vs contrato v2
//
// Recebe uma fixture real/controlada do legado e valida sua estrutura
// contra o contrato esperado. Não chama Apps Script, OSRM, Supabase,
// Google Calendar ou qualquer I/O. Não altera produção.
//
// NÃO FAZ:
//   - Não chama Apps Script
//   - Não chama rota legado real (/api/procurar-datas/pesquisar)
//   - Não compara datas com o v2 (v2 ainda usa disponibilidade sintética)
//   - Não exige igualdade operacional com o v2
//   - Não cria score/ranking novo
//   - Não muta input
// ─────────────────────────────────────────────────────────────────────────────

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Campos mínimos obrigatórios em cada candidato retornado pelo legado. */
import { normalizarEquipe } from './equipe'

const CAMPOS_MINIMOS_CANDIDATO = [
  'dateISO',
  'dateDM',
  'weekday',
  'tipo',
  'isExtra',
  'frete',
  'rank',
  'team',
  'daysLeftTxt',
  'encomenda',
  'avisoHoraMarcada',
] as const

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type CampoMinimoCandidatoLegado = (typeof CAMPOS_MINIMOS_CANDIDATO)[number]

export interface CompararFixtureLegadoInput {
  nomeFixture: string
  fixtureLegado: unknown
}

export interface ResumoComparacaoLegadoV2 {
  statusLegado: string | null
  quantidadePayloadCandidates: number
  quantidadeNormais: number
  quantidadeExtras: number
  tiposLegado: string[]
  equipesLegado: string[]
  fretesLegado: string[]
}

export interface ContratoLegadoValidado {
  temResponseInicio: boolean
  temResponseDone: boolean
  temPayloadFinal: boolean
  temCandidates: boolean
  temNormais: boolean
  temExtras: boolean
  candidatesBatemComNormaisMaisExtras: boolean
  ranksSaoNumericos: boolean
}

export interface ComparacaoLegadoV2Output {
  ok: boolean
  nomeFixture: string
  resumo: ResumoComparacaoLegadoV2
  contratoLegado: ContratoLegadoValidado
  diferencas: string[]
  avisos: string[]
}

export type SeveridadeDivergenciaComparacaoLegadoV2 =
  | 'bloqueante'
  | 'avaliar'
  | 'informativo'

export type TipoDivergenciaComparacaoLegadoV2 =
  | 'ausente-na-v2'
  | 'ausente-no-legado'
  | 'tipo'
  | 'elegibilidade'
  | 'hora-marcada'
  | 'km'
  | 'slot'
  | 'limite'
  | 'ordem'
  | 'motivo'

export interface CandidatoComparacaoLegadoV2 {
  dataISO: string
  equipe?: string
  team?: string
  tipo?: string | null
  elegivel?: boolean | null
  horaMarcada?: boolean | null
  elegivelHoraMarcada?: boolean | null
  kmAdicionalNaRotaM?: number | null
  /** 'slot' quando km veio do mapa por slot; 'global-fallback' quando usou km global; null se não aplicável. */
  origemKmAdicional?: 'slot' | 'global-fallback' | null
  /** Chave do mapa por slot usada, ex: '2026-07-03::EQUIPE 1'. null se fallback global. */
  chaveSlotKm?: string | null
  slotTemPontos?: boolean | null
  /** Fonte do slotTemPontos: 'agenda-real', 'mock', 'default-true', etc. */
  fonteSlotTemPontos?: string | null
  limiteBaseM?: number | null
  limiteEspecialM?: number | null
  limitePremiumM?: number | null
  /** Fonte dos limites: 'config-slot-pontos', 'config-sabado', 'config-semana', etc. */
  fonteLimites?: string | null
  /** Regra aplicada para classificação do tipo (descrição detalhada da regra usada). */
  regraTipoAplicada?: string | null
  /** Regra aplicada para hora marcada: 'tempo-suficiente', 'km-excedido', 'indisponivel', etc. */
  regraHoraMarcadaAplicada?: string | null
  motivo?: string | null
  motivos?: string[] | null
  ordem?: number | null
  rank?: number | null
  /** Etapa da lista: 'bruta' (após montagem), 'ordenada' (após ordenação), 'final' (após recorte). */
  etapaLista?: 'bruta' | 'ordenada' | 'final' | null
  /** Chave única explícita para comparação. Se presente, sobrepõe o fallback dataISO+equipe. */
  comparacaoKey?: string | null
}

export interface DivergenciaComparacaoLegadoV2 {
  chave: string
  dataISO: string
  equipe: string
  campo: string
  legado: unknown
  v2: unknown
  tipoDivergencia: TipoDivergenciaComparacaoLegadoV2
  severidade: SeveridadeDivergenciaComparacaoLegadoV2
  observacao: string
}

export type EstrategiaChaveComparacaoLegadoV2 =
  | 'comparacaoKey'
  | 'dataISO-equipe-fallback'
  | 'mista'

export interface DuplicidadeChaveComparacao {
  chave: string
  origem: 'legado' | 'v2'
  quantidade: number
  indices: number[]
  observacao: string
}

export interface CompararPayloadLegadoComV2Input {
  candidatosLegado: CandidatoComparacaoLegadoV2[]
  candidatosV2: CandidatoComparacaoLegadoV2[]
  toleranciaKmAdicionalM?: number
}

export interface ComparacaoAmplaLegadoV2Output {
  ok: boolean
  modo: 'comparacao-legado-v2-diagnostico'
  producaoAfetada: false
  estrategiaChave: EstrategiaChaveComparacaoLegadoV2
  toleranciaKmAdicionalM: number
  resumo: {
    candidatosLegado: number
    candidatosV2: number
    chavesComparadas: number
    presentesNosDois: number
    apenasNoLegado: number
    apenasNaV2: number
    divergenciasTipo: number
    divergenciasElegibilidade: number
    divergenciasHoraMarcada: number
    divergenciasKm: number
    divergenciasSlot: number
    divergenciasLimite: number
    divergenciasOrdem: number
    divergenciasMotivo: number
    chavesDuplicadasLegado: number
    chavesDuplicadasV2: number
  }
  divergencias: DivergenciaComparacaoLegadoV2[]
  duplicidades: {
    legado: DuplicidadeChaveComparacao[]
    v2: DuplicidadeChaveComparacao[]
  }
  amostras: {
    legado: CandidatoComparacaoLegadoV2[]
    v2: CandidatoComparacaoLegadoV2[]
    presentesNosDois: Array<{
      chave: string
      legado: CandidatoComparacaoLegadoV2
      v2: CandidatoComparacaoLegadoV2
    }>
  }
  avisos: string[]
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function acessarProp(obj: unknown, ...caminho: string[]): unknown {
  let atual: unknown = obj
  for (const chave of caminho) {
    if (atual === null || typeof atual !== 'object') return undefined
    atual = (atual as Record<string, unknown>)[chave]
  }
  return atual
}

function extrairString(obj: unknown, campo: string): string | null {
  if (obj === null || typeof obj !== 'object') return null
  const val = (obj as Record<string, unknown>)[campo]
  return typeof val === 'string' ? val : null
}

function extrairStringsUnicas(valores: (string | null)[]): string[] {
  const set = new Set<string>()
  for (const v of valores) {
    if (v !== null && v.length > 0) set.add(v)
  }
  return [...set].sort()
}

// ─── Função principal ────────────────────────────────────────────────────────

/**
 * Compara a estrutura de uma fixture real/controlada do legado
 * contra o contrato mínimo esperado.
 *
 * Regras:
 *   - Valida estrutura básica (responseInicio, responseDone, payload, candidates, normais, extras)
 *   - Compara quantidades: candidates === normais + extras
 *   - Extrai tipos, equipes e fretes observados
 *   - Valida isExtra em normais (false) e extras (true)
 *   - Valida campos mínimos por candidato
 *   - Valida ranks numéricos
 *   - Não chama Apps Script, OSRM, Supabase, Google Calendar
 *   - Não compara datas com o v2 (v2 ainda não tem disponibilidade real)
 *   - Não cria score/ranking novo
 *   - Não muta input
 */
export function compararFixtureLegadoComContratoV2(
  input: CompararFixtureLegadoInput
): ComparacaoLegadoV2Output {
  const { nomeFixture, fixtureLegado } = input

  const diferencas: string[] = []
  const avisos: string[] = [
    'Comparação estrutural baseada em fixture. Não chama Apps Script e não compara equivalência operacional final.',
    'v2 ainda usa disponibilidade sintética, Haversine diagnóstico e não consulta agenda real.',
  ]

  // ── 1. Validar responseInicio ─────────────────────────────────────────────

  const responseInicio = acessarProp(fixtureLegado, 'responseInicio')
  const temResponseInicio = responseInicio !== undefined && responseInicio !== null

  if (!temResponseInicio) {
    diferencas.push('Ausente: responseInicio')
  } else {
    const statusInicio = extrairString(
      acessarProp(fixtureLegado, 'responseInicio', 'body'),
      'status'
    )
    if (statusInicio !== 'started') {
      diferencas.push(
        `responseInicio.body.status esperado "started", encontrado "${statusInicio}"`
      )
    }
  }

  // ── 2. Validar responseDone e progress ────────────────────────────────────

  const responseDone = acessarProp(fixtureLegado, 'responseDone')
  const temResponseDone = responseDone !== undefined && responseDone !== null

  if (!temResponseDone) {
    diferencas.push('Ausente: responseDone')
  }

  const progress = acessarProp(fixtureLegado, 'responseDone', 'body', 'progress')

  if (temResponseDone) {
    const statusFinal = extrairString(progress, 'status')
    if (statusFinal !== 'done') {
      diferencas.push(
        `responseDone.body.progress.status esperado "done", encontrado "${statusFinal}"`
      )
    }
  }

  const statusLegado = extrairString(progress, 'status')

  // ── 3. Validar payload ────────────────────────────────────────────────────

  const payload = acessarProp(fixtureLegado, 'responseDone', 'body', 'progress', 'payload')
  const temPayloadFinal = payload !== undefined && payload !== null

  if (temResponseDone && !temPayloadFinal) {
    diferencas.push('Ausente: responseDone.body.progress.payload')
  }

  // ── 4. Validar candidates ─────────────────────────────────────────────────

  const candidatesRaw = acessarProp(
    fixtureLegado,
    'responseDone',
    'body',
    'progress',
    'payload',
    'candidates'
  )
  const temCandidates = Array.isArray(candidatesRaw)

  if (temPayloadFinal && !temCandidates) {
    diferencas.push('Ausente: responseDone.body.progress.payload.candidates')
  }

  // ── 5. Validar normais e extras ───────────────────────────────────────────

  const normaisRaw = acessarProp(fixtureLegado, 'responseDone', 'body', 'progress', 'normais')
  const temNormais = Array.isArray(normaisRaw)

  if (temResponseDone && !temNormais) {
    diferencas.push('Ausente: responseDone.body.progress.normais')
  }

  const extrasRaw = acessarProp(fixtureLegado, 'responseDone', 'body', 'progress', 'extras')
  const temExtras = Array.isArray(extrasRaw)

  if (temResponseDone && !temExtras) {
    diferencas.push('Ausente: responseDone.body.progress.extras')
  }

  // ── Extrair listas ────────────────────────────────────────────────────────

  const candidates: unknown[] = temCandidates ? (candidatesRaw as unknown[]) : []
  const normais: unknown[] = temNormais ? (normaisRaw as unknown[]) : []
  const extras: unknown[] = temExtras ? (extrasRaw as unknown[]) : []

  const quantidadePayloadCandidates = candidates.length
  const quantidadeNormais = normais.length
  const quantidadeExtras = extras.length

  // ── 6. Comparar quantidades ───────────────────────────────────────────────

  const candidatesBatemComNormaisMaisExtras =
    quantidadePayloadCandidates === quantidadeNormais + quantidadeExtras

  if (!candidatesBatemComNormaisMaisExtras) {
    diferencas.push(
      `payload.candidates.length (${quantidadePayloadCandidates}) !== normais.length (${quantidadeNormais}) + extras.length (${quantidadeExtras})`
    )
  }

  // ── 7. Extrair tipos, equipes e fretes ────────────────────────────────────

  const todosOsCandidatos = [...candidates, ...normais, ...extras]
  const tiposLegado = extrairStringsUnicas(
    todosOsCandidatos.map((c) => extrairString(c, 'tipo'))
  )
  const equipesLegado = extrairStringsUnicas(
    todosOsCandidatos.map((c) => extrairString(c, 'team'))
  )
  const fretesLegado = extrairStringsUnicas(
    todosOsCandidatos.map((c) => extrairString(c, 'frete'))
  )

  // ── 8. Validar isExtra em normais e extras ────────────────────────────────

  for (let i = 0; i < normais.length; i++) {
    const c = normais[i]
    if (c !== null && typeof c === 'object') {
      const isExtra = (c as Record<string, unknown>)['isExtra']
      if (isExtra !== false) {
        diferencas.push(
          `normais[${i}].isExtra esperado false, encontrado ${JSON.stringify(isExtra)}`
        )
      }
    }
  }

  for (let i = 0; i < extras.length; i++) {
    const c = extras[i]
    if (c !== null && typeof c === 'object') {
      const isExtra = (c as Record<string, unknown>)['isExtra']
      if (isExtra !== true) {
        diferencas.push(
          `extras[${i}].isExtra esperado true, encontrado ${JSON.stringify(isExtra)}`
        )
      }
    }
  }

  // ── 9. Validar campos mínimos por candidato ───────────────────────────────

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    if (c === null || typeof c !== 'object') {
      diferencas.push(`candidates[${i}] não é um objeto`)
      continue
    }
    const obj = c as Record<string, unknown>
    for (const campo of CAMPOS_MINIMOS_CANDIDATO) {
      if (!(campo in obj)) {
        diferencas.push(`candidates[${i}] ausente campo obrigatório: "${campo}"`)
      }
    }
  }

  // ── 10. Validar ranks numéricos ───────────────────────────────────────────

  let ranksSaoNumericos = true
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    if (c !== null && typeof c === 'object') {
      const rank = (c as Record<string, unknown>)['rank']
      if (typeof rank !== 'number') {
        diferencas.push(
          `candidates[${i}].rank não é numérico: ${JSON.stringify(rank)}`
        )
        ranksSaoNumericos = false
      }
    }
  }

  // ── Resultado ─────────────────────────────────────────────────────────────

  const ok = diferencas.length === 0

  return {
    ok,
    nomeFixture,
    resumo: {
      statusLegado,
      quantidadePayloadCandidates,
      quantidadeNormais,
      quantidadeExtras,
      tiposLegado,
      equipesLegado,
      fretesLegado,
    },
    contratoLegado: {
      temResponseInicio,
      temResponseDone,
      temPayloadFinal,
      temCandidates,
      temNormais,
      temExtras,
      candidatesBatemComNormaisMaisExtras,
      ranksSaoNumericos,
    },
    diferencas,
    avisos,
  }
}

function normalizarDataComparacao(dataISO: string): string {
  const valor = String(dataISO || '').trim()
  if (!valor) return ''
  const match = valor.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : valor
}

function equipeComparacao(candidato: CandidatoComparacaoLegadoV2): string {
  const raw = candidato.equipe ?? candidato.team ?? ''
  const normalizavel = String(raw)
    .replace(/\s*\(.*\)$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  return normalizarEquipe(normalizavel) ?? normalizavel
}

function chaveComparacao(candidato: CandidatoComparacaoLegadoV2): string {
  return `${normalizarDataComparacao(candidato.dataISO)}::${equipeComparacao(candidato)}`
}

function ordemComparacao(candidato: CandidatoComparacaoLegadoV2): number | null {
  if (typeof candidato.ordem === 'number' && Number.isFinite(candidato.ordem)) {
    return candidato.ordem
  }
  if (typeof candidato.rank === 'number' && Number.isFinite(candidato.rank)) {
    return candidato.rank
  }
  return null
}

function motivoComparacao(candidato: CandidatoComparacaoLegadoV2): string | null {
  if (typeof candidato.motivo === 'string') return candidato.motivo
  if (Array.isArray(candidato.motivos)) return candidato.motivos.join(' | ')
  return null
}

function horaMarcadaComparacao(candidato: CandidatoComparacaoLegadoV2): boolean | null {
  if (typeof candidato.elegivelHoraMarcada === 'boolean') return candidato.elegivelHoraMarcada
  if (typeof candidato.horaMarcada === 'boolean') return candidato.horaMarcada
  if (candidato.tipo === 'hora-marcada') return true
  return null
}

function resolverChaveCandidato(c: CandidatoComparacaoLegadoV2): {
  chave: string
  estrategia: 'comparacaoKey' | 'dataISO-equipe-fallback'
} {
  const ck = c.comparacaoKey
  if (typeof ck === 'string' && ck.trim().length > 0) {
    return { chave: ck.trim(), estrategia: 'comparacaoKey' }
  }
  return { chave: chaveComparacao(c), estrategia: 'dataISO-equipe-fallback' }
}

function indexarCandidatosComparacao(
  candidatos: CandidatoComparacaoLegadoV2[],
  origem: 'legado' | 'v2',
  avisos: string[],
  duplicidades: DuplicidadeChaveComparacao[]
): {
  mapa: Map<string, CandidatoComparacaoLegadoV2>
  estrategias: Set<'comparacaoKey' | 'dataISO-equipe-fallback'>
} {
  const mapa = new Map<string, CandidatoComparacaoLegadoV2>()
  const estrategias = new Set<'comparacaoKey' | 'dataISO-equipe-fallback'>()
  // Rastrear colisões por chave: chave → indices
  const indicePorChave = new Map<string, number[]>()

  candidatos.forEach((c, idx) => {
    const { chave, estrategia } = resolverChaveCandidato(c)
    estrategias.add(estrategia)

    if (estrategia === 'dataISO-equipe-fallback') {
      if (!normalizarDataComparacao(c.dataISO) || !equipeComparacao(c)) {
        avisos.push(`${origem}[${idx}] sem dataISO/equipe validos para chave de comparacao.`)
        return
      }
    }

    const existentes = indicePorChave.get(chave) ?? []
    existentes.push(idx)
    indicePorChave.set(chave, existentes)

    if (!mapa.has(chave)) {
      mapa.set(chave, c)
    }
  })

  // Registrar duplicidades após varredura completa
  for (const [chave, indices] of indicePorChave.entries()) {
    if (indices.length > 1) {
      const { estrategia } = resolverChaveCandidato(candidatos[indices[0]])
      duplicidades.push({
        chave,
        origem,
        quantidade: indices.length,
        indices,
        observacao:
          estrategia === 'comparacaoKey'
            ? `Chave comparacaoKey duplicada em ${origem}; comparacaoKey deve ser unica.`
            : `Chave dataISO+equipe duplicada em ${origem}; preservado indice ${indices[0]}.`,
      })
      if (estrategia === 'comparacaoKey') {
        avisos.push(
          `[ERRO-ENTRADA] ${origem} tem comparacaoKey duplicada: "${chave}" (indices ${indices.join(', ')}). comparacaoKey deve ser unica.`
        )
      } else {
        avisos.push(
          `[AVISO] ${origem} tem chave dataISO+equipe duplicada: "${chave}" (indices ${indices.join(', ')}); preservado primeiro candidato. Considere usar comparacaoKey para distinguir candidatos na mesma data/equipe.`
        )
      }
    }
  }

  return { mapa, estrategias }
}

function criarDivergencia(
  chave: string,
  campo: string,
  legado: unknown,
  v2: unknown,
  tipoDivergencia: TipoDivergenciaComparacaoLegadoV2,
  severidade: SeveridadeDivergenciaComparacaoLegadoV2,
  observacao: string
): DivergenciaComparacaoLegadoV2 {
  const [dataISO, equipe] = chave.split('::')
  return {
    chave,
    dataISO,
    equipe,
    campo,
    legado,
    v2,
    tipoDivergencia,
    severidade,
    observacao,
  }
}

function compararBooleanoOpcional(
  divergencias: DivergenciaComparacaoLegadoV2[],
  chave: string,
  campo: keyof Pick<CandidatoComparacaoLegadoV2, 'slotTemPontos'>,
  legado: CandidatoComparacaoLegadoV2,
  v2: CandidatoComparacaoLegadoV2
) {
  if (
    typeof legado[campo] === 'boolean' &&
    typeof v2[campo] === 'boolean' &&
    legado[campo] !== v2[campo]
  ) {
    divergencias.push(criarDivergencia(
      chave,
      campo,
      legado[campo],
      v2[campo],
      'slot',
      'avaliar',
      'Campo de slot diferente entre legado controlado e v2 diagnostica.'
    ))
  }
}

function compararNumeroOpcional(
  divergencias: DivergenciaComparacaoLegadoV2[],
  chave: string,
  campo: keyof Pick<
    CandidatoComparacaoLegadoV2,
    'limiteBaseM' | 'limiteEspecialM' | 'limitePremiumM'
  >,
  legado: CandidatoComparacaoLegadoV2,
  v2: CandidatoComparacaoLegadoV2
) {
  const valorLegado = legado[campo]
  const valorV2 = v2[campo]
  if (
    typeof valorLegado === 'number' &&
    Number.isFinite(valorLegado) &&
    typeof valorV2 === 'number' &&
    Number.isFinite(valorV2) &&
    valorLegado !== valorV2
  ) {
    divergencias.push(criarDivergencia(
      chave,
      campo,
      valorLegado,
      valorV2,
      'limite',
      'avaliar',
      'Limite operacional diferente entre legado controlado e v2 diagnostica.'
    ))
  }
}

export function compararPayloadLegadoComV2Diagnostico(
  input: CompararPayloadLegadoComV2Input
): ComparacaoAmplaLegadoV2Output {
  const toleranciaKmAdicionalM =
    typeof input.toleranciaKmAdicionalM === 'number' &&
    Number.isFinite(input.toleranciaKmAdicionalM) &&
    input.toleranciaKmAdicionalM >= 0
      ? input.toleranciaKmAdicionalM
      : 2
  const avisos: string[] = [
    'Comparacao legado x v2 diagnostica com payload legado controlado. Nao chama Apps Script real.',
    'Ordem/rank e informativo nesta primeira versao.',
  ]
  const divergencias: DivergenciaComparacaoLegadoV2[] = []
  const duplicidadesArray: DuplicidadeChaveComparacao[] = []
  const { mapa: legadoPorChave, estrategias: estrategiasLegado } =
    indexarCandidatosComparacao(input.candidatosLegado, 'legado', avisos, duplicidadesArray)
  const { mapa: v2PorChave, estrategias: estrategiasV2 } =
    indexarCandidatosComparacao(input.candidatosV2, 'v2', avisos, duplicidadesArray)

  const todasEstrategias = new Set([...estrategiasLegado, ...estrategiasV2])
  const estrategiaChave: EstrategiaChaveComparacaoLegadoV2 =
    todasEstrategias.has('comparacaoKey') && todasEstrategias.has('dataISO-equipe-fallback')
      ? 'mista'
      : todasEstrategias.has('comparacaoKey')
        ? 'comparacaoKey'
        : 'dataISO-equipe-fallback'

  avisos.unshift(`Chave usada: ${estrategiaChave}.`)

  // Verificar se há duplicidade com comparacaoKey — invalida a entrada
  const duplicidadesComKey = duplicidadesArray.filter((d) => {
    const candidatosOrigem =
      d.origem === 'legado' ? input.candidatosLegado : input.candidatosV2
    if (d.indices.length === 0) return false
    const { estrategia } = resolverChaveCandidato(candidatosOrigem[d.indices[0]])
    return estrategia === 'comparacaoKey'
  })

  const chaves = [...new Set([...legadoPorChave.keys(), ...v2PorChave.keys()])].sort()
  const presentesNosDois: Array<{
    chave: string
    legado: CandidatoComparacaoLegadoV2
    v2: CandidatoComparacaoLegadoV2
  }> = []

  for (const chave of chaves) {
    const legado = legadoPorChave.get(chave)
    const v2 = v2PorChave.get(chave)

    if (!legado) {
      divergencias.push(criarDivergencia(
        chave,
        'presenca',
        null,
        v2 ?? null,
        'ausente-no-legado',
        'bloqueante',
        'Candidato existe na v2 e nao existe no payload legado controlado.'
      ))
      continue
    }

    if (!v2) {
      divergencias.push(criarDivergencia(
        chave,
        'presenca',
        legado,
        null,
        'ausente-na-v2',
        'bloqueante',
        'Candidato existe no legado e nao existe na v2 diagnostica.'
      ))
      continue
    }

    presentesNosDois.push({ chave, legado, v2 })

    if (legado.tipo !== undefined && v2.tipo !== undefined && legado.tipo !== v2.tipo) {
      divergencias.push(criarDivergencia(
        chave,
        'tipo',
        legado.tipo,
        v2.tipo,
        'tipo',
        'bloqueante',
        'Tipo operacional diferente.'
      ))
    }

    if (
      typeof legado.elegivel === 'boolean' &&
      typeof v2.elegivel === 'boolean' &&
      legado.elegivel !== v2.elegivel
    ) {
      divergencias.push(criarDivergencia(
        chave,
        'elegivel',
        legado.elegivel,
        v2.elegivel,
        'elegibilidade',
        'bloqueante',
        'Elegibilidade diferente.'
      ))
    }

    const horaLegado = horaMarcadaComparacao(legado)
    const horaV2 = horaMarcadaComparacao(v2)
    if (horaLegado !== null && horaV2 !== null && horaLegado !== horaV2) {
      divergencias.push(criarDivergencia(
        chave,
        'horaMarcada',
        horaLegado,
        horaV2,
        'hora-marcada',
        'bloqueante',
        'Elegibilidade de hora marcada diferente.'
      ))
    }

    if (
      typeof legado.kmAdicionalNaRotaM === 'number' &&
      Number.isFinite(legado.kmAdicionalNaRotaM) &&
      typeof v2.kmAdicionalNaRotaM === 'number' &&
      Number.isFinite(v2.kmAdicionalNaRotaM)
    ) {
      const diff = Math.abs(legado.kmAdicionalNaRotaM - v2.kmAdicionalNaRotaM)
      if (diff > toleranciaKmAdicionalM) {
        divergencias.push(criarDivergencia(
          chave,
          'kmAdicionalNaRotaM',
          legado.kmAdicionalNaRotaM,
          v2.kmAdicionalNaRotaM,
          'km',
          legado.tipo !== v2.tipo ? 'bloqueante' : 'avaliar',
          `Diferenca de ${diff}m acima da tolerancia de ${toleranciaKmAdicionalM}m.`
        ))
      }
    }

    compararBooleanoOpcional(divergencias, chave, 'slotTemPontos', legado, v2)
    compararNumeroOpcional(divergencias, chave, 'limiteBaseM', legado, v2)
    compararNumeroOpcional(divergencias, chave, 'limiteEspecialM', legado, v2)
    compararNumeroOpcional(divergencias, chave, 'limitePremiumM', legado, v2)

    const ordemLegado = ordemComparacao(legado)
    const ordemV2 = ordemComparacao(v2)
    if (ordemLegado !== null && ordemV2 !== null && ordemLegado !== ordemV2) {
      divergencias.push(criarDivergencia(
        chave,
        'ordem',
        ordemLegado,
        ordemV2,
        'ordem',
        'informativo',
        'Ordem/rank ainda nao bloqueia equivalencia nesta primeira versao.'
      ))
    }

    const motivoLegado = motivoComparacao(legado)
    const motivoV2 = motivoComparacao(v2)
    if (motivoLegado !== null && motivoV2 !== null && motivoLegado !== motivoV2) {
      divergencias.push(criarDivergencia(
        chave,
        'motivo',
        motivoLegado,
        motivoV2,
        'motivo',
        'avaliar',
        'Motivo/motivos divergentes.'
      ))
    }
  }

  const contar = (tipo: TipoDivergenciaComparacaoLegadoV2) =>
    divergencias.filter((d) => d.tipoDivergencia === tipo).length

  const duplicidadesLegado = duplicidadesArray.filter((d) => d.origem === 'legado')
  const duplicidadesV2 = duplicidadesArray.filter((d) => d.origem === 'v2')

  // ok = false se houver divergências bloqueantes OU duplicidade com comparacaoKey
  const temDivergenciaBloqueante = divergencias.some((d) => d.severidade === 'bloqueante')
  const ok = !temDivergenciaBloqueante && duplicidadesComKey.length === 0

  return {
    ok,
    modo: 'comparacao-legado-v2-diagnostico',
    producaoAfetada: false,
    estrategiaChave,
    toleranciaKmAdicionalM,
    resumo: {
      candidatosLegado: input.candidatosLegado.length,
      candidatosV2: input.candidatosV2.length,
      chavesComparadas: chaves.length,
      presentesNosDois: presentesNosDois.length,
      apenasNoLegado: contar('ausente-na-v2'),
      apenasNaV2: contar('ausente-no-legado'),
      divergenciasTipo: contar('tipo'),
      divergenciasElegibilidade: contar('elegibilidade'),
      divergenciasHoraMarcada: contar('hora-marcada'),
      divergenciasKm: contar('km'),
      divergenciasSlot: contar('slot'),
      divergenciasLimite: contar('limite'),
      divergenciasOrdem: contar('ordem'),
      divergenciasMotivo: contar('motivo'),
      chavesDuplicadasLegado: duplicidadesLegado.length,
      chavesDuplicadasV2: duplicidadesV2.length,
    },
    divergencias,
    duplicidades: {
      legado: duplicidadesLegado,
      v2: duplicidadesV2,
    },
    amostras: {
      legado: input.candidatosLegado.slice(0, 10),
      v2: input.candidatosV2.slice(0, 10),
      presentesNosDois: presentesNosDois.slice(0, 10),
    },
    avisos,
  }
}

// ─── Helper para gerar comparacaoKey em candidatos v2 (diagnostico) ─────────────

/**
 * Gera comparacaoKey para candidatos v2 diagnósticos.
 * Formato: dataISO::equipeNormalizada::fonteV2::ordemLocal
 * ordemLocal é um contador dentro do grupo (dataISO, equipeNormalizada).
 * Não usa tipo na chave para preservar detecção de divergência de tipo.
 */
export function gerarComparacaoKeyV2Diagnostico(
  candidatos: CandidatoComparacaoLegadoV2[],
  fonteV2: string
): CandidatoComparacaoLegadoV2[] {
  const normalizarEquipe = (equipe: string): string => {
    return equipe.trim().toUpperCase().replace(/\s+/g, ' ')
  }

  // Agrupar por (dataISO, equipeNormalizada) para contar ordemLocal
  const grupos = new Map<string, number>()
  const chaveGrupo = (dataISO: string, equipe: string): string => {
    return `${dataISO}::${normalizarEquipe(equipe)}`
  }

  return candidatos.map((c) => {
    // Validar campos obrigatorios para gerar chave
    if (!c.dataISO || !c.equipe) {
      return {
        ...c,
        comparacaoKey: null,
      }
    }

    const grupo = chaveGrupo(c.dataISO, c.equipe as string)
    const ordemLocal = (grupos.get(grupo) ?? 0) + 1
    grupos.set(grupo, ordemLocal)

    const comparacaoKey = `${c.dataISO}::${normalizarEquipe(c.equipe as string)}::${fonteV2}::${ordemLocal}`

    return {
      ...c,
      comparacaoKey,
    }
  })
}
