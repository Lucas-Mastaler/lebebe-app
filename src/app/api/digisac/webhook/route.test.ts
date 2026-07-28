import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
    process.env.DIGISAC_WEBHOOK_SECRET = 'segredo'
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
    const body = { event: 'message.created', data: { id: 'msg-1' } }
    const response = await POST(criarRequest(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ignored: true, reason: 'triagem' })
    expect(processarTriagemLojaDigisacMock).toHaveBeenCalledWith(body)
    expect(processarWebhookHubVendasMock).toHaveBeenCalledWith(body)
  })

  it('isolamento: falha no Hub nao quebra resposta da triagem', async () => {
    processarWebhookHubVendasMock.mockRejectedValueOnce(new Error('hub caiu'))

    const response = await POST(criarRequest({ event: 'message.created', data: { id: 'msg-1' } }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, ignored: true, reason: 'triagem' })
  })

  it('isolamento: falha na triagem nao impede handler Hub', async () => {
    processarTriagemLojaDigisacMock.mockRejectedValueOnce(new Error('triagem caiu'))

    const response = await POST(criarRequest({ event: 'message.created', data: { id: 'msg-1' } }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: false, error: 'erro_interno' })
    expect(processarWebhookHubVendasMock).toHaveBeenCalledTimes(1)
  })
})
