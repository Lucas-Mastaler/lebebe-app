import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RepositorioAnexos, StorageAnexos } from './anexos-repositorio'
import { atrasoRetentativaMs, limparPendenciasStorage, type DependenciasFila, type PendenciaStorage } from './storage-fila'

const AGORA = '2026-08-05T10:00:00.000Z'

function item(indice = 1, overrides: Partial<PendenciaStorage> = {}): PendenciaStorage {
  return {
    id: `10000000-0000-4000-8000-${String(indice).padStart(12, '0')}`,
    bucketId: 'pedidos-personalizados-anexos',
    caminhoObjeto: `privado-${indice}`,
    motivo: 'REMOCAO_ANEXO',
    tentativas: 0,
    proximaTentativaEm: AGORA,
    ultimoErro: null,
    processadoEm: null,
    createdAt: AGORA,
    updatedAt: AGORA,
    ...overrides,
  }
}

function repo(itens: PendenciaStorage[] = [], overrides: Record<string, unknown> = {}) {
  return {
    carregarPendencias: vi.fn().mockResolvedValue({ data: itens, error: null }),
    reivindicar: vi.fn().mockResolvedValue({ data: true, error: null }),
    concluir: vi.fn().mockResolvedValue({ error: null }),
    falhar: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  }
}

function storage(overrides: Record<string, unknown> = {}) {
  return { remover: vi.fn().mockResolvedValue({ ok: true, inexistente: false }), ...overrides }
}

function deps(r = repo(), s = storage(), segredo = 'segredo-teste'): DependenciasFila {
  return {
    segredo: () => segredo,
    criarRepositorio: () => r as unknown as RepositorioAnexos,
    criarStorage: () => s as unknown as StorageAnexos,
    agora: () => new Date(AGORA),
  }
}

function request(segredo = 'segredo-teste') {
  return new Request('http://localhost/api/pedidos-personalizados/storage/limpar-pendencias', { method: 'POST', headers: { authorization: `Bearer ${segredo}` } })
}

beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => undefined))

describe('consumidor protegido da fila de Storage', () => {
  it('rejeita segredo ausente e inválido', async () => {
    expect((await limparPendenciasStorage(request(), deps(repo(), storage(), ''))).status).toBe(500)
    expect((await limparPendenciasStorage(request('errado'), deps())).status).toBe(403)
  })

  it('processa lote vazio', async () => {
    const response = await limparPendenciasStorage(request(), deps())
    expect(await response.json()).toMatchObject({ selecionadas: 0, processadas: 0, concluidas: 0, falhas: 0, limite: 20 })
  })

  it('limita a consulta e processa lote de 20', async () => {
    const r = repo(Array.from({ length: 20 }, (_, indice) => item(indice + 1)))
    const response = await limparPendenciasStorage(request(), deps(r))
    expect(await response.json()).toMatchObject({ selecionadas: 20, processadas: 20, concluidas: 20 })
    expect(r.carregarPendencias).toHaveBeenCalledWith(AGORA, 20)
  })

  it('trata objeto inexistente como limpeza concluída', async () => {
    const r = repo([item()])
    const s = storage({ remover: vi.fn().mockResolvedValue({ ok: true, inexistente: true }) })
    const response = await limparPendenciasStorage(request(), deps(r, s))
    expect(await response.json()).toMatchObject({ concluidas: 1, falhas: 0 })
    expect(r.concluir).toHaveBeenCalledOnce()
  })

  it('usa o bucketId e o caminhoObjeto mapeados da linha SQL', async () => {
    const pendencia = item()
    const s = storage()
    await limparPendenciasStorage(request(), deps(repo([pendencia]), s))
    expect(s.remover).toHaveBeenCalledWith(
      pendencia.caminhoObjeto,
      'pedidos-personalizados-anexos'
    )
  })

  it('não toca no Storage quando o bucket é inesperado e mantém a pendência aberta', async () => {
    const r = repo([item(1, { bucketId: 'logo' })])
    const s = storage()
    const response = await limparPendenciasStorage(request(), deps(r, s))
    expect(await response.json()).toMatchObject({ processadas: 1, concluidas: 0, falhas: 1 })
    expect(s.remover).not.toHaveBeenCalled()
    expect(r.concluir).not.toHaveBeenCalled()
    expect(r.falhar).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      '2026-08-05T10:05:00.000Z',
      'BUCKET_INESPERADO'
    )
  })

  it('incrementa tentativas, sanitiza o erro e agenda backoff', async () => {
    const r = repo([item(1, { tentativas: 1 })])
    const s = storage({ remover: vi.fn().mockResolvedValue({ ok: false, error: new Error('privado/token') }) })
    const response = await limparPendenciasStorage(request(), deps(r, s))
    expect(await response.json()).toMatchObject({ concluidas: 0, falhas: 1 })
    expect(r.falhar).toHaveBeenCalledWith(expect.anything(), expect.any(String), '2026-08-05T10:15:00.000Z', 'FALHA_STORAGE_TEMPORARIA')
    expect(JSON.stringify(vi.mocked(r.falhar).mock.calls)).not.toContain('token')
  })

  it('sinaliza atenção e limita backoff após dez falhas', async () => {
    const r = repo([item(1, { tentativas: 9 })])
    const s = storage({ remover: vi.fn().mockResolvedValue({ ok: false, error: new Error('falha') }) })
    await limparPendenciasStorage(request(), deps(r, s))
    expect(r.falhar).toHaveBeenCalledWith(expect.anything(), expect.any(String), '2026-08-06T10:00:00.000Z', 'ATENCAO_FALHA_STORAGE')
  })

  it('não remove item perdido para outra execução concorrente', async () => {
    const r = repo([item()], { reivindicar: vi.fn().mockResolvedValue({ data: false, error: null }) })
    const s = storage()
    const response = await limparPendenciasStorage(request(), deps(r, s))
    expect(await response.json()).toMatchObject({ selecionadas: 1, processadas: 0 })
    expect(s.remover).not.toHaveBeenCalled()
  })

  it('duas execuções concorrentes removem somente uma vez após um único claim', async () => {
    const r = repo([item()], {
      reivindicar: vi.fn()
        .mockResolvedValueOnce({ data: true, error: null })
        .mockResolvedValueOnce({ data: false, error: null }),
    })
    const s = storage()
    const respostas = await Promise.all([
      limparPendenciasStorage(request(), deps(r, s)),
      limparPendenciasStorage(request(), deps(r, s)),
    ])
    expect(s.remover).toHaveBeenCalledOnce()
    expect(r.concluir).toHaveBeenCalledOnce()
    expect(await Promise.all(respostas.map((response) => response.json())))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ processadas: 1, concluidas: 1 }),
        expect.objectContaining({ processadas: 0, concluidas: 0 }),
      ]))
  })

  it('não registra bucket nem caminho privado nos logs', async () => {
    const pendencia = item()
    await limparPendenciasStorage(request(), deps(repo([pendencia])))
    const logs = JSON.stringify(vi.mocked(console.info).mock.calls)
    expect(logs).not.toContain(pendencia.bucketId)
    expect(logs).not.toContain(pendencia.caminhoObjeto)
  })

  it('define atrasos previsíveis e limitados', () => {
    expect([1, 2, 3, 4, 10].map(atrasoRetentativaMs)).toEqual([300_000, 900_000, 3_600_000, 21_600_000, 86_400_000])
  })
})
