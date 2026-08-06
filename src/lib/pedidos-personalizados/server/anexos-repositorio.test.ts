import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKET_ANEXOS_PEDIDOS } from './anexos-arquivo'
import { RepositorioAnexos, StorageAnexos } from './anexos-repositorio'

const AGORA = '2026-08-05T10:00:00.000Z'
const CAMINHO = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.pdf'

function linha(overrides: Record<string, unknown> = {}) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    bucket_id: BUCKET_ANEXOS_PEDIDOS,
    caminho_objeto: CAMINHO,
    motivo: 'REMOCAO_ANEXO',
    tentativas: 0,
    proxima_tentativa_em: AGORA,
    ultimo_erro: null,
    processado_em: null,
    created_at: AGORA,
    updated_at: AGORA,
    ...overrides,
  }
}

function builder(resultado: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn((valor: unknown) => {
      void valor
      return Promise.resolve(resultado)
    }),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(resultado)),
    maybeSingle: vi.fn(() => Promise.resolve(resultado)),
    then: (resolve: (valor: unknown) => unknown, reject: (erro?: unknown) => unknown) =>
      Promise.resolve(resultado).then(resolve, reject),
  }
  return chain
}

describe('repositório da fila de Storage', () => {
  it('insere compensação com bucket_id e sem a propriedade antiga bucket', async () => {
    const query = builder({ data: null, error: null })
    const repo = new RepositorioAnexos({ from: vi.fn(() => query) } as unknown as SupabaseClient)
    expect((await repo.enfileirarFalhaAposUpload(CAMINHO)).error).toBeNull()
    expect(query.insert).toHaveBeenCalledWith({
      bucket_id: BUCKET_ANEXOS_PEDIDOS,
      caminho_objeto: CAMINHO,
      motivo: 'FALHA_APOS_UPLOAD',
    })
    expect(query.insert.mock.calls[0][0]).not.toHaveProperty('bucket')
  })

  it('filtra a conclusão oportunística pela coluna bucket_id', async () => {
    const query = builder({ data: null, error: null })
    const repo = new RepositorioAnexos({ from: vi.fn(() => query) } as unknown as SupabaseClient)
    await repo.marcarProcessadoPorCaminho(CAMINHO, AGORA)
    expect(query.eq).toHaveBeenCalledWith('bucket_id', BUCKET_ANEXOS_PEDIDOS)
    expect(query.eq).not.toHaveBeenCalledWith('bucket', expect.anything())
  })

  it('mapeia bucket_id e os demais campos SQL explicitamente para camelCase', async () => {
    const query = builder({ data: [linha()], error: null })
    const repo = new RepositorioAnexos({ from: vi.fn(() => query) } as unknown as SupabaseClient)
    const resultado = await repo.carregarPendencias(AGORA, 20)
    expect(resultado.error).toBeNull()
    expect(resultado.data?.[0]).toEqual({
      id: '55555555-5555-4555-8555-555555555555',
      bucketId: BUCKET_ANEXOS_PEDIDOS,
      caminhoObjeto: CAMINHO,
      motivo: 'REMOCAO_ANEXO',
      tentativas: 0,
      proximaTentativaEm: AGORA,
      ultimoErro: null,
      processadoEm: null,
      createdAt: AGORA,
      updatedAt: AGORA,
    })
    expect(resultado.data?.[0]).not.toHaveProperty('bucket')
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('bucket_id'))
    expect(query.is).toHaveBeenCalledWith('processado_em', null)
    expect(query.lte).toHaveBeenCalledWith('proxima_tentativa_em', AGORA)
    expect(query.limit).toHaveBeenCalledWith(20)
  })

  it('rejeita retorno sem bucket_id sem produzir uma pendência processável', async () => {
    const invalida: Record<string, unknown> = linha()
    delete invalida.bucket_id
    const repo = new RepositorioAnexos({
      from: vi.fn(() => builder({ data: [invalida], error: null })),
    } as unknown as SupabaseClient)
    const resultado = await repo.carregarPendencias(AGORA)
    expect(resultado.data).toBeNull()
    expect(resultado.error?.message).toBe('PENDENCIA_STORAGE_INVALIDA')
  })
})

describe('remoção física pelo bucket da pendência', () => {
  it('usa o bucket privado validado e recusa qualquer outro antes do SDK', async () => {
    const remove = vi.fn().mockResolvedValue({ data: [{ name: CAMINHO }], error: null })
    const from = vi.fn(() => ({ remove }))
    const storage = new StorageAnexos({ storage: { from } } as unknown as SupabaseClient)

    expect((await storage.remover(CAMINHO, BUCKET_ANEXOS_PEDIDOS)).ok).toBe(true)
    expect(from).toHaveBeenCalledWith(BUCKET_ANEXOS_PEDIDOS)
    expect(remove).toHaveBeenCalledWith([CAMINHO])

    expect((await storage.remover(CAMINHO, 'logo')).ok).toBe(false)
    expect(from).toHaveBeenCalledTimes(1)
  })
})
