import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/digisac/clienteDigisac', () => ({
  fetchDigisac: vi.fn(),
  fetchDigisacRaw: vi.fn(),
  sanitizarDigisacParaLog: (s: string) => s.replace(/Bearer\s+\S+/g, 'Bearer [redacted]'),
}))

vi.mock('@/lib/digisac/sgi-sync', () => ({
  gerarVariacoesTelefone: vi.fn(() => ['5541999999999']),
  normalizarTelefoneDDI: vi.fn((t: string) => t),
}))

vi.mock('./telefone', () => ({
  extrairCandidatosNomeContatoDigisac: vi.fn(() => []),
  extrairNomeContatoDigisac: vi.fn(() => null),
  extrairTelefoneContatoHubVendas: vi.fn(() => null),
}))

const { fetchDigisac, fetchDigisacRaw } = await import('@/lib/digisac/clienteDigisac')
const {
  abrirTicketResgateHubVendas,
  verificarTicketRoboReutilizavel,
  consultarEntregaAposFalhaHttp,
  enviarMensagemResgateHubVendas,
  statusHttpPodeTerProcessadoMensagem,
} = await import('./envio')

const HAUER_SERVICE = '1352c41b-80a9-4e74-b9d9-4c5e7aed060e'
const HAUER_DEPARTAMENTO = '8c90dba0-a855-49ae-bed4-f133f8509df9'
const PORTAO_DEPARTAMENTO = '7b524eab-a7c4-48d2-b249-3a5027e43728'
const CONTATO = '29b0982f-5026-427e-a4f1-4204b4a7dad7'
const TICKET = 'a05c29bf-f054-477d-bca3-c894284d86d3'

type TicketBruto = Record<string, unknown>

function ticketDoRobo(overrides: TicketBruto = {}): TicketBruto {
  return {
    id: TICKET,
    isOpen: true,
    endedAt: null,
    contactId: CONTATO,
    departmentId: HAUER_DEPARTAMENTO,
    userId: null,
    protocol: '2026091976548',
    ...overrides,
  }
}

const EVENTO_DE_SISTEMA = { type: 'ticket', isFromMe: false, origin: 'ticket' }

function simularDigisac(params: {
  ticket?: TicketBruto | Error
  mensagens?: unknown[] | Error
  totalMensagens?: number
  ticketsAbertosDoContato?: unknown[]
}) {
  vi.mocked(fetchDigisac).mockImplementation(async (endpoint: string) => {
    if (endpoint.startsWith('/messages')) {
      if (params.mensagens instanceof Error) throw params.mensagens
      const rows = params.mensagens ?? [EVENTO_DE_SISTEMA]
      return { data: rows, total: params.totalMensagens ?? rows.length }
    }
    if (endpoint.startsWith('/tickets?')) return { data: params.ticketsAbertosDoContato ?? [] }
    if (endpoint.startsWith('/tickets/')) {
      if (params.ticket instanceof Error) throw params.ticket
      return params.ticket ?? ticketDoRobo()
    }
    throw new Error(`endpoint_inesperado ${endpoint}`)
  })
}

describe('verificarTicketRoboReutilizavel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const params = { ticketId: TICKET, contactId: CONTATO, serviceId: HAUER_SERVICE }

  it('ticket criado pelo proprio robo, aberto, sem atendente e so com evento de sistema: reutilizavel (caso Hauer 19/09)', async () => {
    simularDigisac({})

    const resultado = await verificarTicketRoboReutilizavel(params)

    expect(resultado).toEqual({
      reutilizavel: true,
      ticket: { ticketId: TICKET, protocolo: '2026091976548', transferido: false },
    })
  })

  it('cliente escreveu no ticket (mensagem de chat/audio do cliente): NAO reutiliza', async () => {
    simularDigisac({ mensagens: [EVENTO_DE_SISTEMA, { type: 'ptt', isFromMe: false, origin: null }] })
    expect(await verificarTicketRoboReutilizavel(params)).toEqual({ reutilizavel: false, motivo: 'ticket_com_mensagens' })

    simularDigisac({ mensagens: [EVENTO_DE_SISTEMA, { type: 'chat', isFromMe: false, origin: 'user' }] })
    expect(await verificarTicketRoboReutilizavel(params)).toEqual({ reutilizavel: false, motivo: 'ticket_com_mensagens' })
  })

  it('mensagem do proprio robo ja presente (POST deu erro mas a mensagem foi gravada): NAO reutiliza, evita duplicidade', async () => {
    simularDigisac({ mensagens: [EVENTO_DE_SISTEMA, { type: 'chat', isFromMe: true, origin: 'bot' }] })

    expect(await verificarTicketRoboReutilizavel(params)).toEqual({ reutilizavel: false, motivo: 'ticket_com_mensagens' })
  })

  it('atendente assumiu o ticket: NAO reutiliza e nem consulta as mensagens', async () => {
    simularDigisac({ ticket: ticketDoRobo({ userId: 'atendente-1' }) })

    expect(await verificarTicketRoboReutilizavel(params)).toEqual({ reutilizavel: false, motivo: 'ticket_com_atendente' })
    expect(fetchDigisac).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['ticket fechado', ticketDoRobo({ isOpen: false }), 'ticket_fechado'],
    ['ticket com data de encerramento', ticketDoRobo({ endedAt: '2026-09-19T15:00:00.000Z' }), 'ticket_fechado'],
    ['ticket de outro contato', ticketDoRobo({ contactId: 'outro-contato' }), 'contato_diferente'],
    ['ticket em outro departamento (ex.: triagem/loja, nao o de resgate)', ticketDoRobo({ departmentId: PORTAO_DEPARTAMENTO }), 'departamento_diferente'],
    ['ID retornado diferente do gravado', ticketDoRobo({ id: 'outro-ticket' }), 'ticket_nao_encontrado'],
  ])('%s: NAO reutiliza', async (_nome, ticket, motivo) => {
    simularDigisac({ ticket })

    expect(await verificarTicketRoboReutilizavel(params)).toEqual({ reutilizavel: false, motivo })
  })

  it('conexao de destino desconhecida: NAO reutiliza sem consultar o DigiSac', async () => {
    const resultado = await verificarTicketRoboReutilizavel({ ...params, serviceId: 'servico-desconhecido' })

    expect(resultado).toEqual({ reutilizavel: false, motivo: 'conexao_destino_invalida' })
    expect(fetchDigisac).not.toHaveBeenCalled()
  })

  it('lista de mensagens truncada (total maior que o retornado): NAO reutiliza', async () => {
    simularDigisac({ mensagens: [EVENTO_DE_SISTEMA], totalMensagens: 80 })

    expect(await verificarTicketRoboReutilizavel(params)).toEqual({ reutilizavel: false, motivo: 'mensagens_truncadas' })
  })

  it('falha ao consultar o DigiSac: NAO reutiliza (conservador) e nao propaga excecao', async () => {
    simularDigisac({ ticket: new Error('Digisac Request Timeout (30s)') })
    const resultado = await verificarTicketRoboReutilizavel(params)
    expect(resultado.reutilizavel).toBe(false)
    expect(resultado).toMatchObject({ motivo: expect.stringContaining('consulta_falhou') })

    simularDigisac({ mensagens: new Error('network') })
    expect((await verificarTicketRoboReutilizavel(params)).reutilizavel).toBe(false)
  })
})

describe('abrirTicketResgateHubVendas — resolucao do ID do ticket criado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DIGISAC_BOT_USER_ID = 'bot-user-tech-id'
  })

  function transferRespondeCom(body: unknown) {
    vi.mocked(fetchDigisacRaw).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response)
  }

  const entrada = { contactId: CONTATO, serviceId: HAUER_SERVICE }

  it('transfer SEM ticketId na resposta (caso Hauer): resolve o ticket aberto do contato e devolve ID e protocolo', async () => {
    transferRespondeCom({})
    simularDigisac({ ticketsAbertosDoContato: [{ id: TICKET }], ticket: ticketDoRobo() })

    const ticket = await abrirTicketResgateHubVendas(entrada)

    expect(ticket).toEqual({ ticketId: TICKET, protocolo: '2026091976548', transferido: true })
  })

  it('transfer com ticketId na resposta: nao faz consulta extra para descobrir o ticket', async () => {
    transferRespondeCom({ ticketId: 'ticket-da-resposta' })
    simularDigisac({ ticket: { id: 'ticket-da-resposta', protocol: '111' } })

    const ticket = await abrirTicketResgateHubVendas(entrada)

    expect(ticket.ticketId).toBe('ticket-da-resposta')
    const consultas = vi.mocked(fetchDigisac).mock.calls.map(([endpoint]) => String(endpoint))
    expect(consultas.some((endpoint) => endpoint.startsWith('/tickets?'))).toBe(false)
  })

  it.each([
    ['ticket de outro departamento', ticketDoRobo({ departmentId: PORTAO_DEPARTAMENTO })],
    ['ticket ja com atendente (nao e do robo)', ticketDoRobo({ userId: 'atendente-1' })],
    ['ticket de outro contato', ticketDoRobo({ contactId: 'outro-contato' })],
    ['ticket ja fechado', ticketDoRobo({ isOpen: false })],
  ])('resolucao recusa: %s (nao grava ID que nao e comprovadamente do robo)', async (_nome, ticket) => {
    transferRespondeCom({})
    simularDigisac({ ticketsAbertosDoContato: [{ id: TICKET }], ticket })

    const resultado = await abrirTicketResgateHubVendas(entrada)

    expect(resultado).toEqual({ ticketId: null, protocolo: null, transferido: true })
  })

  it('falha na consulta de resolucao nao derruba o transfer ja realizado', async () => {
    transferRespondeCom({})
    vi.mocked(fetchDigisac).mockRejectedValue(new Error('network'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const resultado = await abrirTicketResgateHubVendas(entrada)

    expect(resultado).toEqual({ ticketId: null, protocolo: null, transferido: true })
  })
})

describe('consultarEntregaAposFalhaHttp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ticket so com eventos de sistema: ausente (falha confirmada)', async () => {
    simularDigisac({ mensagens: [EVENTO_DE_SISTEMA] })
    expect(await consultarEntregaAposFalhaHttp({ ticketId: TICKET })).toBe('ausente')
  })

  it('mensagem de chat do robo presente apesar do erro HTTP: presente (nao repetir)', async () => {
    simularDigisac({ mensagens: [EVENTO_DE_SISTEMA, { type: 'chat', isFromMe: true, origin: 'bot' }] })
    expect(await consultarEntregaAposFalhaHttp({ ticketId: TICKET })).toBe('presente')
  })

  it('mensagem do cliente presente: presente', async () => {
    simularDigisac({ mensagens: [EVENTO_DE_SISTEMA, { type: 'ptt', isFromMe: false }] })
    expect(await consultarEntregaAposFalhaHttp({ ticketId: TICKET })).toBe('presente')
  })

  it('sem ticket conhecido: desconhecida, sem consultar', async () => {
    expect(await consultarEntregaAposFalhaHttp({ ticketId: null })).toBe('desconhecida')
    expect(fetchDigisac).not.toHaveBeenCalled()
  })

  it('lista truncada sem mensagem de chat visivel: desconhecida (nao afirma ausencia)', async () => {
    simularDigisac({ mensagens: [EVENTO_DE_SISTEMA], totalMensagens: 80 })
    expect(await consultarEntregaAposFalhaHttp({ ticketId: TICKET })).toBe('desconhecida')
  })

  it('falha na consulta: desconhecida e nao propaga excecao', async () => {
    simularDigisac({ mensagens: new Error('Digisac Request Timeout (30s)') })
    expect(await consultarEntregaAposFalhaHttp({ ticketId: TICKET })).toBe('desconhecida')
  })
})

describe('enviarMensagemResgateHubVendas — classificacao do resultado HTTP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DIGISAC_BOT_USER_ID = 'bot-user-tech-id'
  })

  function postResponde(status: number, body = '{}') {
    vi.mocked(fetchDigisacRaw).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(body),
    } as Response)
  }

  it.each([500, 502, 503, 504, 408])('HTTP %i: resultado incerto (pode ter sido processado)', async (status) => {
    postResponde(status, '{"error":"HttpError"}')

    const resultado = await enviarMensagemResgateHubVendas({ contactId: CONTATO, texto: 'oi' })

    expect(resultado).toMatchObject({ ok: false, status, resultadoIncerto: true })
  })

  it.each([400, 401, 403, 404, 422, 429])('HTTP %i: falha confirmada (requisicao rejeitada)', async (status) => {
    postResponde(status, '{"error":"x"}')

    const resultado = await enviarMensagemResgateHubVendas({ contactId: CONTATO, texto: 'oi' })

    expect(resultado).toMatchObject({ ok: false, status, resultadoIncerto: false })
  })

  it('HTTP 500 do caso Hauer preserva o texto do erro para diagnostico', async () => {
    postResponde(500, '{"error":"HttpError","message":"[sendMessageToId] Message came out falsy for contact: 55***40@c.us","status":500}')

    const resultado = await enviarMensagemResgateHubVendas({ contactId: CONTATO, texto: 'oi' })

    expect(resultado).toMatchObject({ ok: false, status: 500, erro: expect.stringContaining('Message came out falsy') })
  })

  it('timeout/rede continuam incertos', async () => {
    vi.mocked(fetchDigisacRaw).mockRejectedValueOnce(new Error('Digisac Request Timeout (30s)'))
    expect(await enviarMensagemResgateHubVendas({ contactId: CONTATO, texto: 'oi' })).toMatchObject({ ok: false, status: null, resultadoIncerto: true })

    vi.mocked(fetchDigisacRaw).mockRejectedValueOnce(new Error('fetch failed'))
    expect(await enviarMensagemResgateHubVendas({ contactId: CONTATO, texto: 'oi' })).toMatchObject({ ok: false, resultadoIncerto: true })
  })

  it('resposta 2xx com corpo invalido continua incerta', async () => {
    postResponde(200, 'nao-e-json')

    expect(await enviarMensagemResgateHubVendas({ contactId: CONTATO, texto: 'oi' })).toMatchObject({ ok: false, resultadoIncerto: true })
  })

  it('sucesso 2xx continua devolvendo messageId, ticketId e contactId', async () => {
    postResponde(200, JSON.stringify({ id: 'msg-1', ticketId: TICKET, contactId: CONTATO }))

    expect(await enviarMensagemResgateHubVendas({ contactId: CONTATO, texto: 'oi' })).toEqual({
      ok: true,
      messageId: 'msg-1',
      ticketId: TICKET,
      contactId: CONTATO,
    })
  })

  it('sem DIGISAC_BOT_USER_ID: falha confirmada sem chamar o DigiSac', async () => {
    delete process.env.DIGISAC_BOT_USER_ID

    const resultado = await enviarMensagemResgateHubVendas({ contactId: CONTATO, texto: 'oi' })

    expect(resultado).toMatchObject({ ok: false, resultadoIncerto: false })
    expect(fetchDigisacRaw).not.toHaveBeenCalled()
  })

  it('statusHttpPodeTerProcessadoMensagem: 5xx e 408 sim; 4xx e 2xx/3xx nao', () => {
    expect([500, 501, 502, 503, 504, 599, 408].every(statusHttpPodeTerProcessadoMensagem)).toBe(true)
    expect([400, 401, 403, 404, 409, 422, 429, 200, 301].some(statusHttpPodeTerProcessadoMensagem)).toBe(false)
  })
})
