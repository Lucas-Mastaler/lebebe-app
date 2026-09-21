import { createHash } from 'node:crypto'
import { fetchDigisac, fetchDigisacRaw, sanitizarDigisacParaLog } from '@/lib/digisac/clienteDigisac'
import { gerarVariacoesTelefone, normalizarTelefoneDDI, type DigisacTicket } from '@/lib/digisac/sgi-sync'
import { HUB_VENDAS_COMENTARIO_RESGATE, HUB_VENDAS_DEPARTAMENTOS_RESGATE, HUB_VENDAS_SERVICE_ID_PARA_LOJA } from './constants'
import { extrairCandidatosNomeContatoDigisac, extrairNomeContatoDigisac, extrairTelefoneContatoHubVendas } from './telefone'
import type { OrigemNomeHubVendas } from './mensagem'

type DigisacContact = {
  id: string
  serviceId?: string | null
  name?: string | null
  internalName?: string | null
  data?: { number?: string | null } | null
  currentTicketId?: string | null
}

export type ContatoResgate = {
  contactId: string
  criado: boolean
  nomeContatoBruto: string | null
  origemNomeBruto: OrigemNomeHubVendas
}

export type TicketResgate = {
  ticketId: string | null
  protocolo: string | null
  transferido: boolean
}

export type ResultadoMensagemResgate =
  | { ok: true; messageId: string | null; ticketId: string | null; contactId: string | null }
  | { ok: false; status: number | null; erro: string; resultadoIncerto: boolean }

function asRows<T>(resp: unknown): T[] {
  if (Array.isArray(resp)) return resp as T[]
  const record = resp && typeof resp === 'object' ? resp as Record<string, unknown> : {}
  const rows = record.rows ?? record.data
  return Array.isArray(rows) ? rows as T[] : []
}

function extrairContato(resp: unknown): DigisacContact | null {
  const record = resp && typeof resp === 'object' ? resp as DigisacContact : null
  return record?.id ? record : null
}

function erroSeguro(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return sanitizarDigisacParaLog(message).slice(0, 500)
}

export function normalizarProtocoloDigi(valor: unknown): string | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null
  const protocolo = String(valor).trim()
  return protocolo || null
}

export function hashTextoHubVendas(texto: string): string {
  return createHash('sha256').update(texto).digest('hex')
}

export function mascararTextoParaResposta(texto: string): string {
  const normalizado = texto.replace(/\s+/g, ' ').trim()
  if (!normalizado) return ''
  return `${normalizado.slice(0, 24)}...[${normalizado.length}]`
}

export async function buscarContatoResgatePorTelefone(params: {
  telefoneNormalizadoDDI: string
  serviceId: string
}): Promise<ContatoResgate | null> {
  const variacoes = gerarVariacoesTelefone(params.telefoneNormalizadoDDI)

  for (const variacao of variacoes) {
    const query = new URLSearchParams()
    query.set('where[serviceId]', params.serviceId)
    query.set('where[visible]', 'true')
    query.set('where[data.number][$like]', `%${variacao}%`)
    query.set('page', '1')
    query.set('perPage', '10')

    const resp = await fetchDigisac(`/contacts?${query.toString()}`)
    const contatos = asRows<DigisacContact>(resp)

    for (const contato of contatos) {
      if (!contato.id) continue
      const telefone = extrairTelefoneContatoHubVendas(contato)
      if (!telefone) continue
      const variacoesContato = new Set(gerarVariacoesTelefone(normalizarTelefoneDDI(telefone.telefoneNormalizadoDDI)))
      if (variacoesContato.has(variacao) || telefone.variacoesDDI.includes(params.telefoneNormalizadoDDI)) {
        return {
          contactId: contato.id,
          criado: false,
          nomeContatoBruto: extrairNomeContatoDigisac(contato),
          origemNomeBruto: 'contato_destino_existente',
        }
      }
    }
  }

  return null
}

export async function criarContatoResgateHubVendas(params: {
  telefoneNormalizadoDDI: string
  serviceId: string
  nomeContato: string | null
}): Promise<ContatoResgate> {
  const payload = {
    internalName: params.nomeContato?.trim() || 'Lead Hub Vendas',
    alternativeName: '',
    name: params.nomeContato?.trim() || '',
    number: params.telefoneNormalizadoDDI,
    person: null,
    personId: null,
    email: '',
    origin: 'web',
    serviceId: params.serviceId,
    defaultDepartment: null,
    defaultDepartmentId: null,
    defaultUser: null,
    defaultUserId: null,
    contactLists: [],
    tagIds: [],
    tags: [],
    unsubscribed: false,
  }

  const response = await fetchDigisacRaw('/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const bodyText = await response.text().catch(() => '')

  if (!response.ok) {
    throw new Error(`contato_criacao_falhou status=${response.status} body=${sanitizarDigisacParaLog(bodyText).slice(0, 200)}`)
  }

  const contato = extrairContato(JSON.parse(bodyText || '{}'))
  if (!contato?.id) throw new Error('contato_criado_sem_id')
  const nomeContatoBruto = extrairNomeContatoDigisac(contato) ?? params.nomeContato?.trim() ?? null
  const candidatoResposta = extrairCandidatosNomeContatoDigisac(contato, 'contato_destino_criado')[0]
  return {
    contactId: contato.id,
    criado: true,
    nomeContatoBruto,
    origemNomeBruto: candidatoResposta?.origem ?? (nomeContatoBruto ? 'lead_persistido' : 'indisponivel'),
  }
}

export async function garantirContatoResgateHubVendas(params: {
  telefoneNormalizadoDDI: string
  serviceId: string
  nomeContato: string | null
}): Promise<ContatoResgate> {
  const existente = await buscarContatoResgatePorTelefone(params)
  if (existente) return existente

  try {
    return await criarContatoResgateHubVendas(params)
  } catch (error) {
    const encontradoAposConflito = await buscarContatoResgatePorTelefone(params)
    if (encontradoAposConflito) return encontradoAposConflito
    throw new Error(erroSeguro(error))
  }
}

export async function buscarTicketAbertoContato(contactId: string): Promise<DigisacTicket | null> {
  const params = new URLSearchParams()
  params.set('where[contactId]', contactId)
  params.set('where[isOpen]', 'true')
  params.set('page', '1')
  params.set('perPage', '5')
  params.set('order[0][0]', 'updatedAt')
  params.set('order[0][1]', 'DESC')

  const resp = await fetchDigisac(`/tickets?${params.toString()}`)
  const tickets = asRows<DigisacTicket>(resp)
  return tickets[0] ?? null
}

export async function buscarTicketResgatePorId(ticketId: string): Promise<TicketResgate> {
  const ticket = await fetchDigisac(`/tickets/${encodeURIComponent(ticketId)}`) as DigisacTicket
  return {
    ticketId: ticket.id || ticketId,
    protocolo: normalizarProtocoloDigi(ticket.protocol),
    transferido: false,
  }
}

type TicketBrutoDigisac = {
  id?: string
  isOpen?: boolean
  contactId?: string | null
  departmentId?: string | null
  userId?: string | null
  endedAt?: string | null
  protocol?: string | number | null
}

async function buscarTicketBrutoPorId(ticketId: string): Promise<TicketBrutoDigisac> {
  return await fetchDigisac(`/tickets/${encodeURIComponent(ticketId)}`) as TicketBrutoDigisac
}

/**
 * O `ticket/transfer` nem sempre devolve o ID do ticket criado. Como `buscarTicketAbertoContato` ja
 * garantiu, imediatamente antes, que o contato nao tinha ticket aberto, o ticket aberto agora e o do
 * envio automatico — desde que contato, departamento de resgate e ausencia de atendente confirmem.
 */
async function resolverTicketAbertoPeloRobo(params: {
  contactId: string
  departmentId: string
}): Promise<{ ticketId: string; protocolo: string | null } | null> {
  try {
    const aberto = await buscarTicketAbertoContato(params.contactId)
    if (!aberto?.id) return null
    const ticket = await buscarTicketBrutoPorId(aberto.id)
    if (
      ticket.id === aberto.id
      && ticket.isOpen === true
      && !ticket.endedAt
      && ticket.contactId === params.contactId
      && ticket.departmentId === params.departmentId
      && !ticket.userId
    ) {
      return { ticketId: aberto.id, protocolo: normalizarProtocoloDigi(ticket.protocol) }
    }
  } catch (error) {
    console.warn(`[HUB VENDAS ENVIO] ticket do envio automatico nao resolvido apos transfer contactId=${params.contactId} erro=${erroSeguro(error)}`)
  }
  return null
}

/** Mensagens do ticket. `type: 'ticket'` sao eventos de sistema (abertura/transferencia), nao mensagens de chat. */
async function buscarMensagensDoTicket(ticketId: string): Promise<{ mensagens: Array<{ type?: string }>; truncado: boolean }> {
  const query = new URLSearchParams()
  query.set('where[ticketId]', ticketId)
  query.set('page', '1')
  query.set('perPage', '50')
  const resp = await fetchDigisac(`/messages?${query.toString()}`)
  const mensagens = asRows<{ type?: string }>(resp)
  const totalInformado = resp && typeof resp === 'object' ? (resp as Record<string, unknown>).total : undefined
  return { mensagens, truncado: typeof totalInformado === 'number' && totalInformado > mensagens.length }
}

/**
 * Evidencia objetiva de contato nao entregavel: o proprio DigiSac marcou o contato com `data.valid === false`
 * (numero sem WhatsApp/formato invalido). SO `false` explicito conta; ausente, `true` ou falha na consulta
 * devolvem `false` (nao ha prova). Nao depende do texto do erro do envio.
 */
export async function contatoDigisacMarcadoInvalido(contactId: string): Promise<boolean> {
  try {
    const contato = await fetchDigisac(`/contacts/${encodeURIComponent(contactId)}`) as { data?: { valid?: unknown } | null }
    return contato?.data?.valid === false
  } catch {
    return false
  }
}

export type ConsultaEntregaAposFalhaHttp = 'ausente' | 'presente' | 'desconhecida'

/**
 * Apos um HTTP 500 no `POST /messages`, verifica no DigiSac se ALGUMA mensagem de chat existe no ticket
 * aberto pelo proprio envio automatico.
 *  - `ausente`: ticket so tem eventos de sistema => nada foi gravado/entregue (falha confirmada, retry seguro);
 *  - `presente`: ja existe mensagem de chat (nossa, mesmo com erro no POST, ou do cliente) => nao repetir;
 *  - `desconhecida`: sem ticket para consultar, lista truncada ou consulta falhou => tratar como incerto.
 */
export async function consultarEntregaAposFalhaHttp(params: { ticketId: string | null }): Promise<ConsultaEntregaAposFalhaHttp> {
  if (!params.ticketId) return 'desconhecida'
  try {
    const { mensagens, truncado } = await buscarMensagensDoTicket(params.ticketId)
    if (mensagens.some((mensagem) => mensagem.type !== 'ticket')) return 'presente'
    return truncado ? 'desconhecida' : 'ausente'
  } catch {
    return 'desconhecida'
  }
}

/**
 * Status HTTP em que o DigiSac pode ter aceito/processado a mensagem apesar do erro devolvido:
 * 5xx (falha do servidor ou de proxy/gateway) e 408. 4xx (exceto 408) significa requisicao rejeitada
 * antes de qualquer processamento (auth, validacao, rate limit).
 */
export function statusHttpPodeTerProcessadoMensagem(status: number): boolean {
  return status >= 500 || status === 408
}

export type VerificacaoTicketRoboRetry =
  | { reutilizavel: true; ticket: TicketResgate }
  | { reutilizavel: false; motivo: string }

/**
 * Decide se, num retry, o ticket aberto pela tentativa anterior do PROPRIO envio automatico pode ser
 * reaproveitado em vez de ser tratado como "cliente em atendimento".
 *
 * So e reutilizavel quando TODAS as provas objetivas abaixo batem; qualquer duvida ou falha de consulta
 * devolve `reutilizavel: false` (comportamento conservador anterior: o ticket continua bloqueando).
 *  - o ID e o que a propria fila gravou (nunca "qualquer ticket aberto");
 *  - ticket aberto, do mesmo contato, no departamento de resgate da loja e sem atendente;
 *  - nenhuma mensagem de chat: so eventos de sistema (`type: 'ticket'`). Se o cliente escreveu, se houve
 *    mensagem nossa (mesmo com erro no POST) ou qualquer interacao, NAO reutiliza — evita duplicidade.
 */
export async function verificarTicketRoboReutilizavel(params: {
  ticketId: string
  contactId: string
  serviceId: string
}): Promise<VerificacaoTicketRoboRetry> {
  const naoReutilizavel = (motivo: string): VerificacaoTicketRoboRetry => ({ reutilizavel: false, motivo })
  try {
    const loja = HUB_VENDAS_SERVICE_ID_PARA_LOJA.get(params.serviceId)
    if (!loja) return naoReutilizavel('conexao_destino_invalida')

    const ticket = await buscarTicketBrutoPorId(params.ticketId)
    if (ticket.id !== params.ticketId) return naoReutilizavel('ticket_nao_encontrado')
    if (ticket.isOpen !== true || ticket.endedAt) return naoReutilizavel('ticket_fechado')
    if (ticket.contactId !== params.contactId) return naoReutilizavel('contato_diferente')
    if (ticket.departmentId !== HUB_VENDAS_DEPARTAMENTOS_RESGATE[loja]) return naoReutilizavel('departamento_diferente')
    if (ticket.userId) return naoReutilizavel('ticket_com_atendente')

    const { mensagens, truncado } = await buscarMensagensDoTicket(params.ticketId)
    if (truncado) return naoReutilizavel('mensagens_truncadas')
    if (mensagens.some((mensagem) => mensagem.type !== 'ticket')) return naoReutilizavel('ticket_com_mensagens')

    return {
      reutilizavel: true,
      ticket: { ticketId: ticket.id, protocolo: normalizarProtocoloDigi(ticket.protocol), transferido: false },
    }
  } catch (error) {
    return naoReutilizavel(`consulta_falhou:${erroSeguro(error)}`)
  }
}

export async function abrirTicketResgateHubVendas(params: {
  contactId: string
  serviceId: string
}): Promise<TicketResgate> {
  const loja = HUB_VENDAS_SERVICE_ID_PARA_LOJA.get(params.serviceId)
  if (!loja) throw new Error('conexao_destino_invalida')

  const departmentId = HUB_VENDAS_DEPARTAMENTOS_RESGATE[loja]
  const byUserId = process.env.DIGISAC_BOT_USER_ID
  if (!byUserId) throw new Error('digisac_bot_user_id_nao_configurado')

  const response = await fetchDigisacRaw(`/contacts/${params.contactId}/ticket/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      departmentId,
      userId: null,
      comments: HUB_VENDAS_COMENTARIO_RESGATE,
      byUserId,
    }),
  })
  const bodyText = await response.text().catch(() => '')

  if (!response.ok) {
    throw new Error(`ticket_transfer_falhou status=${response.status} body=${sanitizarDigisacParaLog(bodyText).slice(0, 200)}`)
  }

  let ticketId: string | null = null
  let protocolo: string | null = null
  try {
    const json = JSON.parse(bodyText || '{}') as Record<string, unknown>
    const ticket = json.ticket && typeof json.ticket === 'object' ? json.ticket as Record<string, unknown> : null
    ticketId = (json.ticketId as string | undefined) ?? (ticket?.id as string | undefined) ?? null
    protocolo = normalizarProtocoloDigi(json.protocol ?? ticket?.protocol)
  } catch {
    ticketId = null
  }

  if (!ticketId) {
    const resolvido = await resolverTicketAbertoPeloRobo({ contactId: params.contactId, departmentId })
    if (resolvido) {
      ticketId = resolvido.ticketId
      protocolo = protocolo ?? resolvido.protocolo
    }
  }

  if (ticketId && !protocolo) {
    try {
      const ticket = await buscarTicketResgatePorId(ticketId)
      protocolo = ticket.protocolo
    } catch (error) {
      console.warn(`[HUB VENDAS ENVIO] protocolo nao obtido apos abertura ticketId=${ticketId} erro=${erroSeguro(error)}`)
    }
  }

  return { ticketId, protocolo, transferido: true }
}

export async function enviarMensagemResgateHubVendas(params: {
  contactId: string
  texto: string
}): Promise<ResultadoMensagemResgate> {
  const botUserId = process.env.DIGISAC_BOT_USER_ID
  if (!botUserId) {
    return {
      ok: false,
      status: null,
      erro: 'digisac_bot_user_id_nao_configurado',
      resultadoIncerto: false,
    }
  }

  try {
    const response = await fetchDigisacRaw('/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: params.texto,
        type: 'chat',
        contactId: params.contactId,
        userId: botUserId,
        origin: 'bot',
        fromMe: true,
        editMessage: null,
        isComment: false,
        subject: 'Sem Assunto',
      }),
    })
    const bodyText = await response.text().catch(() => '')

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        erro: `mensagem_api_erro status=${response.status} body=${sanitizarDigisacParaLog(bodyText).slice(0, 200)}`,
        resultadoIncerto: statusHttpPodeTerProcessadoMensagem(response.status),
      }
    }

    let json: Record<string, unknown>
    try {
      json = JSON.parse(bodyText || '{}') as Record<string, unknown>
    } catch {
      return {
        ok: false,
        status: response.status,
        erro: `mensagem_resposta_invalida_apos_post body=${sanitizarDigisacParaLog(bodyText).slice(0, 200)}`,
        resultadoIncerto: true,
      }
    }
    const ticket = json.ticket && typeof json.ticket === 'object' ? json.ticket as Record<string, unknown> : null
    return {
      ok: true,
      messageId: (json.id as string | undefined) ?? null,
      ticketId: (json.ticketId as string | undefined) ?? (ticket?.id as string | undefined) ?? null,
      contactId: (json.contactId as string | undefined) ?? params.contactId,
    }
  } catch (error) {
    const message = erroSeguro(error)
    return {
      ok: false,
      status: null,
      erro: message,
      resultadoIncerto: /timeout|aborted|network|fetch|econnreset|terminated/i.test(message),
    }
  }
}
