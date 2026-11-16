import { describe, expect, it } from 'vitest'
import { classificarDescricao, quantidadeAgrupada, resumirCategorias } from './categorias'

describe('categorias de recebimento', () => {
  it.each([
    ['ROUPEIRO ZUPY 4PTS CLEAN SLOW MOTION', 'roupeiro'],
    ['GAVETEIRO FLOW BCO SOFT', 'comoda'],
    ['COMODA ZUPY GAVETEIRO CLEAN', 'comoda'],
    ['BERÇO FORMARE', 'berco'],
    ['COMODA TESS C/PORTA', 'comoda'],
    ['MÓDULO E PAINEL', 'painel'],
    ['PRATELEIRA', 'prateleira'], ['MESA', 'mesa'], ['CAMA', 'cama'],
    ['BERÇO COM CAMA', 'revisar'], ['OUTRO PRODUTO', 'revisar'],
  ])('classifica %s', (descricao, esperado) => expect(classificarDescricao(descricao)).toBe(esperado))
  it('prioriza decisão salva por descrição normalizada', () => {
    expect(classificarDescricao('MÓDULO especial', { 'modulo especial': 'mesa' })).toBe('mesa')
  })
  it('considera quantidade consolidada e sinaliza divisões inconsistentes', () => {
    expect(quantidadeAgrupada(12, 3)).toBe(4)
    expect(quantidadeAgrupada(11, 3)).toBeNull()
  })
  it('soma volumes e exclui volume avulso', () => {
    const resultado = resumirCategorias([
      { descricao: 'BERÇO', quantidade: 2, previstos: 6, conferidos: 4 },
      { descricao: 'VOLUME BERÇO', quantidade: 1, previstos: 1, conferidos: 1 },
    ], {})
    expect(resultado.berco).toEqual({ quantidade: 2, previstos: 6, conferidos: 4, semQuantidade: 0 })
  })
})
