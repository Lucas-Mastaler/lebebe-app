import { describe, expect, it } from 'vitest'
import {
  normalizarCliente,
  normalizarComprador,
  normalizarConsultora,
  normalizarIdentificadorNumericoOpcional,
  normalizarNomeColecaoCatalogo,
  normalizarNumeroLancamento,
  normalizarNumeroPedidoCompra,
  normalizarObservacoes,
  normalizarReferenciaCatalogo,
} from './normalizacao'

describe('normalização de Pedidos Personalizados', () => {
  it('normaliza consultora com trim, espaços, acentos e maiúsculas', () => {
    expect(normalizarConsultora('  Niége   Silva  ')).toBe('NIÉGE SILVA')
    expect(normalizarConsultora('Nie\u0301ge')).toBe('NIÉGE')
  })

  it('normaliza cliente sem impedir números e pontuação comuns', () => {
    expect(normalizarCliente('  empresa  bebê  2 - matriz  ')).toBe('EMPRESA BEBÊ 2 - MATRIZ')
  })

  it('remove caracteres de controle de campos de linha única', () => {
    expect(normalizarCliente('CLIENTE\u0000 TESTE\n2')).toBe('CLIENTE TESTE2')
  })

  it('preserva zeros à esquerda nos identificadores numéricos', () => {
    expect(normalizarIdentificadorNumericoOpcional(' 000123 ')).toBe('000123')
    expect(normalizarNumeroLancamento(' 0001 ')).toBe('0001')
    expect(normalizarNumeroPedidoCompra(' 0002 ')).toBe('0002')
  })

  it('converte identificadores opcionais vazios em null', () => {
    expect(normalizarIdentificadorNumericoOpcional('   ')).toBeNull()
    expect(normalizarNumeroLancamento(undefined)).toBeNull()
    expect(normalizarNumeroPedidoCompra(null)).toBeNull()
  })

  it('normaliza comprador e coleção em maiúsculas', () => {
    expect(normalizarComprador('  João   Silva ')).toBe('JOÃO SILVA')
    expect(normalizarNomeColecaoCatalogo('  coleção   formas ')).toBe('COLEÇÃO FORMAS')
  })

  it('normaliza referência com hífen sem remover espaço inválido', () => {
    expect(normalizarReferenciaCatalogo(' abc-123 ')).toBe('ABC-123')
    expect(normalizarReferenciaCatalogo('abc 123')).toBe('ABC 123')
  })

  it('preserva caixa e quebras de linha das observações', () => {
    expect(normalizarObservacoes('  Primeira linha\nSegunda Linha  ')).toBe('Primeira linha\nSegunda Linha')
  })

  it('remove controles inadequados sem remover quebra de linha legítima', () => {
    expect(normalizarObservacoes('A\u0000B\nC\u0007D')).toBe('AB\nCD')
  })

  it('converte opcionais textuais vazios em null', () => {
    expect(normalizarComprador('  ')).toBeNull()
    expect(normalizarNomeColecaoCatalogo(null)).toBeNull()
    expect(normalizarReferenciaCatalogo(undefined)).toBeNull()
    expect(normalizarObservacoes('')).toBeNull()
  })
})
