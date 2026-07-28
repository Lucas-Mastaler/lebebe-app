import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processarWebhookHubVendas } from './processar-webhook'

const registrarEntradaHubVendasMock = vi.hoisted(() => vi.fn())
const registrarConversaoHubVendasMock = vi.hoisted(() => vi.fn())

vi.mock('./registrar-entrada', () => ({
  registrarEntradaHubVendas: registrarEntradaHubVendasMock,
}))

vi.mock('./registrar-conversao', () => ({
  registrarConversaoHubVendas: registrarConversaoHubVendasMock,
}))

const SAUDACAO = `
Seja bem-vindo a Central de Atendimento Le Bebe!
Loja Portao http://wa.me/+554184426528
Loja Bigorrilho http://wa.me/+554188043042
Loja Hauer http://wa.me/+554192220492
`

function payload(overrides: Record<string, unknown>) {
  return {
    event: 'message.created',
    data: {
      id: 'msg-1',
      contactId: 'contact-1',
      serviceId: '4af28025-c210-4336-a560-785d2fb8a778',
      ticketId: 'ticket-1',
      timestamp: '2026-07-24T12:00:00.000Z',
      type: 'chat',
      visible: true,
      isComment: false,
      isFromBot: false,
      ...overrides,
    },
  }
}

describe('processarWebhookHubVendas', () => {
  beforeEach(() => {
    registrarEntradaHubVendasMock.mockReset()
    registrarConversaoHubVendasMock.mockReset()
    registrarEntradaHubVendasMock.mockResolvedValue({ ok: true, processed: true })
    registrarConversaoHubVendasMock.mockResolvedValue({ ok: true, processed: true })
  })

  it('processa saudacao do Hub enviada pela empresa', async () => {
    const resultado = await processarWebhookHubVendas(
      payload({ isFromMe: true, sent: true, origin: 'user', text: SAUDACAO })
    )

    expect(resultado).toEqual({ ok: true, processed: true, kind: 'entrada_hub' })
    expect(registrarEntradaHubVendasMock).toHaveBeenCalledTimes(1)
  })

  it('ignora evento impossivel antes de chamar banco ou Digisac', async () => {
    const resultado = await processarWebhookHubVendas(payload({ type: 'image' }))

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'evento_fora_do_formato_monitorado' })
    expect(registrarEntradaHubVendasMock).not.toHaveBeenCalled()
    expect(registrarConversaoHubVendasMock).not.toHaveBeenCalled()
  })

  it('processa mensagem entrante em loja monitorada como conversao', async () => {
    const resultado = await processarWebhookHubVendas(
      payload({ serviceId: '0973f84b-8294-4615-9657-ba95b6346246', isFromMe: false, text: 'Oi' })
    )

    expect(resultado).toEqual({ ok: true, processed: true, kind: 'conversao_loja' })
    expect(registrarConversaoHubVendasMock).toHaveBeenCalledWith(expect.any(Object), 'bigorrilho')
  })

  it('ignora mensagem enviada por nos em loja', async () => {
    const resultado = await processarWebhookHubVendas(
      payload({ serviceId: '0973f84b-8294-4615-9657-ba95b6346246', isFromMe: true, text: 'Mensagem ativa' })
    )

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'nao_e_mensagem_cliente_loja' })
    expect(registrarConversaoHubVendasMock).not.toHaveBeenCalled()
  })
})
