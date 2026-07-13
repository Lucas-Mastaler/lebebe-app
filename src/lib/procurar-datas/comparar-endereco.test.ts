import { describe, expect, it } from 'vitest'
import { compararEnderecoCEPComGeocodificacao } from './comparar-endereco'

describe('compararEnderecoCEPComGeocodificacao', () => {
  it('bairro cidade e UF iguais -> nenhuma divergencia', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'Hauer', cidade: 'Curitiba', uf: 'PR' },
      { suburb: 'Hauer', city: 'Curitiba', state: 'Parana' },
    )
    expect(r.divergencia).toBe('nenhuma')
  })

  it('diferenca apenas de acento e caixa -> nenhuma divergencia', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'São João', cidade: 'São José dos Pinhais', uf: 'PR' },
      { suburb: 'sao joao', city: 'SAO JOSE DOS PINHAIS', state: 'PARANÁ' },
    )
    expect(r.divergencia).toBe('nenhuma')
  })

  it('diferenca de pontuacao e espacos -> nenhuma divergencia', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'Bom Jesus', cidade: 'Colombo', uf: 'PR' },
      { suburb: 'Bom  Jesus.', city: 'Colombo ', state: 'PR' },
    )
    expect(r.divergencia).toBe('nenhuma')
  })

  it('bairro diferente, cidade e UF iguais -> divergencia bairro', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'Hauer', cidade: 'Curitiba', uf: 'PR' },
      { suburb: 'Xaxim', city: 'Curitiba', state: 'Parana' },
    )
    expect(r.divergencia).toBe('bairro')
  })

  it('cidade diferente -> divergencia cidade', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'Centro', cidade: 'Curitiba', uf: 'PR' },
      { suburb: 'Centro', city: 'Colombo', state: 'Parana' },
    )
    expect(r.divergencia).toBe('cidade')
  })

  it('UF diferente -> divergencia uf', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'Centro', cidade: 'Curitiba', uf: 'PR' },
      { suburb: 'Centro', city: 'Curitiba', state: 'SP' },
    )
    expect(r.divergencia).toBe('uf')
  })

  it('bairro ausente no provider, cidade e UF iguais -> nenhuma divergencia', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'Hauer', cidade: 'Curitiba', uf: 'PR' },
      { city: 'Curitiba', state: 'Parana' },
    )
    expect(r.divergencia).toBe('nenhuma')
  })

  it('UF por extenso compativel -> nenhuma divergencia', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'Centro', cidade: 'Curitiba', uf: 'PR' },
      { suburb: 'Centro', city: 'Curitiba', state: 'PARANA' },
    )
    expect(r.divergencia).toBe('nenhuma')
  })

  it('state_code com prefixo BR- -> nenhuma divergencia', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'Centro', cidade: 'Curitiba', uf: 'PR' },
      { suburb: 'Centro', city: 'Curitiba', state_code: 'BR-PR' },
    )
    expect(r.divergencia).toBe('nenhuma')
  })

  it('bairro vazio no form e no provider -> nenhuma divergencia', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: '', cidade: 'Curitiba', uf: 'PR' },
      { city: 'Curitiba', state: 'Parana' },
    )
    expect(r.divergencia).toBe('nenhuma')
  })

  it('cidade ausente no provider -> nenhuma divergencia (backend ja rejeitou)', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'Centro', cidade: 'Curitiba', uf: 'PR' },
      { suburb: 'Centro', state: 'Parana' },
    )
    expect(r.divergencia).toBe('nenhuma')
  })

  it('UF ausente no provider -> nenhuma divergencia (backend ja rejeitou)', () => {
    const r = compararEnderecoCEPComGeocodificacao(
      { bairro: 'Centro', cidade: 'Curitiba', uf: 'PR' },
      { suburb: 'Centro', city: 'Curitiba' },
    )
    expect(r.divergencia).toBe('nenhuma')
  })
})
