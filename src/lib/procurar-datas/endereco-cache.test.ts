import { describe, expect, it } from 'vitest'
import {
  cacheRowCompativelComEndereco,
  cacheRowConfidenceAceitavel,
  GEO_CACHE_CONFIDENCE_MINIMA_HIT_SEGURO,
  montarEnderecoDisplayProcurarDatas,
  montarHashEnderecoLegado,
  type GeoCacheRow,
} from './endereco-cache'

const rowBase: GeoCacheRow = {
  chave_endereco: 'cache-key',
  endereco_completo: 'Avenida Marechal Floriano Peixoto, 5000, Hauer, Curitiba - PR, Brasil',
  logradouro: 'Avenida Marechal Floriano Peixoto',
  numero: '5000',
  bairro: 'Hauer',
  cidade: 'Curitiba',
  uf: 'PR',
  cep: '81610-000',
  lat: -25.5,
  lng: -49.2,
  provider: 'locationiq',
  confidence: 0.8,
}

const formBase = {
  logradouro: 'Av Marechal Floriano Peixoto',
  numero: '5000',
  bairro: 'Hauer',
  cidade: 'Curitiba',
  uf: 'PR',
  cep: '81610-000',
}

describe('endereco-cache', () => {
  it('monta display no formato usado pelo fluxo de procurar datas', () => {
    expect(
      montarEnderecoDisplayProcurarDatas({
        logradouro: 'Av Marechal Floriano Peixoto',
        numero: '5000',
        bairro: 'Hauer',
        cidade: 'Curitiba',
        uf: 'pr',
      })
    ).toBe('Av Marechal Floriano Peixoto, 5000, Hauer, Curitiba - PR, Brasil')
  })

  it('gera hash legado ignorando numero do endereco', () => {
    const base = {
      logradouro: 'Av Marechal Floriano Peixoto',
      bairro: 'Hauer',
      cidade: 'Curitiba',
      uf: 'PR',
    }

    expect(montarHashEnderecoLegado({ ...base, numero: '5000' })).toBe(
      montarHashEnderecoLegado({ ...base, numero: '5636' })
    )
  })

  it('rejeita cache quando o numero diverge', () => {
    expect(cacheRowCompativelComEndereco({ ...rowBase, numero: '5636' }, formBase)).toBe(false)
  })

  it('rejeita cache sem numero quando o payload tem numero', () => {
    expect(cacheRowCompativelComEndereco({ ...rowBase, numero: null }, formBase)).toBe(false)
  })

  it('rejeita cache quando cidade ou UF divergem', () => {
    expect(cacheRowCompativelComEndereco({ ...rowBase, cidade: 'Pinhais' }, formBase)).toBe(false)
    expect(cacheRowCompativelComEndereco({ ...rowBase, uf: 'SC' }, formBase)).toBe(false)
  })

  it('aceita abreviacao segura de tipo de logradouro', () => {
    expect(cacheRowCompativelComEndereco(rowBase, formBase)).toBe(true)
  })

  it('rejeita cache quando CEP informado diverge do payload', () => {
    expect(cacheRowCompativelComEndereco({ ...rowBase, cep: '80000-000' }, formBase)).toBe(false)
  })

  it('rejeita confidence baixa como hit seguro de cache', () => {
    expect(GEO_CACHE_CONFIDENCE_MINIMA_HIT_SEGURO).toBe(0.7)
    expect(cacheRowConfidenceAceitavel({ ...rowBase, confidence: 0.05339000762951091 })).toBe(false)
    expect(cacheRowConfidenceAceitavel({ ...rowBase, confidence: 0.7 })).toBe(true)
  })
})
