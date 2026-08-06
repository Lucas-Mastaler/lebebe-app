import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/digisac/clienteDigisac', () => ({
  fetchDigisacRaw: vi.fn(),
  sanitizarDigisacParaLog: (s: string) => s.replace(/Bearer\s+\S+/g, 'Bearer [redacted]'),
}))

vi.mock('@/lib/digisac/sgi-sync', () => ({
  gerarVariacoesTelefone: vi.fn(() => ['5541999999999']),
  normalizarTelefoneDDI: vi.fn((t: string) => ({ telefoneNormalizadoDDI: t, variacoesDDI: [] })),
}))

vi.mock('./telefone', () => ({
  extrairCandidatosNomeContatoDigisac: vi.fn(() => []),
  extrairNomeContatoDigisac: vi.fn(() => null),
  extrairTelefoneContatoHubVendas: vi.fn(() => null),
}))

const { fetchDigisacRaw } = await import('@/lib/digisac/clienteDigisac')
const { enviarMensagemResgateHubVendas, abrirTicketResgateHubVendas } = await import('./envio')

describe('envio como bot Hub/Vendas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DIGISAC_BOT_USER_ID = 'bot-user-tech-id'
  })

  it('mensagem de recuperação inclui origin=bot', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve(JSON.stringify({ id: 'msg-1' })) } as Response
    })

    await enviarMensagemResgateHubVendas({ contactId: 'contact-1', texto: 'mensagem de recuperação' })

    expect(capturedBody).toBeTruthy()
    expect(capturedBody!.origin).toBe('bot')
  })

  it('usa o usuário técnico do bot (DIGISAC_BOT_USER_ID)', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve(JSON.stringify({ id: 'msg-1' })) } as Response
    })

    await enviarMensagemResgateHubVendas({ contactId: 'contact-1', texto: 'teste' })

    expect(capturedBody!.userId).toBe('bot-user-tech-id')
  })

  it('não usa usuário autenticado (userId vem da env, não do frontend)', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve(JSON.stringify({ id: 'msg-1' })) } as Response
    })

    // A função não recebe userId como parâmetro — usa apenas env var
    await enviarMensagemResgateHubVendas({ contactId: 'contact-1', texto: 'teste' })

    expect(capturedBody!.userId).toBe('bot-user-tech-id')
    // A assinatura da função não aceita userId — confirma que não vem do usuário autenticado
  })

  it('inclui fromMe=true', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve(JSON.stringify({ id: 'msg-1' })) } as Response
    })

    await enviarMensagemResgateHubVendas({ contactId: 'contact-1', texto: 'teste' })

    expect(capturedBody!.fromMe).toBe(true)
  })

  it('retorna erro se DIGISAC_BOT_USER_ID não configurado', async () => {
    delete process.env.DIGISAC_BOT_USER_ID

    const resultado = await enviarMensagemResgateHubVendas({ contactId: 'contact-1', texto: 'teste' })

    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.erro).toBe('digisac_bot_user_id_nao_configurado')
    }
  })

  it('texto da recuperação não muda (preserva contactId e texto)', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve(JSON.stringify({ id: 'msg-1' })) } as Response
    })

    await enviarMensagemResgateHubVendas({ contactId: 'contact-xyz', texto: 'Olá Maria, tudo bem?' })

    expect(capturedBody!.text).toBe('Olá Maria, tudo bem?')
    expect(capturedBody!.contactId).toBe('contact-xyz')
    expect(capturedBody!.type).toBe('chat')
  })

  it('erro Digisac entra no fluxo atual de retry (resultadoIncerto)', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => {
      throw new Error('Digisac Request Timeout (30s)')
    })

    const resultado = await enviarMensagemResgateHubVendas({ contactId: 'contact-1', texto: 'teste' })

    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.resultadoIncerto).toBe(true)
    }
  })

  it('abrirTicketResgateHubVendas também usa DIGISAC_BOT_USER_ID', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve(JSON.stringify({ ticketId: 'ticket-1' })) } as Response
    })

    await abrirTicketResgateHubVendas({ contactId: 'contact-1', serviceId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686' })

    expect(capturedBody).toBeTruthy()
    expect(capturedBody!.byUserId).toBe('bot-user-tech-id')
  })
})
