import {
  buscarMensagensContatoPaginado,
  MENSAGENS_CONTATO_MAX_MESSAGES,
  MENSAGENS_CONTATO_MAX_PAGES,
  MENSAGENS_CONTATO_PER_PAGE,
  type BuscarMensagensContatoResultado,
} from '@/lib/digisac/mensagens-contato'
import type { DigisacMensagem } from '@/lib/digisac/sgi-sync'

export const JANELA_FALLBACK_DIAS_CONTATO = 30
export const CONTEXTO_CONTATO_MAX_MENSAGENS_PROMPT = 50
export const CONTEXTO_CONTATO_MAX_CHARS = 9000

export type GrupoMensagemComplementar = 'ticket_atual' | 'outro_ticket' | 'sem_ticket'

export type MensagemComplementarIA = {
  id: string | null
  ticketId: string | null
  contactId: string | null
  timestampMs: number
  autor: 'Atendente' | 'Cliente'
  tipo: string | null
  conteudo: string
  grupo: GrupoMensagemComplementar
  scoreComercial: number
}

export type ContextoComplementarContatoIA = {
  disponivel: boolean
  motivoIndisponivel: string | null
  contactIdsConsultados: string[]
  janelaInicio: string | null
  janelaFim: string | null
  janelaOrigem: 'venda_anterior' | 'fallback_30_dias' | null
  totalApi: number
  totalNaJanela: number
  mensagensTicketAtual: number
  mensagensOutrosTickets: number
  mensagensSemTicket: number
  mensagensDescartadas: number
  deduplicadas: number
  enviadasPrompt: number
  truncado: boolean
  mensagensSemTicketPrompt: MensagemComplementarIA[]
  mensagensOutrosTicketsPrompt: MensagemComplementarIA[]
}

export type BuscarContextoComplementarContatoOptions = {
  contactIds: Array<string | null | undefined>
  ticketIdsPrincipais: string[]
  dataFechamentoVenda: string | null | undefined
  dataFechamentoVendaAnterior?: string | null | undefined
  perPage?: number
  maxPages?: number
  maxMessages?: number
  maxMensagensPrompt?: number
  maxCharsPrompt?: number
  fetcher?: (
    contactId: string,
    options: {
      perPage: number
      maxPages: number
      maxMessages: number
      inicioISO: string
      fimISO: string
    }
  ) => Promise<BuscarMensagensContatoResultado>
}

type JanelaContato = {
  inicioISO: string
  fimISO: string
  origem: 'venda_anterior' | 'fallback_30_dias'
}

function parseMs(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null
  const ms = typeof raw === 'number' ? raw * 1000 : Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

function formatarDataHora(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function calcularJanelaComercialContato(
  dataFechamentoVenda: string | null | undefined,
  dataFechamentoVendaAnterior?: string | null | undefined
): JanelaContato | null {
  const fimMs = parseMs(dataFechamentoVenda)
  if (fimMs == null) return null

  const anteriorMs = parseMs(dataFechamentoVendaAnterior)
  const inicioMs = anteriorMs != null && anteriorMs < fimMs
    ? anteriorMs
    : fimMs - JANELA_FALLBACK_DIAS_CONTATO * 24 * 60 * 60 * 1000

  return {
    inicioISO: new Date(inicioMs).toISOString(),
    fimISO: new Date(fimMs).toISOString(),
    origem: anteriorMs != null && anteriorMs < fimMs ? 'venda_anterior' : 'fallback_30_dias',
  }
}

function normalizarTexto(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function mascararUrls(raw: string): string {
  return raw.replace(/https?:\/\/\S+/gi, '[link]')
}

function extrairTextoQuoted(quotedMessage: unknown): string | null {
  if (!quotedMessage || typeof quotedMessage !== 'object') return null
  const text = (quotedMessage as { text?: unknown }).text
  return typeof text === 'string' && text.trim() ? normalizarTexto(text).slice(0, 180) : null
}

export function extrairConteudoMensagemComplementar(msg: DigisacMensagem): string | null {
  const texto = typeof msg.text === 'string' ? normalizarTexto(mascararUrls(msg.text)) : ''
  const citacao = extrairTextoQuoted(msg.quotedMessage)
  const partes: string[] = []

  if (texto) partes.push(texto)
  if (citacao) partes.push(`citacao: ${mascararUrls(citacao)}`)

  if (partes.length > 0) return partes.join(' | ').slice(0, 900)

  if (msg.file || msg.preview || msg.thumbnail) {
    const tipo = msg.type ?? 'midia'
    if (tipo.includes('audio') || tipo === 'ptt') return '[audio enviado sem transcricao]'
    if (tipo.includes('image')) return '[imagem enviada sem legenda]'
    if (tipo.includes('video')) return '[video enviado sem legenda]'
    return '[arquivo enviado sem texto]'
  }

  return null
}

function deveDescartarMensagem(msg: DigisacMensagem): boolean {
  if (msg.visible !== true) return true
  if (!msg.id && !msg.timestamp) return true
  if (msg.isComment === true) return true
  if (msg.type === 'reaction' || msg.type === 'ticket') return true
  if (msg.data?.ticketTransfer === true) return true
  if (msg.deletedAt) return true
  if (!extrairConteudoMensagemComplementar(msg)) return true
  return false
}

function chaveDedup(msg: DigisacMensagem, conteudo: string): string {
  if (msg.id) return `id:${msg.id}`
  return [
    'fallback',
    msg.timestamp ?? '',
    msg.isFromMe ? 'from_me' : 'from_client',
    msg.type ?? '',
    normalizarTexto(conteudo).toLowerCase(),
  ].join('|')
}

function scoreComercial(conteudo: string): number {
  const texto = conteudo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const termos = [
    'preco', 'valor', 'orcamento', 'desconto', 'pagamento', 'pix', 'cartao', 'parcel',
    'link', 'boleto', 'compr', 'fechar', 'pagar', 'loja', 'visita', 'separad', 'pronto',
    'entrega', 'retirada', 'frete', 'prazo', 'berco', 'comoda', 'roupeiro', 'cama',
    'poltrona', 'colchao', 'romanzo', 'infanti', 'moises',
  ]
  return termos.reduce((total, termo) => total + (texto.includes(termo) ? 1 : 0), 0)
}

function mensagemParaIA(
  msg: DigisacMensagem,
  conteudo: string,
  grupo: GrupoMensagemComplementar
): MensagemComplementarIA | null {
  const ms = parseMs(msg.timestamp)
  if (ms == null) return null
  return {
    id: msg.id ?? null,
    ticketId: msg.ticketId ?? null,
    contactId: msg.contactId ?? null,
    timestampMs: ms,
    autor: msg.isFromMe ? 'Atendente' : 'Cliente',
    tipo: msg.type ?? null,
    conteudo,
    grupo,
    scoreComercial: scoreComercial(conteudo),
  }
}

function selecionarMensagensPrompt(
  semTicket: MensagemComplementarIA[],
  outrosTickets: MensagemComplementarIA[],
  maxMensagens: number,
  maxChars: number
): { semTicket: MensagemComplementarIA[]; outrosTickets: MensagemComplementarIA[]; truncado: boolean } {
  const ordenacaoPrioridade = (a: MensagemComplementarIA, b: MensagemComplementarIA) =>
    b.scoreComercial - a.scoreComercial || b.timestampMs - a.timestampMs
  const candidatas = [
    ...semTicket.map((m) => ({ ...m, prioridadeGrupo: 1 })),
    ...outrosTickets.map((m) => ({ ...m, prioridadeGrupo: 0 })),
  ].sort((a, b) => b.prioridadeGrupo - a.prioridadeGrupo || ordenacaoPrioridade(a, b))

  const escolhidas: MensagemComplementarIA[] = []
  let totalChars = 0
  let truncado = false

  for (const msg of candidatas) {
    const custo = msg.conteudo.length + 80
    if (escolhidas.length >= maxMensagens || totalChars + custo > maxChars) {
      truncado = true
      continue
    }
    escolhidas.push(msg)
    totalChars += custo
  }

  escolhidas.sort((a, b) => a.timestampMs - b.timestampMs)
  return {
    semTicket: escolhidas.filter((m) => m.grupo === 'sem_ticket'),
    outrosTickets: escolhidas.filter((m) => m.grupo === 'outro_ticket'),
    truncado,
  }
}

function contextoVazio(
  motivo: string,
  contactIds: string[] = [],
  janela: JanelaContato | null = null
): ContextoComplementarContatoIA {
  return {
    disponivel: false,
    motivoIndisponivel: motivo,
    contactIdsConsultados: contactIds,
    janelaInicio: janela?.inicioISO ?? null,
    janelaFim: janela?.fimISO ?? null,
    janelaOrigem: janela?.origem ?? null,
    totalApi: 0,
    totalNaJanela: 0,
    mensagensTicketAtual: 0,
    mensagensOutrosTickets: 0,
    mensagensSemTicket: 0,
    mensagensDescartadas: 0,
    deduplicadas: 0,
    enviadasPrompt: 0,
    truncado: false,
    mensagensSemTicketPrompt: [],
    mensagensOutrosTicketsPrompt: [],
  }
}

export async function buscarContextoComplementarContatoIA(
  options: BuscarContextoComplementarContatoOptions
): Promise<ContextoComplementarContatoIA> {
  const contactIds = Array.from(new Set(options.contactIds.map((id) => String(id ?? '').trim()).filter(Boolean)))
  const ticketIdsPrincipais = new Set(options.ticketIdsPrincipais.map((id) => id.trim()).filter(Boolean))
  const janela = calcularJanelaComercialContato(options.dataFechamentoVenda ?? null, options.dataFechamentoVendaAnterior ?? null)

  if (contactIds.length === 0) return contextoVazio('sem_contact_id')
  if (!janela) return contextoVazio('sem_data_fechamento_venda', contactIds)

  const fetcher = options.fetcher ?? buscarMensagensContatoPaginado
  const perPage = options.perPage ?? MENSAGENS_CONTATO_PER_PAGE
  const maxPages = options.maxPages ?? MENSAGENS_CONTATO_MAX_PAGES
  const maxMessages = options.maxMessages ?? MENSAGENS_CONTATO_MAX_MESSAGES
  const maxMensagensPrompt = options.maxMensagensPrompt ?? CONTEXTO_CONTATO_MAX_MENSAGENS_PROMPT
  const maxCharsPrompt = options.maxCharsPrompt ?? CONTEXTO_CONTATO_MAX_CHARS

  let totalApi = 0
  let totalNaJanela = 0
  let truncadoColeta = false
  const semTicket: MensagemComplementarIA[] = []
  const outrosTickets: MensagemComplementarIA[] = []
  let mensagensTicketAtual = 0
  let mensagensDescartadas = 0
  let deduplicadas = 0
  const dedup = new Set<string>()

  try {
    for (const contactId of contactIds) {
      const resultado = await fetcher(contactId, {
        perPage,
        maxPages,
        maxMessages,
        inicioISO: janela.inicioISO,
        fimISO: janela.fimISO,
      })
      totalApi += resultado.totalApi
      totalNaJanela += resultado.totalColetado
      truncadoColeta = truncadoColeta || resultado.truncado

      for (const msg of resultado.mensagens) {
        const conteudo = extrairConteudoMensagemComplementar(msg)
        if (!conteudo || deveDescartarMensagem(msg)) {
          mensagensDescartadas++
          continue
        }
        const chave = chaveDedup(msg, conteudo)
        if (dedup.has(chave)) {
          deduplicadas++
          continue
        }
        dedup.add(chave)

        const ticketId = msg.ticketId ?? null
        const grupo: GrupoMensagemComplementar = !ticketId
          ? 'sem_ticket'
          : ticketIdsPrincipais.has(ticketId)
          ? 'ticket_atual'
          : 'outro_ticket'

        const ia = mensagemParaIA(msg, conteudo, grupo)
        if (!ia) {
          mensagensDescartadas++
          continue
        }

        if (grupo === 'ticket_atual') {
          mensagensTicketAtual++
        } else if (grupo === 'sem_ticket') {
          semTicket.push(ia)
        } else {
          outrosTickets.push(ia)
        }
      }
    }
  } catch {
    return contextoVazio('erro_api_digisac', contactIds, janela)
  }

  const selecionadas = selecionarMensagensPrompt(semTicket, outrosTickets, maxMensagensPrompt, maxCharsPrompt)
  const enviadasPrompt = selecionadas.semTicket.length + selecionadas.outrosTickets.length

  return {
    disponivel: true,
    motivoIndisponivel: null,
    contactIdsConsultados: contactIds,
    janelaInicio: janela.inicioISO,
    janelaFim: janela.fimISO,
    janelaOrigem: janela.origem,
    totalApi,
    totalNaJanela,
    mensagensTicketAtual,
    mensagensOutrosTickets: outrosTickets.length,
    mensagensSemTicket: semTicket.length,
    mensagensDescartadas,
    deduplicadas,
    enviadasPrompt,
    truncado: truncadoColeta || selecionadas.truncado,
    mensagensSemTicketPrompt: selecionadas.semTicket,
    mensagensOutrosTicketsPrompt: selecionadas.outrosTickets,
  }
}

function formatarLinhaMensagem(msg: MensagemComplementarIA, origem: string): string {
  return `[${formatarDataHora(msg.timestampMs)}] ${msg.autor} (${origem}): ${msg.conteudo}`
}

export function montarContextoComplementarContato(contexto: ContextoComplementarContatoIA): string {
  if (!contexto.disponivel) {
    return `## CONTEXTO COMPLEMENTAR DO CONTATO - MENSAGENS FORA DO TICKET PRINCIPAL

Nao disponivel: ${contexto.motivoIndisponivel ?? 'motivo nao informado'}.
Nao use ausencia deste bloco como evidencia contra influencia comercial.`
  }

  const linhasSemTicket = contexto.mensagensSemTicketPrompt.length > 0
    ? contexto.mensagensSemTicketPrompt.map((m) => formatarLinhaMensagem(m, 'sem ticket')).join('\n')
    : '(nenhuma mensagem sem ticket util no periodo)'

  const linhasOutrosTickets = contexto.mensagensOutrosTicketsPrompt.length > 0
    ? contexto.mensagensOutrosTicketsPrompt.map((m) => formatarLinhaMensagem(m, 'outro ticket no periodo')).join('\n')
    : '(nenhuma mensagem util de outros tickets no periodo)'

  return `## CONTEXTO COMPLEMENTAR DO CONTATO - MENSAGENS FORA DO TICKET PRINCIPAL

Este bloco contem mensagens do mesmo contactId Digisac dentro da janela comercial da venda, mas fora do transcript principal do ticket analisado.
Use como contexto complementar do contato. Mensagens sem ticket podem demonstrar continuidade, produto, preco, pagamento, visita ou influencia comercial mesmo sem protocolo.
Nao invente protocolo, numero de chamado ou numero discado para mensagens sem ticket. Se usar uma evidencia deste bloco, cite como "contexto complementar do contato".
Janela: ${contexto.janelaInicio ?? 'nao informada'} ate ${contexto.janelaFim ?? 'nao informada'} (${contexto.janelaOrigem ?? 'origem desconhecida'}).
Contatos consultados: ${contexto.contactIdsConsultados.length}. Total API: ${contexto.totalApi}. Na janela: ${contexto.totalNaJanela}. Ticket principal removido: ${contexto.mensagensTicketAtual}. Outros tickets: ${contexto.mensagensOutrosTickets}. Sem ticket: ${contexto.mensagensSemTicket}. Descartadas: ${contexto.mensagensDescartadas}. Deduplicadas: ${contexto.deduplicadas}. Enviadas ao prompt: ${contexto.enviadasPrompt}. Truncado: ${contexto.truncado ? 'sim' : 'nao'}.

### MENSAGENS SEM TICKET
${linhasSemTicket}

### MENSAGENS DE OUTROS TICKETS NO PERIODO
${linhasOutrosTickets}`
}

export function montarResumoLogContextoContato(contexto: ContextoComplementarContatoIA): string {
  return `contatos=${contexto.contactIdsConsultados.length} totalApi=${contexto.totalApi} naJanela=${contexto.totalNaJanela} ticketAtual=${contexto.mensagensTicketAtual} outrosTickets=${contexto.mensagensOutrosTickets} semTicket=${contexto.mensagensSemTicket} descartadas=${contexto.mensagensDescartadas} deduplicadas=${contexto.deduplicadas} enviadasPrompt=${contexto.enviadasPrompt} truncado=${contexto.truncado ? 'true' : 'false'}`
}
