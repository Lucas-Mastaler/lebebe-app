/**
 * Helpers de apresentação para a tela de /procurar-datas e auditoria.
 * Puramente de formatação visual — não altera regra de negócio.
 */

/**
 * Extrai ano/mês/dia de uma string de data, tratando:
 * - YYYY-MM-DD
 * - ISO string (YYYY-MM-DDTHH:MM:SS.sssZ)
 * - Date object
 * Retorna null se não for possível extrair.
 */
function extrairYMD(valor: unknown): { year: number; month: number; day: number } | null {
  if (valor === null || valor === undefined || valor === '') return null

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    return { year: valor.getFullYear(), month: valor.getMonth() + 1, day: valor.getDate() }
  }

  if (typeof valor === 'string') {
    const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    }
    const date = new Date(valor)
    if (!Number.isNaN(date.getTime())) {
      return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
    }
  }

  return null
}

/**
 * Formata uma data para dd/mm/aaaa.
 * Trata YYYY-MM-DD, ISO string (com timezone), Date, nulo/undefined.
 * Usa os componentes de data local (não UTC) para evitar erro de dia anterior.
 */
export function formatarDataBrasileira(valor: unknown): string {
  const ymd = extrairYMD(valor)
  if (!ymd) return '-'
  const dd = String(ymd.day).padStart(2, '0')
  const mm = String(ymd.month).padStart(2, '0')
  return `${dd}/${mm}/${ymd.year}`
}

/**
 * Calcula a diferença em dias entre duas datas.
 * @param dataDestino - data do resultado (YYYY-MM-DD, ISO string, Date)
 * @param dataReferencia - data de referência (default: hoje do navegador)
 * @returns número de dias ou null se não for possível calcular
 */
export function calcularDiasAteData(
  dataDestino: unknown,
  dataReferencia?: unknown,
): number | null {
  const destino = extrairYMD(dataDestino)
  if (!destino) return null

  let ref: { year: number; month: number; day: number }
  if (dataReferencia !== undefined && dataReferencia !== null && dataReferencia !== '') {
    const parsed = extrairYMD(dataReferencia)
    if (!parsed) return null
    ref = parsed
  } else {
    const hoje = new Date()
    ref = { year: hoje.getFullYear(), month: hoje.getMonth() + 1, day: hoje.getDate() }
  }

  const target = new Date(destino.year, destino.month - 1, destino.day)
  target.setHours(0, 0, 0, 0)

  const reference = new Date(ref.year, ref.month - 1, ref.day)
  reference.setHours(0, 0, 0, 0)

  const diffMs = target.getTime() - reference.getTime()
  return Math.round(diffMs / 86400000)
}

/**
 * Formata o resultado de calcularDiasAteData como string visual.
 * Retorna "N d" para positivo, "-" para negativo ou null.
 */
export function formatarDiasAteData(
  dataDestino: unknown,
  dataReferencia?: unknown,
): string {
  const diff = calcularDiasAteData(dataDestino, dataReferencia)
  if (diff === null) return '-'
  if (diff < 0) return '-'
  return `${diff} d`
}

/**
 * Estrutura legível extraída do payload de pré-agendamento.
 */
export interface ResumoPreAgendamento {
  equipe: string
  tipo: string
  frete: string
  dataEscolhida: string
  cep: string
  regiaoLabel: string
  tempoNecessario: string
  endereco: string
  autoriaEmail: string
  autoriaNome: string
}

/**
 * Extrai campos legíveis do payload de pré-agendamento.
 * O payload tem estrutura { cand: {...}, meta: {...} }.
 * Se o formato for inesperado, retorna null para indicar fallback.
 */
export function extrairResumoPreAgendamento(payload: unknown): ResumoPreAgendamento | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

  const obj = payload as Record<string, unknown>
  const cand = obj.cand
  const meta = obj.meta

  if (!cand || typeof cand !== 'object' || Array.isArray(cand)) return null
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null

  const candRec = cand as Record<string, unknown>
  const metaRec = meta as Record<string, unknown>

  const autoria = metaRec.autoria
  const autoriaRec = autoria && typeof autoria === 'object' && !Array.isArray(autoria)
    ? autoria as Record<string, unknown>
    : {}

  const tipo = typeof candRec.tipo === 'string' && candRec.tipo
    ? candRec.tipo.charAt(0).toUpperCase() + candRec.tipo.slice(1)
    : '-'

  return {
    equipe: typeof candRec.team === 'string' && candRec.team ? candRec.team : '-',
    tipo,
    frete: typeof candRec.frete === 'string' && candRec.frete ? candRec.frete : '-',
    dataEscolhida: formatarDataBrasileira(candRec.dateISO ?? candRec.date),
    cep: typeof metaRec.cep === 'string' && metaRec.cep ? metaRec.cep : '-',
    regiaoLabel: typeof metaRec.label === 'string' && metaRec.label ? metaRec.label : '-',
    tempoNecessario: typeof metaRec.tempo === 'string' && metaRec.tempo ? metaRec.tempo : '-',
    endereco: typeof metaRec.address === 'string' && metaRec.address ? metaRec.address : '-',
    autoriaEmail: typeof autoriaRec.email === 'string' && autoriaRec.email ? autoriaRec.email : '-',
    autoriaNome: typeof autoriaRec.nome === 'string' && autoriaRec.nome ? autoriaRec.nome : '-',
  }
}
