import { HUB_VENDAS_LOJAS } from './constants'

export type HubVendasDigisacMessage = {
  id?: unknown
  isFromMe?: unknown
  sent?: unknown
  type?: unknown
  timestamp?: unknown
  visible?: unknown
  contactId?: unknown
  serviceId?: unknown
  ticketId?: unknown
  ticketDepartmentId?: unknown
  origin?: unknown
  userId?: unknown
  isComment?: unknown
  text?: unknown
  isFromBot?: unknown
  interactive?: unknown
  data?: unknown
}

export type HubVendasWebhookPayload = {
  event?: unknown
  data?: unknown
}

export type HubVendasMensagemValidada = {
  event: 'message.created'
  messageId: string
  contactId: string | null
  serviceId: string
  ticketId: string | null
  timestampEvento: Date
  texto: string
  data: HubVendasDigisacMessage
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function extrairTextoMensagemDigisac(data: HubVendasDigisacMessage): string {
  const textoDireto = asString(data.text)
  if (textoDireto) return textoDireto

  const interactive = asRecord(data.interactive)
  const interactiveBody = asRecord(interactive?.body)
  const interactiveBodyText = asString(interactiveBody?.text)
  if (interactiveBodyText) return interactiveBodyText

  const dataInterna = asRecord(data.data)
  const dataText = asString(dataInterna?.text)
  if (dataText) return dataText

  const dataInternaInteractive = asRecord(dataInterna?.interactive)
  const dataInternaInteractiveBody = asRecord(dataInternaInteractive?.body)
  const dataInternaInteractiveBodyText = asString(dataInternaInteractiveBody?.text)
  if (dataInternaInteractiveBodyText) return dataInternaInteractiveBodyText

  return ''
}

export function normalizarTextoHubVendas(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function pareceSaudacaoHubVendas(texto: string): boolean {
  const normalizado = normalizarTextoHubVendas(texto)
  const compacto = normalizado.replace(/\s+/g, '')
  const digitos = texto.replace(/\D/g, '')
  const numerosEncontrados = Object.values(HUB_VENDAS_LOJAS).filter((loja) =>
    digitos.includes(loja.numero)
  ).length

  return (
    normalizado.includes('central de atendimento') &&
    (normalizado.includes('le bebe') || compacto.includes('lebebe')) &&
    numerosEncontrados >= 2
  )
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value < 1_000_000_000_000 ? value * 1000 : value
    const date = new Date(millis)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

export function validarMensagemDigisac(rawPayload: unknown): HubVendasMensagemValidada | null {
  const payload = asRecord(rawPayload) as HubVendasWebhookPayload | null
  if (payload?.event !== 'message.created') return null

  const data = asRecord(payload.data) as HubVendasDigisacMessage | null
  if (!data) return null

  const messageId = asString(data.id)
  const contactId = asString(data.contactId)
  const serviceId = asString(data.serviceId)
  const timestampEvento = parseTimestamp(data.timestamp)

  if (!messageId || !serviceId) return null
  return {
    event: 'message.created',
    messageId,
    contactId,
    serviceId,
    ticketId: asString(data.ticketId),
    timestampEvento: timestampEvento ?? new Date(),
    texto: extrairTextoMensagemDigisac(data),
    data,
  }
}
