import { fetchDigisac } from './clienteDigisac'
import type { DigisacMensagem } from './sgi-sync'

export const MENSAGENS_CONTATO_PER_PAGE = 100
export const MENSAGENS_CONTATO_MAX_PAGES = 10
export const MENSAGENS_CONTATO_MAX_MESSAGES = 1000

export type BuscarMensagensContatoOptions = {
  perPage?: number
  maxPages?: number
  maxMessages?: number
  inicioISO?: string | null
  fimISO?: string | null
}

export type BuscarMensagensContatoResultado = {
  mensagens: DigisacMensagem[]
  totalApi: number
  paginasBuscadas: number
  totalColetado: number
  truncado: boolean
}

type DigisacMessagesResponse = {
  data?: DigisacMensagem[]
  total?: number
  currentPage?: number
  lastPage?: number
}

function timestampMs(timestamp: DigisacMensagem['timestamp']): number | null {
  if (timestamp == null || timestamp === '') return null
  const ms = typeof timestamp === 'number' ? timestamp * 1000 : Date.parse(timestamp)
  return Number.isFinite(ms) ? ms : null
}

function naJanela(msg: DigisacMensagem, inicioMs: number | null, fimMs: number | null): boolean {
  const ms = timestampMs(msg.timestamp)
  if (ms == null) return false
  if (inicioMs != null && ms < inicioMs) return false
  if (fimMs != null && ms > fimMs) return false
  return true
}

export async function buscarMensagensContatoPaginado(
  contactId: string,
  options: BuscarMensagensContatoOptions = {}
): Promise<BuscarMensagensContatoResultado> {
  const perPage = options.perPage ?? MENSAGENS_CONTATO_PER_PAGE
  const maxPages = options.maxPages ?? MENSAGENS_CONTATO_MAX_PAGES
  const maxMessages = options.maxMessages ?? MENSAGENS_CONTATO_MAX_MESSAGES
  const inicioMs = options.inicioISO ? Date.parse(options.inicioISO) : null
  const fimMs = options.fimISO ? Date.parse(options.fimISO) : null

  const mensagens: DigisacMensagem[] = []
  const ids = new Set<string>()
  let totalApi = 0
  let paginasBuscadas = 0
  let truncado = false

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams()
    params.set('where[contactId]', contactId)
    params.set('perPage', String(perPage))
    params.set('page', String(page))
    params.set('order[0][0]', 'timestamp')
    params.set('order[0][1]', 'DESC')

    const resp: DigisacMessagesResponse = await fetchDigisac(`/messages?${params.toString()}`)
    const items = Array.isArray(resp?.data) ? resp.data : []
    totalApi = Math.max(totalApi, Number(resp?.total ?? 0))
    paginasBuscadas = page

    for (const item of items) {
      if (!naJanela(item, inicioMs, fimMs)) continue
      if (item.id) {
        if (ids.has(item.id)) continue
        ids.add(item.id)
      }
      mensagens.push(item)
      if (mensagens.length >= maxMessages) {
        truncado = true
        break
      }
    }

    if (mensagens.length >= maxMessages) break

    const lastPage = Number(resp?.lastPage ?? 1)
    if (items.length < perPage || page >= lastPage) {
      break
    }
    if (page === maxPages && page < lastPage) {
      truncado = true
    }
  }

  mensagens.sort((a, b) => (timestampMs(a.timestamp) ?? 0) - (timestampMs(b.timestamp) ?? 0))

  return {
    mensagens,
    totalApi,
    paginasBuscadas,
    totalColetado: mensagens.length,
    truncado,
  }
}
