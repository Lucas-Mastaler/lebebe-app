import { describe, expect, it } from 'vitest'
import { extrairTextoMensagemDigisac, pareceSaudacaoHubVendas, validarMensagemDigisac } from './payload'

const SAUDACAO_OFICIAL = `
Seja bem-vindo a Central de Atendimento Le Bebe!
Loja Portao http://wa.me/+55 41 8442-6528
Loja Bigorrilho https://wa.me/554188043042
Loja Hauer http://wa.me/+55 (41) 9222-0492
`

const SAUDACAO_COM_OLA = `Olá! Seja bem-vindo à Central de Atendimento Le🌟Bébé!

Por favor, clique na loja que você deseja falar:

🛒 Loja Portão  http://wa.me/+554184426528

🛒 Loja Bigorrilho http://wa.me/+554188043042

🛒 Loja Hauer http://wa.me/+554192220492`

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

  it('reconhece texto de data.data.interactive.body.text sem busca recursiva generica', () => {
    expect(
      extrairTextoMensagemDigisac({
        data: {
          interactive: { body: { text: SAUDACAO_OFICIAL } },
          qualquer: { text: 'texto que nao deve ser lido' },
        },
      })
    ).toBe(SAUDACAO_OFICIAL.trim())
  })

  it('nao reconhece mensagem manual incompleta sem dois telefones de loja', () => {
    expect(pareceSaudacaoHubVendas('Oi, central de atendimento Le Bebe. Loja Portao 554184426528')).toBe(false)
  })

  it('filtra antes de consultar quando evento nao e message.created ou faltam campos minimos', () => {
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

  it('mantem tipo nao chat para decisao auditavel no handler', () => {
    const mensagem = validarMensagemDigisac({
      event: 'message.created',
      data: {
        id: 'msg-1',
        type: 'interactive',
        contactId: 'contact-1',
        serviceId: 'service-1',
        timestamp: '2026-07-24T15:00:00.000Z',
        data: { interactive: { body: { text: 'Oi' } } },
      },
    })

    expect(mensagem).toMatchObject({
      messageId: 'msg-1',
      contactId: 'contact-1',
      serviceId: 'service-1',
      texto: 'Oi',
      data: { type: 'interactive' },
    })
  })

  describe('variacao com Ola na saudacao', () => {
    it('reconhece texto exato da variacao com Ola e emoji estrela', () => {
      expect(pareceSaudacaoHubVendas(SAUDACAO_COM_OLA)).toBe(true)
    })

    it('reconhece variacao com Ola em linha separada', () => {
      const texto = `Olá!\nSeja bem-vindo à Central de Atendimento Le🌟Bébé!\n\nPor favor, clique na loja que você deseja falar:\n\n🛒 Loja Portão  http://wa.me/+554184426528\n\n🛒 Loja Bigorrilho http://wa.me/+554188043042\n\n🛒 Loja Hauer http://wa.me/+554192220492`
      expect(pareceSaudacaoHubVendas(texto)).toBe(true)
    })

    it('reconhece variacao com duas ou mais linhas vazias', () => {
      const texto = `Olá!\n\n\nSeja bem-vindo à Central de Atendimento Le🌟Bébé!\n\n\n\nPor favor, clique na loja que você deseja falar:\n\n\n🛒 Loja Portão  http://wa.me/+554184426528\n\n🛒 Loja Bigorrilho http://wa.me/+554188043042\n\n🛒 Loja Hauer http://wa.me/+554192220492`
      expect(pareceSaudacaoHubVendas(texto)).toBe(true)
    })

    it('reconhece variacao com \\r\\n', () => {
      const texto = `Olá!\r\nSeja bem-vindo à Central de Atendimento Le🌟Bébé!\r\n\r\nPor favor, clique na loja que você deseja falar:\r\n\r\n🛒 Loja Portão  http://wa.me/+554184426528\r\n\r\n🛒 Loja Bigorrilho http://wa.me/+554188043042\r\n\r\n🛒 Loja Hauer http://wa.me/+554192220492`
      expect(pareceSaudacaoHubVendas(texto)).toBe(true)
    })

    it('reconhece variacao com espacos duplicados', () => {
      const texto = `Olá!  Seja  bem-vindo  à  Central  de  Atendimento  Le🌟Bébé!\n\nPor favor, clique na loja que você deseja falar:\n\n🛒  Loja  Portão   http://wa.me/+554184426528\n\n🛒  Loja  Bigorrilho  http://wa.me/+554188043042\n\n🛒  Loja  Hauer  http://wa.me/+554192220492`
      expect(pareceSaudacaoHubVendas(texto)).toBe(true)
    })

    it('reconhece variacao com espacos antes e depois das linhas', () => {
      const texto = `  Olá! Seja bem-vindo à Central de Atendimento Le🌟Bébé!  \n\n  Por favor, clique na loja que você deseja falar:  \n\n  🛒 Loja Portão  http://wa.me/+554184426528  \n\n  🛒 Loja Bigorrilho http://wa.me/+554188043042  \n\n  🛒 Loja Hauer http://wa.me/+554192220492  `
      expect(pareceSaudacaoHubVendas(texto)).toBe(true)
    })

    it('mensagem antiga sem Ola continua reconhecida', () => {
      expect(pareceSaudacaoHubVendas(SAUDACAO_OFICIAL)).toBe(true)
    })

    it('nao reconhece mensagem semelhante sem elementos caracteristicos (sem lojas)', () => {
      const texto = `Olá! Seja bem-vindo à Central de Atendimento Le🌟Bébé!\n\nPor favor, clique na loja que você deseja falar:`
      expect(pareceSaudacaoHubVendas(texto)).toBe(false)
    })

    it('nao reconhece mensagem com apenas uma loja', () => {
      const texto = `Olá! Seja bem-vindo à Central de Atendimento Le🌟Bébé!\n\nPor favor, clique na loja que você deseja falar:\n\n🛒 Loja Portão  http://wa.me/+554184426528`
      expect(pareceSaudacaoHubVendas(texto)).toBe(false)
    })

    it('nao reconhece mensagem comum contendo apenas Ola', () => {
      expect(pareceSaudacaoHubVendas('Olá')).toBe(false)
    })
  })
})
