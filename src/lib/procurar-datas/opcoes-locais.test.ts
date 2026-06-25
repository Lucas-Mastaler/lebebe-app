import { describe, expect, it, vi } from 'vitest'
import { montarOpcoesProcurarDatasLocais } from './opcoes-locais'

vi.mock('./config-db', () => ({
  buscarConfigsDb: vi.fn(async () => new Map([
    ['VALOR SEMANA ATÉ 10KM', { valor: '140', grupo: 'frete', valor_tipo: 'currency', is_secret: false }],
    ['PREÇO CONDOMINIO ADICIONAL', { valor: '60', grupo: 'frete', valor_tipo: 'currency', is_secret: false }],
  ])),
}))

describe('opcoes-locais', () => {
  it('retorna listas locais e config minima no contrato de /opcoes', async () => {
    const resultado = await montarOpcoesProcurarDatasLocais()

    expect(resultado.tempoMap).toEqual({})
    expect(resultado.opcoes.tipoBerco).toContain('MAXX')
    expect(resultado.opcoes.roupeiro).toContain('4 PTS (DIVERSOS)')
    expect(resultado.opcoes.painel).toContain('1 PAINEL E 2 MODULOS')
    expect(resultado.opcoes.baseSemana).toBe(140)
    expect(resultado.opcoes.adicionalCondominio).toBe(60)
  })
})

