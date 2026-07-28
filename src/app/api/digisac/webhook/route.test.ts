import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

const processarTriagemLojaDigisacMock = vi.hoisted(() => vi.fn())
const processarWebhookHubVendasMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/digisac/triagem', () => ({
  processarTriagemLojaDigisac: processarTriagemLojaDigisacMock,
}))

vi.mock('@/lib/digisac/hub-vendas/processar-webhook', () => ({
  processarWebhookHubVendas: processarWebhookHubVendasMock,
}))

function criarRequest(body: object, secret = 'segredo') {
  return new NextRequest('http://local/api/digisac/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-digisac-secret': secret },
    body: JSON.stringify(body),
  })
}

describe('/api/digisac/webhook', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    process.env.DIGISAC_WEBHOOK_SECRET = 'segredo'
    delete process.env.DIGISAC_TRIAGEM_LOJA_ATIVA
    processarTriagemLojaDigisacMock.mockReset()
    processarWebhookHubVendasMock.mockReset()
    processarTriagemLojaDigisacMock.mockResolvedValue({ ok: true, ignored: true, reason: 'triagem' })
    processarWebhookHubVendasMock.mockResolvedValue({ ok: true, ignored: true, reason: 'hub' })
  })

  it('preserva 401 para secret invalido', async () => {
    const response = await POST(criarRequest({ event: 'message.created', data: {} }, 'errado'))

    expect(response.status).toBe(401)
    expect(processarTriagemLojaDigisacMock).not.toHaveBeenCalled()
    expect(processarWebhookHubVendasMock).not.toHaveBeenCalled()
  })

  it('executa triagem e handler Hub/Vendas na mesma rota', async () => {
    process.env.DIGISAC_TRIAGEM_LOJA_ATIVA = 'true'
    const body = { event: 'message.created', data: { id: 'msg-1' } }
    const response = await POST(criarRequest(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ignored: true, reason: 'triagem' })
    expect(processarTriagemLojaDigisacMock).toHaveBeenCalledWith(body)
    expect(processarWebhookHubVendasMock).toHaveBeenCalledWith(body)
  })

  it('mantem triagem desligada quando flag nao e exatamente true', async () => {
    process.env.DIGISAC_TRIAGEM_LOJA_ATIVA = 'false'
    const body = {
      event: 'message.created',
      data: {
        id: 'msg-1',
        serviceId: '4af28025-c210-4336-a560-785d2fb8a778',
        isFromMe: false,
        isFromBot: false,
        isComment: false,
      },
    }
    const response = await POST(criarRequest(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ignored: true, reason: 'hub' })
    expect(processarTriagemLojaDigisacMock).not.toHaveBeenCalled()
    expect(processarWebhookHubVendasMock).toHaveBeenCalledWith(body)
  })

  it('executa Hub mesmo sem secret configurado em producao', async () => {
    delete process.env.DIGISAC_WEBHOOK_SECRET
    vi.stubEnv('NODE_ENV', 'production')

    const body = { event: 'message.created', data: { id: 'msg-1' } }
    const response = await POST(criarRequest(body, 'qualquer'))

    expect(response.status).toBe(200)
    expect(processarWebhookHubVendasMock).toHaveBeenCalledWith(body)
  })

  it('isolamento: falha no Hub nao quebra resposta da triagem', async () => {
    process.env.DIGISAC_TRIAGEM_LOJA_ATIVA = 'true'
    processarWebhookHubVendasMock.mockRejectedValueOnce(new Error('hub caiu'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await POST(criarRequest({ event: 'message.created', data: { id: 'msg-1' } }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ignored: true, reason: 'triagem' })
    expect(consoleErrorSpy).toHaveBeenCalledWith('[DIGISAC-WEBHOOK] Falha no Hub/Vendas erro=hub caiu')
    consoleErrorSpy.mockRestore()
  })

  it('isolamento: falha na triagem nao impede handler Hub', async () => {
    process.env.DIGISAC_TRIAGEM_LOJA_ATIVA = 'true'
    processarTriagemLojaDigisacMock.mockRejectedValueOnce(new Error('triagem caiu'))

    const response = await POST(criarRequest({ event: 'message.created', data: { id: 'msg-1' } }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ignored: true, reason: 'hub' })
    expect(processarWebhookHubVendasMock).toHaveBeenCalledTimes(1)
  })

  it('loga resumo seguro sem texto, telefone ou contactId', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const body = {
      event: 'message.created',
      data: {
        id: 'msg-1',
        contactId: 'contact-secreto',
        serviceId: '4af28025-c210-4336-a560-785d2fb8a778',
        type: 'chat',
        text: 'Oi, meu telefone e 41999999999',
      },
    }

    await POST(criarRequest(body))

    const logs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(logs).toContain('[DIGISAC-WEBHOOK] Evento recebido')
    expect(logs).toContain('"temTexto":true')
    expect(logs).not.toContain('Oi, meu telefone')
    expect(logs).not.toContain('41999999999')
    expect(logs).not.toContain('contact-secreto')
    consoleLogSpy.mockRestore()
  })
})
