import { describe, expect, it } from 'vitest'
import { extrairTextoMensagemDigisac, pareceSaudacaoHubVendas, validarMensagemDigisac } from './payload'

const SAUDACAO_OFICIAL = `
Seja bem-vindo a Central de Atendimento Le Bebe!
Loja Portao http://wa.me/+55 41 8442-6528
Loja Bigorrilho https://wa.me/554188043042
Loja Hauer http://wa.me/+55 (41) 9222-0492
`

describe('payload Hub/Vendas', () => {
  it('reconhece saudacao robusta com links e numeros formatados', () => {
    expect(pareceSaudacaoHubVendas(SAUDACAO_OFICIAL)).toBe(true)
  })

  it('reconhece texto de interactive.body.text', () => {
    expect(
      pareceSaudacaoHubVendas(
        extrairTextoMensagemDigisac({ interactive: { body: { text: SAUDACAO_OFICIAL } } })
      )
    ).toBe(true)
  })

  it('nao reconhece mensagem manual incompleta sem dois telefones de loja', () => {
    expect(pareceSaudacaoHubVendas('Oi, central de atendimento Le Bebe. Loja Portao 554184426528')).toBe(false)
  })

  it('filtra antes de consultar quando evento nao e message.created ou faltam campos', () => {
    expect(validarMensagemDigisac({ event: 'ticket.created', data: {} })).toBeNull()
    expect(validarMensagemDigisac({ event: 'message.created', data: { id: 'm1' } })).toBeNull()
  })

  it('normaliza payload Digisac direto sem envelope n8n', () => {
    const mensagem = validarMensagemDigisac({
      event: 'message.created',
      data: {
        id: 'msg-1',
        type: 'chat',
        visible: true,
        contactId: 'contact-1',
        serviceId: 'service-1',
        ticketId: 'ticket-1',
        timestamp: '2026-07-24T15:00:00.000Z',
        text: 'Oi',
      },
    })

    expect(mensagem).toMatchObject({
      event: 'message.created',
      messageId: 'msg-1',
      contactId: 'contact-1',
      serviceId: 'service-1',
      ticketId: 'ticket-1',
      texto: 'Oi',
    })
  })
})
