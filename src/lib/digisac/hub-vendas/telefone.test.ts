import { afterEach, describe, expect, it, vi } from 'vitest'
import { extrairTelefoneContatoHubVendas, normalizarTelefoneBrasilHubVendas } from './telefone'

describe('normalizarTelefoneBrasilHubVendas', () => {
  describe('preserva o comportamento anterior valido', () => {
    it.each([
      ['celular brasileiro sem DDI (11 digitos)', '41996246875', '5541996246875'],
      ['celular brasileiro com 55', '5541996246875', '5541996246875'],
      ['celular brasileiro com +55', '+5541996246875', '5541996246875'],
      ['numero formatado com caracteres', '+55 (41) 99624-6875', '5541996246875'],
      ['formatado sem DDI', '(41) 99624-6875', '5541996246875'],
      ['celular sem o nono digito (12 com 55, como o DigiSac entrega)', '554184148660', '554184148660'],
      ['fixo sem DDI (10 digitos)', '4133334444', '554133334444'],
      ['fixo com 55', '554133334444', '554133334444'],
      ['prefixo internacional 00 + 55', '005541996246875', '5541996246875'],
      ['DDD 55 (Santa Maria/RS) sem DDI nao e confundido com o DDI', '55996246875', '5555996246875'],
      ['DDD 55 com DDI', '5555996246875', '5555996246875'],
    ])('%s', (_nome, entrada, esperado) => {
      expect(normalizarTelefoneBrasilHubVendas(entrada)).toEqual({ ddi: esperado, motivo: null })
    })
  })

  describe('nao converte numero estrangeiro em brasileiro', () => {
    it('possivel numero espanhol (+34) sem sinal: 11 digitos, 3o digito != 9', () => {
      // Caso real de 19/09: 34 6XXXXXXXX virava 55 34 6XXXXXXXX (13 digitos, DDD 34 existe no Brasil).
      expect(normalizarTelefoneBrasilHubVendas('34612345678')).toEqual({ ddi: null, motivo: 'formato_invalido' })
      expect(normalizarTelefoneBrasilHubVendas('34712345678')).toEqual({ ddi: null, motivo: 'formato_invalido' })
    })

    it('numero espanhol com + explicito e rejeitado como internacional', () => {
      expect(normalizarTelefoneBrasilHubVendas('+34 612 345 678')).toEqual({ ddi: null, motivo: 'internacional' })
      expect(normalizarTelefoneBrasilHubVendas('+34612345678')).toEqual({ ddi: null, motivo: 'internacional' })
    })

    it('prefixo 00 com DDI diferente de 55 e rejeitado como internacional', () => {
      expect(normalizarTelefoneBrasilHubVendas('0034612345678')).toEqual({ ddi: null, motivo: 'internacional' })
    })

    it('outros DDIs conhecidos (EUA, Portugal, Alemanha) nao viram brasileiros', () => {
      expect(normalizarTelefoneBrasilHubVendas('+1 415 555 0123')).toEqual({ ddi: null, motivo: 'internacional' })
      expect(normalizarTelefoneBrasilHubVendas('+351 912 345 678')).toEqual({ ddi: null, motivo: 'internacional' })
      expect(normalizarTelefoneBrasilHubVendas('4915123456789')).toEqual({ ddi: null, motivo: 'formato_invalido' })
    })

    it('numero com + e 55 mas formato brasileiro invalido continua rejeitado', () => {
      expect(normalizarTelefoneBrasilHubVendas('+55 34 61234 5678')).toEqual({ ddi: null, motivo: 'formato_invalido' })
    })
  })

  describe('formato invalido', () => {
    it('entrada vazia, nula ou sem digitos', () => {
      expect(normalizarTelefoneBrasilHubVendas('')).toEqual({ ddi: null, motivo: 'vazio' })
      expect(normalizarTelefoneBrasilHubVendas('   ')).toEqual({ ddi: null, motivo: 'vazio' })
      expect(normalizarTelefoneBrasilHubVendas(null)).toEqual({ ddi: null, motivo: 'vazio' })
      expect(normalizarTelefoneBrasilHubVendas(undefined)).toEqual({ ddi: null, motivo: 'vazio' })
      expect(normalizarTelefoneBrasilHubVendas('abc')).toEqual({ ddi: null, motivo: 'vazio' })
    })

    it('numero curto', () => {
      expect(normalizarTelefoneBrasilHubVendas('999999')).toEqual({ ddi: null, motivo: 'formato_invalido' })
      expect(normalizarTelefoneBrasilHubVendas('419962468')).toEqual({ ddi: null, motivo: 'formato_invalido' })
    })

    it('numero excessivamente longo', () => {
      expect(normalizarTelefoneBrasilHubVendas('554199624687512345')).toEqual({ ddi: null, motivo: 'formato_invalido' })
      expect(normalizarTelefoneBrasilHubVendas('41996246875123')).toEqual({ ddi: null, motivo: 'formato_invalido' })
    })

    it('DDD inexistente', () => {
      expect(normalizarTelefoneBrasilHubVendas('10996246875')).toEqual({ ddi: null, motivo: 'formato_invalido' })
      expect(normalizarTelefoneBrasilHubVendas('5500996246875')).toEqual({ ddi: null, motivo: 'formato_invalido' })
    })

    it('celular de 11 digitos sem 9 na 3a posicao', () => {
      expect(normalizarTelefoneBrasilHubVendas('41896246875')).toEqual({ ddi: null, motivo: 'formato_invalido' })
    })

    it('assinante iniciando em 0 ou 1', () => {
      expect(normalizarTelefoneBrasilHubVendas('4103334444')).toEqual({ ddi: null, motivo: 'formato_invalido' })
      expect(normalizarTelefoneBrasilHubVendas('4113334444')).toEqual({ ddi: null, motivo: 'formato_invalido' })
    })
  })
})

describe('extrairTelefoneContatoHubVendas — telefone estrangeiro', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('contato brasileiro (formato real do DigiSac: 55 + 12 digitos) continua aceito', () => {
    const telefone = extrairTelefoneContatoHubVendas({ data: { number: '554184148660' } })
    expect(telefone).toMatchObject({ telefoneNormalizadoDDI: '554184148660', telefoneNormalizado: '4184148660' })
  })

  it('contato com formatacao brasileira continua aceito', () => {
    const telefone = extrairTelefoneContatoHubVendas({ data: { number: '+55 (41) 99624-6875' } })
    expect(telefone).toMatchObject({ telefoneNormalizadoDDI: '5541996246875', telefoneNormalizado: '41996246875' })
  })

  it('contato com numero espanhol (34 6...) NAO vira telefone brasileiro e registra o motivo no log', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(extrairTelefoneContatoHubVendas({ data: { number: '34612345678' } })).toBeNull()
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('motivos=formato_invalido'))
    // O log nao carrega o numero do cliente.
    expect(String(aviso.mock.calls[0][0])).not.toContain('34612345678')
  })

  it('usa outro candidato valido do contato quando o primeiro e estrangeiro', () => {
    const telefone = extrairTelefoneContatoHubVendas({ number: '+34612345678', phone: '41996246875' })
    expect(telefone?.telefoneNormalizadoDDI).toBe('5541996246875')
  })

  it('contato sem telefone retorna null', () => {
    expect(extrairTelefoneContatoHubVendas({ data: {} })).toBeNull()
  })
})
