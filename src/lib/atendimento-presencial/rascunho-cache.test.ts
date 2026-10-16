import { describe, expect, it } from 'vitest'
import { serializarPayloadAutosave } from './autosave-fila'
import {
  carregarCacheRascunho,
  listarCachesRascunho,
  planejarRecuperacaoRascunho,
  temEntradasLocaisPendentes,
  temDadosIntermediariosRascunho,
  type RascunhoCache,
  criarChaveCacheRascunho,
  removerCacheRascunho,
  salvarCacheRascunho,
  type StorageLike,
} from './rascunho-cache'

function criarStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    get length() { return data.size },
    key: (index) => Array.from(data.keys())[index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  }
}

describe('cache local de rascunho', () => {
  it('retomada apos PATCH concluido ao sair nao cria conflito se o conteudo ja esta no servidor', () => {
    const dados = { criancas: [{ id: 'crianca-teste', situacao: 'gestacao' as const, nome: 'Maria' }], departamentos: [], produtosInteresse: [], motivosResultado: [], etapaAtual: 'ficha' as const }
    const dadosServidor = { ...dados, criancas: [{ ...dados.criancas[0], nome: 'MARIA' }] }
    const cache: RascunhoCache = { usuarioId: 'usuario', draftClientId: 'draft', atendimentoId: 'atendimento', version: 1, clienteId: null, dadosRascunho: dados, atualizadoEm: '2026-10-15', sincronizado: false }
    expect(planejarRecuperacaoRascunho(cache, { id: 'atendimento', version: 2, clienteId: null, dadosRascunho: dadosServidor }).conflito).toBe(false)
    expect(planejarRecuperacaoRascunho(cache, { id: 'atendimento', version: 2, clienteId: null, dadosRascunho: { ...dados, criancas: [] } }).conflito).toBe(true)
    cache.basesRecuperacao = [serializarPayloadAutosave({ dadosRascunho: { ...dados, criancas: [] }, clienteId: null })]
    expect(planejarRecuperacaoRascunho(cache, { id: 'atendimento', version: 2, clienteId: null, dadosRascunho: { ...dados, criancas: [] } }).conflito).toBe(false)
    expect(planejarRecuperacaoRascunho(cache, { id: 'atendimento', version: 2, clienteId: null, dadosRascunho: { ...dados, observacoes: 'Outra aba' } }).conflito).toBe(true)
  })
  it('cria chave por usuario e draft', () => {
    expect(criarChaveCacheRascunho('usuario-1', 'draft-1')).toBe('atendimento-presencial:rascunho:usuario-1:draft-1')
  })

  it('salva, carrega e remove cache', () => {
    const storage = criarStorage()
    salvarCacheRascunho(storage, {
      usuarioId: 'usuario-1',
      draftClientId: 'draft-1',
      atendimentoId: 'atendimento-1',
      version: 2,
      dadosRascunho: {
        criancas: [],
        departamentos: [],
        produtosInteresse: [],
        motivosResultado: [],
        etapaAtual: 'ficha',
        notaTecnica: 'texto',
      },
      atualizadoEm: '2026-07-15T12:00:00.000Z',
      sincronizado: false,
    })

    expect(carregarCacheRascunho(storage, 'usuario-1', 'draft-1')).toMatchObject({
      atendimentoId: 'atendimento-1',
      version: 2,
      dadosRascunho: {
        criancas: [],
        departamentos: [],
        produtosInteresse: [],
        motivosResultado: [],
        etapaAtual: 'ficha',
      },
      sincronizado: false,
    })

    removerCacheRascunho(storage, 'usuario-1', 'draft-1')
    expect(carregarCacheRascunho(storage, 'usuario-1', 'draft-1')).toBeNull()
  })

  it('nao mistura cache entre usuarios', () => {
    const storage = criarStorage()
    storage.setItem(
      criarChaveCacheRascunho('usuario-1', 'draft-1'),
      JSON.stringify({ usuarioId: 'usuario-2', draftClientId: 'draft-1' })
    )

    expect(carregarCacheRascunho(storage, 'usuario-1', 'draft-1')).toBeNull()
  })
})


const dados = { criancas: [{ id: 'crianca-teste', situacao: 'gestacao' as const, nome: 'Teste' }], departamentos: [], produtosInteresse: [], motivosResultado: [], etapaAtual: 'ficha' as const }
const cacheBase: RascunhoCache = { usuarioId: 'usuario-1', draftClientId: 'draft-1', atendimentoId: 'atendimento-1', version: 2, clienteId: 'cliente-nova', dadosRascunho: dados, atualizadoEm: '2026-10-13T12:00:00Z', sincronizado: false }
const servidor = { id: 'atendimento-1', version: 2, clienteId: 'cliente-anterior' }

describe('recuperacao integral e concorrencia local', () => {
  it('troca de cliente antes do debounce sobrevive a recarga', () => {
    const storage = criarStorage()
    salvarCacheRascunho(storage, cacheBase)
    const recuperado = carregarCacheRascunho(storage, 'usuario-1', 'draft-1')
      expect(recuperado?.dadosRascunho.criancas[0].nome).toBe('Teste')
    expect(planejarRecuperacaoRascunho(recuperado, servidor)).toEqual({ usarCache: true, conflito: false, clienteId: 'cliente-nova' })
  })

  it('cliente nao carregada nao significa remocao e cache legado preserva vinculo', () => {
    expect(planejarRecuperacaoRascunho(null, servidor).clienteId).toBe('cliente-anterior')
    expect(planejarRecuperacaoRascunho({ ...cacheBase, clienteId: undefined }, servidor).clienteId).toBe('cliente-anterior')
    expect(planejarRecuperacaoRascunho({ ...cacheBase, clienteId: null }, servidor).clienteId).toBeNull()
  })

  it('cache antigo exige escolha em vez de sobrescrever servidor mais novo', () => {
    expect(planejarRecuperacaoRascunho(cacheBase, { ...servidor, version: 3 })).toMatchObject({ conflito: true })
    expect(planejarRecuperacaoRascunho({ ...cacheBase, sincronizado: true }, { ...servidor, version: 3 })).toMatchObject({ usarCache: false, conflito: false })
  })

  it('isola abas e confirmacao de uma nao apaga pendencias da outra', () => {
    const storage = criarStorage()
    salvarCacheRascunho(storage, { ...cacheBase, editorId: 'aba-1' })
    salvarCacheRascunho(storage, { ...cacheBase, editorId: 'aba-2', sincronizado: true, clienteId: 'cliente-anterior', atualizadoEm: '2026-10-13T13:00:00Z' })
    expect(listarCachesRascunho(storage, 'usuario-1', 'draft-1')).toHaveLength(2)
    expect(carregarCacheRascunho(storage, 'usuario-1', 'draft-1')?.clienteId).toBe('cliente-nova')
    expect(carregarCacheRascunho(storage, 'usuario-1', 'draft-1', 'aba-2')?.clienteId).toBe('cliente-anterior')
  })

  it('isola usuarios e atendimentos e rejeita identidade adulterada', () => {
    const storage = criarStorage()
    salvarCacheRascunho(storage, cacheBase)
    expect(carregarCacheRascunho(storage, 'usuario-2', 'draft-1')).toBeNull()
    expect(carregarCacheRascunho(storage, 'usuario-1', 'draft-2')).toBeNull()
    expect(planejarRecuperacaoRascunho(cacheBase, { ...servidor, id: 'atendimento-2' })).toMatchObject({ usarCache: false })
  })

  it('mantem entradas incompletas locais sem criar dados definitivos', () => {
    const storage = criarStorage()
    const entradasLocais = { novoCliente: { nome: 'Teste', telefone: '', parentesco: '' as const, parentescoOutro: '' }, dataPrevistaInputs: { 'crianca-teste': '13/10' }, viradaCartaoInput: '13/', produtoDigitado: 'Produto', numeroLancamento: '123', telefonePendente: { clienteId: 'cliente-nova', valor: '41999999999' } }
    salvarCacheRascunho(storage, { ...cacheBase, entradasLocais })
    expect(carregarCacheRascunho(storage, 'usuario-1', 'draft-1')?.entradasLocais).toEqual(entradasLocais)
    expect(temEntradasLocaisPendentes(entradasLocais)).toBe(true)
  })

  it('falha de storage retorna resultado explicito sem apagar estado', () => {
    const storage = criarStorage()
    storage.setItem = () => { throw new Error('quota') }
    expect(salvarCacheRascunho(storage, cacheBase)).toBe(false)
  })
})


it('preserva unidade de idade ainda sem valor como entrada intermediaria', () => {
  const storage = criarStorage()
  const incompleto = { ...dados, criancas: [{ id: 'crianca-teste', situacao: 'ja_nasceu' as const, idadeUnidade: 'anos' as const }] }
  expect(temDadosIntermediariosRascunho(incompleto)).toBe(true)
  salvarCacheRascunho(storage, { ...cacheBase, dadosRascunho: incompleto })
  expect(carregarCacheRascunho(storage, 'usuario-1', 'draft-1')?.dadosRascunho.criancas[0].idadeUnidade).toBe('anos')
})

it('copia resolvida e arquivada nao provoca novo conflito automatico', () => {
  const storage = criarStorage()
  salvarCacheRascunho(storage, { ...cacheBase, editorId: 'aba-antiga', arquivado: true })
  salvarCacheRascunho(storage, { ...cacheBase, editorId: 'aba-atual', version: 3, sincronizado: true })
  expect(carregarCacheRascunho(storage, 'usuario-1', 'draft-1')?.version).toBe(3)
  expect(listarCachesRascunho(storage, 'usuario-1', 'draft-1')).toHaveLength(2)
})
