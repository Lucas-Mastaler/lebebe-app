import { describe, expect, it } from 'vitest'
import {
  extrairPrimeiroNomeValidoHubVendas,
  montarMensagemRecuperacaoHubVendas,
  obterNomeExibicaoLojaHubVendas,
  resolverNomeClienteHubVendas,
  validarTextoFinalHubVendas,
} from './mensagem'
import { hashTextoHubVendas } from './envio'

const TEMPLATE_DIRETA = `Olá, [NOME]!

Aqui é da Le Bébé [LOJA]. Vimos que você entrou em contato com a nossa Central de Atendimento, mas talvez não tenha conseguido falar diretamente com uma das lojas.

Podemos te ajudar por aqui? Qual produto você está procurando?`

describe('mensagem Hub/Vendas', () => {
  it.each([
    ['MARIA EDUARDA SILVA', 'Maria'],
    ['maria eduarda', 'Maria'],
    ['  João   Pedro  ', 'João'],
    ['ANA', 'Ana'],
    ['JOSÉ CARLOS', 'José'],
    ['ÂNGELA MARIA', 'Ângela'],
    ['ÉRICA', 'Érica'],
    ['M\u00ea Mastaler', 'M\u00ea'],
    ["ANNE-MARIE O'CONNOR", 'Anne-marie'],
  ])('extrai primeiro nome valido de %s', (entrada, esperado) => {
    expect(extrairPrimeiroNomeValidoHubVendas(entrada)).toBe(esperado)
  })

  it.each([
    '',
    'Cliente',
    'Contato',
    'Sem nome',
    '(41) 99999-9999',
    '41999999999',
    '123.456.789-09',
    '12.345.678/0001-99',
    'cliente@example.com',
    '550e8400-e29b-41d4-a716-446655440000',
    '***',
    'undefined',
    'null',
    'Lead Hub Vendas',
    '5541999999999',
  ])('descarta nome invalido %s', (entrada) => {
    expect(extrairPrimeiroNomeValidoHubVendas(entrada, '5541999999999')).toBeNull()
  })

  it('monta template com nome e loja final', () => {
    expect(montarMensagemRecuperacaoHubVendas({
      template: TEMPLATE_DIRETA,
      nome: 'Maria',
      lojaExibicao: 'Portão',
    })).toContain('Olá, Maria!\n\nAqui é da Le Bébé Portão.')
  })

  it('monta fallback natural sem nome', () => {
    const texto = montarMensagemRecuperacaoHubVendas({
      template: TEMPLATE_DIRETA,
      nome: null,
      lojaExibicao: 'Portão',
    })

    expect(texto).toContain('Olá!\n\nAqui é da Le Bébé Portão.')
    expect(texto).not.toContain('[NOME]')
    expect(texto).not.toContain('undefined')
    expect(texto).not.toContain('null')
  })

  it('resolve a primeira fonte valida sem sobrescrever por fonte posterior', () => {
    const resultado = resolverNomeClienteHubVendas({
      telefoneNormalizadoDDI: '5541999999999',
      fontes: [
        { nomeBruto: 'Cliente', origem: 'lead_persistido' },
        { nomeBruto: 'M\u00ea Mastaler', origem: 'perfil_whatsapp', campo: 'data.pushName' },
        { nomeBruto: 'Maria Loja', origem: 'contato_destino_existente' },
      ],
    })

    expect(resultado).toMatchObject({
      nomeCompleto: 'M\u00ea Mastaler',
      primeiroNome: 'M\u00ea',
      origemNome: 'perfil_whatsapp',
      fallbackNome: false,
      campoOrigem: 'data.pushName',
    })
  })

  it('valida placeholders tecnicos pendentes no texto final', () => {
    expect(validarTextoFinalHubVendas('OlÃ¡, Maria!\n\nAqui Ã© da Le BÃ©bÃ© PortÃ£o.')).toEqual({
      ok: true,
      placeholdersPendentes: [],
    })
    expect(validarTextoFinalHubVendas('OlÃ¡, [NOME]!\n\nAqui Ã© da Le BÃ©bÃ© [LOJA]. undefined')).toEqual({
      ok: false,
      placeholdersPendentes: ['[LOJA]', '[NOME]', 'undefined'],
    })
  })

  it.each([
    ['c60d720f-5ad5-4a1b-bedb-e51495dee686', 'Portão'],
    ['0973f84b-8294-4615-9657-ba95b6346246', 'Bigorrilho'],
    ['1352c41b-80a9-4e74-b9d9-4c5e7aed060e', 'Hauer'],
    ['desconhecida', 'Le Bébé'],
  ])('resolve nome de exibicao da loja %s', (serviceId, esperado) => {
    expect(obterNomeExibicaoLojaHubVendas({ serviceId })).toBe(esperado)
  })

  it('gera hash depois da substituicao final', () => {
    const comNome = montarMensagemRecuperacaoHubVendas({
      template: TEMPLATE_DIRETA,
      nome: 'Maria',
      lojaExibicao: 'Portão',
    })
    const semNome = montarMensagemRecuperacaoHubVendas({
      template: TEMPLATE_DIRETA,
      nome: null,
      lojaExibicao: 'Portão',
    })

    expect(hashTextoHubVendas(comNome)).not.toBe(hashTextoHubVendas(semNome))
    expect(hashTextoHubVendas(comNome)).toHaveLength(64)
  })
})
