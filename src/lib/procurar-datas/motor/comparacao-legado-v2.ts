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
