// ─────────────────────────────────────────────────────────────────────────────
// motor/adaptador-candidato-legado.ts  —  Adaptador diagnóstico v2 → contrato legado
//
// Converte CandidatoPreliminarV2 para o formato observado nas fixtures reais
// do legado (estrutura similar a CandidatoFinal), com campo adicional
// diagnosticoV2 para rastreabilidade.
//
// Escopo: exclusivamente diagnóstico — NÃO integrado em produção.
//
// NÃO FAZ:
//   - Não consulta Apps Script, OSRM, Supabase, Google Calendar, agenda, planilha
//   - Não calcula ranking (rank vem como parâmetro externo)
//   - Não recalcula frete
//   - Não aplica ajuste +20%
//   - Não lança erros
//   - Não muta o input
// ─────────────────────────────────────────────────────────────────────────────

import type { CandidatoPreliminarV2 } from './candidato'

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Mapa de diaSemana (0=Domingo, 1=Segunda, …, 6=Sábado) para nome PT-BR.
 *  Conforme getUTCDay() usado em janela-datas.ts. */
const NOMES_DIAS_SEMANA_PT: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
}

/** Tipos de candidato que correspondem a isExtra: true no legado.
 *  Confirmado nas fixtures para premium e especial.
 *  Para hora-marcada, inferido da documentação (não confirmado em fixture real). */
const TIPOS_COM_IS_EXTRA = new Set<string>(['premium', 'especial', 'hora-marcada'])

export type FormatoDateISOLegadoDiagnostico = 'v2' | 'legado-gmt3'

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Entrada para adaptarCandidatoV2ParaContratoLegadoDiagnostico. */
export interface AdaptarCandidatoV2ParaContratoLegadoDiagnosticoInput {
  candidato: CandidatoPreliminarV2
  rank: number
  dataReferenciaISO?: string | null
  /** Padrao: 'v2'. 'legado-gmt3' emite o sufixo observado nas fixtures: T03:00:00.000Z. */
  formatoDateISO?: FormatoDateISOLegadoDiagnostico
}

/**
 * Candidato no formato do contrato legado observado nas fixtures, com campo
 * adicional `diagnosticoV2` para rastreabilidade diagnóstica.
 *
 * Diferenças conhecidas em relação ao `CandidatoFinal` do legado:
 *
 * 1. `dateISO`: por padrao preserva o formato v2 (YYYY-MM-DD). Quando
 *    `formatoDateISO` for "legado-gmt3", emite o sufixo observado nas fixtures:
 *    `T03:00:00.000Z`.
 *
 * 2. `encomenda`: v2 não modela encomenda ainda. Valor padrão: "Não".
 *    Registrado em `diagnosticoV2.avisos`.
 *
 * 3. `isExtra` para `hora-marcada`: definido como `true` com base na
 *    documentação dos contratos (seção 9.2 de procurar-datas-contratos-payloads.md).
 *    Não confirmado em fixture real de hora-marcada — registrado como pendente
 *    em `diagnosticoV2.avisos`.
 */
export interface CandidatoLegadoDiagnosticoV2 {
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
  avisoHoraMarcada: string
  diagnosticoV2: {
    id: string
    elegivel: boolean
    origem: 'v2-adaptado-diagnostico'
    motivos: string[]
    avisos: string[]
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Formata YYYY-MM-DD (ou ISO com sufixo) para DD/MM sem criar objeto Date.
 *  Usa o prefixo YYYY-MM-DD, ignorando sufixos como T03:00:00.000Z.
 *  Retorna a string original se o formato não for reconhecido. */
function formatarDM(dataISO: string): string {
  const match = dataISO.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return dataISO
  return `${match[3]}/${match[2]}`
}

function formatarDateISOContrato(dataISO: string, formato: FormatoDateISOLegadoDiagnostico): string {
  const base = dataISO.split('T')[0] ?? ''
  if (formato === 'legado-gmt3' && /^\d{4}-\d{2}-\d{2}$/.test(base)) {
    return `${base}T03:00:00.000Z`
  }
  return dataISO
}

/**
 * Calcula diferença absoluta em dias entre duas strings no formato YYYY-MM-DD.
 * Ignora sufixos ISO (T...) caso presentes.
 * Usa Date.UTC para evitar deslocamento por timezone.
 * Retorna null se qualquer data for inválida.
 */
function diffDiasISO(de: string, para: string): number | null {
  const dePart = de.split('T')[0]
  const paraPart = para.split('T')[0]
  const re = /^(\d{4})-(\d{2})-(\d{2})$/
  const matchDe = dePart.match(re)
  const matchPara = paraPart.match(re)
  if (!matchDe || !matchPara) return null
  const dDe = Date.UTC(Number(matchDe[1]), Number(matchDe[2]) - 1, Number(matchDe[3]))
  const dPara = Date.UTC(Number(matchPara[1]), Number(matchPara[2]) - 1, Number(matchPara[3]))
  return Math.abs(Math.round((dPara - dDe) / 86400000))
}

/**
 * Formata valor numérico como "R$ X":
 *   - Sem casas decimais se inteiro (ex: 110 → "R$ 110")
 *   - Com 2 casas decimais separadas por vírgula se fracionário (ex: 110.5 → "R$ 110,50")
 * Conforme padrão observado nas fixtures do legado (todos inteiros nas fixtures capturadas).
 */
function formatarFreteNumero(valor: number): string {
  if (Number.isInteger(valor)) return `R$ ${valor}`
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

// ─── Função principal ──────────────────────────────────────────────────────────

/**
 * Adapta um CandidatoPreliminarV2 para o formato do contrato legado
 * observado nas fixtures reais do Apps Script.
 *
 * Serve exclusivamente para diagnóstico e comparação estrutural.
 * Não integrado na rota de produção.
 *
 * Regras de mapeamento:
 *   - dateISO         → candidato.dataISO (YYYY-MM-DD; ver nota de formato na interface)
 *   - dateDM          → candidato.dataISO formatado como DD/MM (sem criar Date)
 *   - weekday         → nome PT-BR a partir de candidato.diaSemana (0=Domingo..6=Sábado, UTC)
 *   - tipo            → candidato.tipo (cópia direta)
 *   - isExtra         → true para premium, especial, hora-marcada; false para demais
 *   - frete           → candidato.frete.valorFrete formatado como "R$ X"
 *   - rank            → parâmetro rank (não calculado aqui)
 *   - team            → candidato.equipe (cópia direta)
 *   - daysLeftTxt     → "${diff} d" entre dataReferenciaISO e candidato.dataISO (absoluto)
 *   - encomenda       → "Não" (padrão; v2 não modela encomenda ainda)
 *   - avisoHoraMarcada→ aviso diagnóstico se tipo === "hora-marcada", senão ""
 *
 * Não lança erros — situações anômalas ficam em diagnosticoV2.avisos.
 * Não muta o input.
 */
export function adaptarCandidatoV2ParaContratoLegadoDiagnostico(
  input: AdaptarCandidatoV2ParaContratoLegadoDiagnosticoInput
): CandidatoLegadoDiagnosticoV2 {
  const { candidato, rank, dataReferenciaISO, formatoDateISO = 'v2' } = input
  const adaptadorAvisos: string[] = []

  // ── dateISO ─────────────────────────────────────────────────────────────────
  // Padrao v2: YYYY-MM-DD. Modo legado-gmt3: sufixo fixo observado nas fixtures.
  const dateISO = formatarDateISOContrato(candidato.dataISO ?? '', formatoDateISO)

  // ── dateDM ───────────────────────────────────────────────────────────────────
  const dateDM = formatarDM(candidato.dataISO ?? '')

  // ── weekday ──────────────────────────────────────────────────────────────────
  const nomeDia = NOMES_DIAS_SEMANA_PT[candidato.diaSemana]
  const weekday = nomeDia ?? ''
  if (nomeDia === undefined) {
    adaptadorAvisos.push(
      `weekday: diaSemana ${candidato.diaSemana} fora do intervalo esperado (0-6). Nome do dia não mapeado.`
    )
  }

  // ── tipo ─────────────────────────────────────────────────────────────────────
  const tipo = candidato.tipo ?? ''

  // ── isExtra ──────────────────────────────────────────────────────────────────
  const isExtra = TIPOS_COM_IS_EXTRA.has(candidato.tipo)
  if (candidato.tipo === 'hora-marcada') {
    adaptadorAvisos.push(
      'isExtra para hora-marcada: definido como true com base na documentação dos contratos. Não confirmado em fixture real de hora-marcada (pendente).'
    )
  }

  // ── frete ────────────────────────────────────────────────────────────────────
  let frete = ''
  const valorFrete = candidato.frete?.valorFrete
  if (valorFrete === null || valorFrete === undefined) {
    adaptadorAvisos.push('frete: valorFrete ausente ou nulo. Usando string vazia.')
  } else if (!Number.isFinite(valorFrete)) {
    adaptadorAvisos.push(
      `frete: valorFrete não é um número finito (${String(valorFrete)}). Usando string vazia.`
    )
  } else {
    frete = formatarFreteNumero(valorFrete)
  }

  // ── daysLeftTxt ───────────────────────────────────────────────────────────────
  let daysLeftTxt = ''
  const dataRefNorm =
    typeof dataReferenciaISO === 'string' && dataReferenciaISO.trim().length > 0
      ? dataReferenciaISO.trim()
      : null
  if (!dataRefNorm) {
    adaptadorAvisos.push(
      'daysLeftTxt: dataReferenciaISO não fornecida. Retornando string vazia. Forneça a data de referência (ex: data de hoje ou data inicial da pesquisa).'
    )
  } else {
    const dataDestino = (candidato.dataISO ?? '').split('T')[0]
    const diff = diffDiasISO(dataRefNorm, dataDestino)
    if (diff === null) {
      adaptadorAvisos.push(
        `daysLeftTxt: não foi possível calcular diferença de dias. dataReferenciaISO="${dataRefNorm}", dataISO="${candidato.dataISO}". Retornando string vazia.`
      )
    } else {
      daysLeftTxt = `${diff} d`
    }
  }

  // ── encomenda ────────────────────────────────────────────────────────────────
  const encomenda = 'Não'
  adaptadorAvisos.push(
    'encomenda: v2 ainda não modela encomenda. Valor padrão diagnóstico: "Não".'
  )

  // ── avisoHoraMarcada ──────────────────────────────────────────────────────────
  const avisoHoraMarcada =
    candidato.tipo === 'hora-marcada'
      ? 'Diagnóstico v2: candidato classificado como hora marcada. Horário específico não disponível no v2 preliminar.'
      : ''

  // ── diagnosticoV2 ─────────────────────────────────────────────────────────────
  const diagnosticoV2 = {
    id: candidato.id ?? '',
    elegivel: candidato.elegivel ?? false,
    origem: 'v2-adaptado-diagnostico' as const,
    motivos: [...(candidato.motivos ?? [])],
    avisos: [...(candidato.avisos ?? []), ...adaptadorAvisos],
  }

  return {
    dateISO,
    dateDM,
    weekday,
    tipo,
    isExtra,
    frete,
    rank,
    team: candidato.equipe ?? '',
    daysLeftTxt,
    encomenda,
    avisoHoraMarcada,
    diagnosticoV2,
  }
}
