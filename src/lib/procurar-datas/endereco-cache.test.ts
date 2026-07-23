import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buscarEnderecosNoGeoCacheEmLote,
  cacheRowCompativelComEndereco,
  cacheRowConfidenceAceitavel,
  GEO_CACHE_BATCH_HASH_CHUNK_SIZE,
  GEO_CACHE_CONFIDENCE_MINIMA_HIT_SEGURO,
  montarEnderecoDisplayProcurarDatas,
  montarHashEnderecoComNumero,
  montarHashEnderecoLegado,
  type GeoCacheRow,
} from './endereco-cache'

const supabaseInMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        in: supabaseInMock,
      }),
    }),
  }),
}))

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
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseInMock.mockResolvedValue({ data: [], error: null })
  })

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

  it('cache antigo continua compativel quando bairro salvo e o do formulario, nao o termo generico do provider', () => {
    expect(cacheRowCompativelComEndereco({ ...rowBase, bairro: 'Xaxim' }, { ...formBase, bairro: 'Xaxim' })).toBe(true)
    expect(cacheRowCompativelComEndereco({ ...rowBase, bairro: 'Casa' }, { ...formBase, bairro: 'Xaxim' })).toBe(false)
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

  it('busca em lote por hash com numero e retorna hit seguro', async () => {
    supabaseInMock.mockResolvedValueOnce({
      data: [{ ...rowBase, chave_endereco: montarHashEnderecoComNumero(formBase) }],
      error: null,
    })

    const resultado = await buscarEnderecosNoGeoCacheEmLote([{ chave: 'agenda-1', form: formBase }])

    expect(supabaseInMock).toHaveBeenCalledTimes(1)
    expect(resultado.hashesConsultados).toBe(2)
    expect(resultado.chunks).toBe(1)
    expect(resultado.registrosRetornados).toBe(1)
    expect(resultado.resultadosPorChave['agenda-1']).toMatchObject({
      status: 'hit',
      motivo: 'match_seguro',
    })
  })

  it('busca em lote por hash legado sem numero', async () => {
    supabaseInMock.mockResolvedValueOnce({
      data: [{ ...rowBase, chave_endereco: montarHashEnderecoLegado(formBase) }],
      error: null,
    })

    const resultado = await buscarEnderecosNoGeoCacheEmLote([{ chave: 'agenda-1', form: formBase }])

    expect(resultado.resultadosPorChave['agenda-1']).toMatchObject({
      status: 'hit',
      motivo: 'match_seguro',
    })
  })

  it('preserva cache ambiguo quando hashes retornam mais de um registro compativel', async () => {
    supabaseInMock.mockResolvedValueOnce({
      data: [
        { ...rowBase, chave_endereco: montarHashEnderecoComNumero(formBase), lat: -25.1 },
        { ...rowBase, chave_endereco: montarHashEnderecoLegado(formBase), lat: -25.2 },
      ],
      error: null,
    })

    const resultado = await buscarEnderecosNoGeoCacheEmLote([{ chave: 'agenda-1', form: formBase }])

    expect(resultado.resultadosPorChave['agenda-1']).toMatchObject({
      status: 'miss',
      motivo: 'cache_ambiguo',
      candidatosAvaliados: 2,
    })
  })

  it('preserva confidence baixa e coordenada invalida como miss no lote', async () => {
    supabaseInMock.mockResolvedValueOnce({
      data: [{ ...rowBase, chave_endereco: montarHashEnderecoComNumero(formBase), confidence: 0.1 }],
      error: null,
    })
    const baixa = await buscarEnderecosNoGeoCacheEmLote([{ chave: 'baixa', form: formBase }])
    expect(baixa.resultadosPorChave.baixa).toMatchObject({
      status: 'miss',
      motivo: 'confidence_baixa',
      confidence: 0.1,
    })

    supabaseInMock.mockResolvedValueOnce({
      data: [{ ...rowBase, chave_endereco: montarHashEnderecoComNumero(formBase), lat: 'abc' }],
      error: null,
    })
    const invalida = await buscarEnderecosNoGeoCacheEmLote([{ chave: 'invalida', form: formBase }])
    expect(invalida.resultadosPorChave.invalida).toMatchObject({
      status: 'miss',
      motivo: 'coordenadas_invalidas',
    })
  })

  it('respeita chunks configurados sem baixar tabela inteira', async () => {
    const entradas = Array.from({ length: 3 }, (_, index) => ({
      chave: `agenda-${index}`,
      form: {
        ...formBase,
        numero: String(5000 + index),
      },
    }))

    await buscarEnderecosNoGeoCacheEmLote(entradas, { chunkSize: 2 })

    expect(GEO_CACHE_BATCH_HASH_CHUNK_SIZE).toBe(100)
    expect(supabaseInMock).toHaveBeenCalledTimes(2)
    expect(supabaseInMock.mock.calls.every(([, hashes]) => hashes.length <= 2)).toBe(true)
  })
})
