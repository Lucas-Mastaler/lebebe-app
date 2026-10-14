import { createHash } from 'node:crypto'
import { lerMultipartAnexo } from './anexos-arquivo'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  executarAnexoDecorisi,
  RepositorioAnexosDecorisi,
  type DependenciasAnexosDecorisi,
} from './decorisi-anexos'
import type { ContextoPedidosPersonalizados } from './contexto'
vi.mock('./contexto', () => ({
  carregarContextoPedidosPersonalizados: vi.fn(),
}))
const usuario = '10000000-0000-4000-8000-000000000001',
  pedido = '20000000-0000-4000-8000-000000000001',
  item = '30000000-0000-4000-8000-000000000001',
  anexo = '40000000-0000-4000-8000-000000000001'
const repo = { disponivel: vi.fn(), pedido: vi.fn() }
const anexos = { executar: vi.fn(), anexo: vi.fn(), conferirArquivo: vi.fn() }
const storage = { upload: vi.fn(), remover: vi.fn(), urlAssinada: vi.fn() }
let ctx: ContextoPedidosPersonalizados, deps: DependenciasAnexosDecorisi
function upload(
  slot = 5,
  tipo = 'application/pdf',
  bytes = '%PDF-1',
  key: string | null = anexo,
) {
  const form = new FormData()
  form.set('arquivo', new File([bytes], 'arte.pdf', { type: tipo }))
  form.set('slot', String(slot))
  form.set('expectedVersion', '1')
  return new Request('https://app.test/anexos', {
    method: 'POST',
    headers: key ? { 'Idempotency-Key': key } : {},
    body: form,
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  ctx = {
    supabase: {} as never,
    allowedUser: {
      id: usuario,
      email: 'tecnico@example.test',
      role: 'user',
      ativo: true,
    },
    moduloAutorizado: 'pedidos_personalizados_novo',
    unidades: [
      {
        id: 'unidade',
        chave: 'bigorrilho',
        nome: 'Teste',
        nomeExibicao: 'Teste',
      },
    ],
  }
  deps = {
    habilitado: () => true,
    contexto: vi.fn(async () => ({ ok: true as const, contexto: ctx })),
    pedido: () => repo as never,
    anexos: () => anexos as never,
    storage: () => storage as never,
  }
  repo.disponivel.mockResolvedValue({ data: { id: 'decorisi' }, error: null })
  repo.pedido.mockResolvedValue({
    data: {
      id: pedido,
      version: 1,
      status: 'RASCUNHO',
      created_by: usuario,
      itens: [{ id: item }],
    },
    error: null,
  })
  anexos.executar.mockResolvedValue({
    data: { version: 2, reutilizado: false },
    error: null,
  })
  storage.upload.mockResolvedValue({ ok: true })
  anexos.conferirArquivo.mockResolvedValue(false)
})
describe('anexos Decorisi: autorização e falhas parciais', () => {
  it.each(['VENDA FECHADA', 'AGUARDANDO LAYOUT', 'AGUARDANDO APROVAÇÃO DO CLIENTE', 'EM PRODUÇÃO', 'RECEBIDO'])(
    'permite adicionar anexo em %s sem reabrir composição', async (status) => {
      repo.pedido.mockResolvedValue({ data: { id: pedido, version: 1, status, created_by: usuario, itens: [{ id: item }] }, error: null })
      expect((await executarAnexoDecorisi(upload(), pedido, item, undefined, deps)).status).toBe(200)
    },
  )
  it.each(['EM PRODUÇÃO', 'RECEBIDO', 'CANCELADO'])(
    'recusa substituição em %s', async (status) => {
      repo.pedido.mockResolvedValue({ data: { id: pedido, version: 1, status, created_by: usuario, itens: [{ id: item }] }, error: null })
      const req = upload(); const put = new Request(req.url, { method: 'PUT', headers: req.headers, body: await req.arrayBuffer() })
      expect((await executarAnexoDecorisi(put, pedido, item, anexo, deps)).status).toBe(409)
      expect(anexos.executar).not.toHaveBeenCalled()
    },
  )
  it('parser compartilhado conserva limite Moriah de dois slots', async () => {
    await expect(lerMultipartAnexo(upload(3), true)).rejects.toThrow(
      'SLOT_INVALIDO',
    )
    expect((await lerMultipartAnexo(upload(5), true, 5)).slot).toBe(5)
  })
  it('replay de Storage confere bytes pelo SHA-256 real', async () => {
    const download = vi
      .fn()
      .mockResolvedValue({ data: new Blob(['%PDF-1']), error: null })
    const from = vi.fn(() => ({ download }))
    const r = new RepositorioAnexosDecorisi({ storage: { from } } as never)
    const sha = createHash('sha256').update('%PDF-1').digest('hex')
    expect(await r.conferirArquivo('privado', sha)).toBe(true)
    expect(await r.conferirArquivo('privado', 'a'.repeat(64))).toBe(false)
    download.mockResolvedValue({
      data: null,
      error: { message: 'indisponível' },
    })
    expect(await r.conferirArquivo('privado', sha)).toBe(false)
    expect(from).toHaveBeenCalledWith('pedidos-personalizados-anexos')
  })

  it('gate não consulta contexto nem grava arquivos', async () => {
    deps.habilitado = () => false
    expect(
      (await executarAnexoDecorisi(upload(), pedido, item, undefined, deps))
        .status,
    ).toBe(404)
    expect(deps.contexto).not.toHaveBeenCalled()
  })
  it.each([401, 403])('preserva bloqueio %s', async (status) => {
    deps.contexto = vi.fn(async () => ({
      ok: false as const,
      response: new Response(null, { status }),
    }))
    expect(
      (await executarAnexoDecorisi(upload(), pedido, item, undefined, deps))
        .status,
    ).toBe(status)
    expect(storage.upload).not.toHaveBeenCalled()
  })
  it.each(['fornecedor', 'criador', 'unidade', 'item'])(
    'nega escopo %s antes do Storage',
    async (caso) => {
      if (caso === 'fornecedor')
        repo.disponivel.mockResolvedValue({ data: null, error: null })
      if (caso === 'criador')
        repo.pedido.mockResolvedValue({
          data: { created_by: 'outro', itens: [{ id: item }] },
          error: null,
        })
      if (caso === 'unidade')
        repo.pedido.mockResolvedValue({ data: null, error: null })
      expect(
        (
          await executarAnexoDecorisi(
            upload(),
            pedido,
            caso === 'item' ? anexo : item,
            undefined,
            deps,
          )
        ).status,
      ).toBe(404)
      expect(storage.upload).not.toHaveBeenCalled()
    },
  )
  it.each([
    [6, 'application/pdf', '%PDF-1', anexo],
    [5, 'image/png', '%PDF-1', anexo],
    [5, 'application/pdf', 'texto', anexo],
    [5, 'application/pdf', '%PDF-1', null],
  ] as const)(
    'rejeita arquivo/slot/chave inválidos',
    async (slot, mime, bytes, key) => {
      expect(
        (
          await executarAnexoDecorisi(
            upload(slot, mime, bytes, key),
            pedido,
            item,
            undefined,
            deps,
          )
        ).status,
      ).toBeGreaterThanOrEqual(400)
      expect(storage.upload).not.toHaveBeenCalled()
      expect(anexos.executar).not.toHaveBeenCalled()
    },
  )
  it('prepara antes de upload e registra hash, path e associação específica', async () => {
    expect(
      (await executarAnexoDecorisi(upload(), pedido, item, undefined, deps))
        .status,
    ).toBe(200)
    expect(anexos.executar.mock.calls.map((c) => c[0])).toEqual([
      'preparar',
      'registrar',
    ])
    const dados = anexos.executar.mock.calls[0][5]
    expect(dados).toMatchObject({
      id: anexo,
      slot: 5,
      caminho_objeto: `${pedido}/${item}/${anexo}/${anexo}.pdf`,
      substituir: false,
    })
    expect(dados.arquivo_sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(anexos.executar.mock.invocationCallOrder[0]).toBeLessThan(
      storage.upload.mock.invocationCallOrder[0],
    )
    expect(storage.upload.mock.invocationCallOrder[0]).toBeLessThan(
      anexos.executar.mock.invocationCallOrder[1],
    )
  })
  it('replay já confirmado evita upload duplicado', async () => {
    anexos.executar.mockResolvedValue({
      data: { version: 2, reutilizado: true },
      error: null,
    })
    expect(
      (await executarAnexoDecorisi(upload(), pedido, item, undefined, deps))
        .status,
    ).toBe(200)
    expect(storage.upload).not.toHaveBeenCalled()
  })
  it('falha da reserva impede upload', async () => {
    anexos.executar.mockResolvedValue({
      data: null,
      error: { code: 'P0003', message: 'CONFLITO_VERSAO' },
    })
    expect(
      (await executarAnexoDecorisi(upload(), pedido, item, undefined, deps))
        .status,
    ).toBe(409)
    expect(storage.upload).not.toHaveBeenCalled()
  })
  it('falha parcial mantém compensação durável e não registra metadados', async () => {
    storage.upload.mockResolvedValue({
      ok: false,
      error: new Error('timeout'),
    })
    expect(
      (await executarAnexoDecorisi(upload(), pedido, item, undefined, deps))
        .status,
    ).toBe(503)
    expect(anexos.executar).toHaveBeenCalledTimes(1)
    expect(storage.remover).not.toHaveBeenCalled()
  })
  it('objeto de tentativa anterior é conferido pelo hash sem upsert', async () => {
    storage.upload.mockResolvedValue({
      ok: false,
      error: new Error('duplicate'),
    })
    anexos.conferirArquivo.mockResolvedValue(true)
    expect(
      (await executarAnexoDecorisi(upload(), pedido, item, undefined, deps))
        .status,
    ).toBe(200)
    expect(anexos.executar).toHaveBeenCalledTimes(2)
  })
  it('resposta perdida de registro nunca apaga objeto potencialmente confirmado', async () => {
    anexos.executar
      .mockResolvedValueOnce({ data: { reutilizado: false }, error: null })
      .mockRejectedValueOnce(new Error('resposta perdida'))
    expect(
      (await executarAnexoDecorisi(upload(), pedido, item, undefined, deps))
        .status,
    ).toBe(503)
    expect(storage.remover).not.toHaveBeenCalled()
  })
  it('substituição conserva ID do anexo', async () => {
    const id = crypto.randomUUID()
    expect(
      (await executarAnexoDecorisi(upload(), pedido, item, id, deps)).status,
    ).toBe(200)
    expect(anexos.executar.mock.calls[0][5]).toMatchObject({
      id,
      substituir: true,
    })
  })
  it('abertura gera URL somente após autorização e não permite cache', async () => {
    anexos.anexo.mockResolvedValue({ data: { path: 'privado' }, error: null })
    storage.urlAssinada.mockResolvedValue({
      ok: true,
      url: 'https://storage.invalid/signed',
    })
    const r = await executarAnexoDecorisi(
      new Request('https://app.test/anexo'),
      pedido,
      item,
      anexo,
      deps,
    )
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(storage.urlAssinada).toHaveBeenCalledWith('privado')
  })
  it('remoção usa versão e RPC da fila, sem apagar diretamente no Storage', async () => {
    const r = await executarAnexoDecorisi(
      new Request('https://app.test/anexo', {
        method: 'DELETE',
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
      pedido,
      item,
      anexo,
      deps,
    )
    expect(r.status).toBe(200)
    expect(anexos.executar).toHaveBeenCalledWith(
      'remover',
      pedido,
      item,
      usuario,
      1,
      anexo,
    )
    expect(storage.remover).not.toHaveBeenCalled()
  })
})
