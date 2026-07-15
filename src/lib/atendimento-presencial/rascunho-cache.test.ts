import { describe, expect, it } from 'vitest'
import {
  carregarCacheRascunho,
  criarChaveCacheRascunho,
  removerCacheRascunho,
  salvarCacheRascunho,
  type StorageLike,
} from './rascunho-cache'

function criarStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  }
}

describe('cache local de rascunho', () => {
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
      dadosRascunho: { notaTecnica: 'texto' },
      atualizadoEm: '2026-07-15T12:00:00.000Z',
      sincronizado: false,
    })

    expect(carregarCacheRascunho(storage, 'usuario-1', 'draft-1')).toMatchObject({
      atendimentoId: 'atendimento-1',
      version: 2,
      dadosRascunho: { notaTecnica: 'texto' },
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
