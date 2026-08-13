import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextoPedidosPersonalizados } from './contexto'
import type { RepositorioAnexos, StorageAnexos } from './anexos-repositorio'
import { abrirAnexo, removerAnexo, substituirAnexo, uploadAnexo, type DependenciasApiAnexos } from './anexos-handlers'

const USUARIO = '10000000-0000-4000-8000-000000000001'
const OUTRO_USUARIO = '10000000-0000-4000-8000-000000000002'
const PEDIDO = '20000000-0000-4000-8000-000000000001'
const TAPETE = '30000000-0000-4000-8000-000000000001'
const ANEXO = '40000000-0000-4000-8000-000000000001'
const UNIDADE = '50000000-0000-4000-8000-000000000001'
const ARQUIVO = '60000000-0000-4000-8000-000000000001'

function contexto(moduloAutorizado: ContextoPedidosPersonalizados['moduloAutorizado'] = 'pedidos_personalizados_gestao'): ContextoPedidosPersonalizados {
  return {
    supabase: {} as never,
    allowedUser: { id: USUARIO, email: 'tecnico@example.com', role: 'user', ativo: true },
    moduloAutorizado,
    unidades: [{ id: UNIDADE, chave: 'bigorrilho', nome: 'BIGORRILHO', nomeExibicao: 'BIGORRILHO' }],
  }
}

function escopo(comAnexo = false, pedidoOverrides: Record<string, unknown> = {}) {
  return {
    pedido: {
      id: PEDIDO,
      version: 1,
      status: 'RASCUNHO',
      created_by: USUARIO,
      fornecedor: { chave: 'moriah_tapetes' },
      ...pedidoOverrides,
    },
    tapete: { id: TAPETE, pedido_id: PEDIDO },
    ...(comAnexo ? { anexo: { id: ANEXO, tapete_id: TAPETE, slot: 1, caminho_objeto: `${PEDIDO}/${TAPETE}/${ANEXO}/${ARQUIVO}.pdf`, nome_original: 'arquivo.pdf', mime_type: 'application/pdf', tamanho_bytes: 6, created_at: '2026-08-05T10:00:00Z' } } : {}),
  }
}

function repo(overrides: Record<string, unknown> = {}) {
  return {
    buscarTapeteNoEscopo: vi.fn().mockResolvedValue({ data: escopo(), error: null }),
    buscarAnexoNoEscopo: vi.fn().mockResolvedValue({ data: escopo(true), error: null }),
    listarAnexosTapete: vi.fn().mockResolvedValue({ data: [], error: null }),
    registrar: vi.fn().mockResolvedValue({ data: { anexo_id: ANEXO, version: 2 }, error: null }),
    substituir: vi.fn().mockResolvedValue({ data: { anexo_id: ANEXO, caminho_antigo: 'privado', version: 2 }, error: null }),
    remover: vi.fn().mockResolvedValue({ data: { caminho_enfileirado: 'privado', version: 2 }, error: null }),
    enfileirarFalhaAposUpload: vi.fn().mockResolvedValue({ data: true, error: null }),
    marcarProcessadoPorCaminho: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  }
}

function storage(overrides: Record<string, unknown> = {}) {
  return {
    upload: vi.fn().mockResolvedValue({ ok: true }),
    remover: vi.fn().mockResolvedValue({ ok: true, inexistente: false }),
    urlAssinada: vi.fn().mockResolvedValue({ ok: true, url: 'https://storage.invalid/signed' }),
    ...overrides,
  }
}

function deps(
  r = repo(),
  s = storage(),
  contextoAtual = contexto()
): DependenciasApiAnexos {
  return {
    carregarContexto: vi.fn().mockResolvedValue({ ok: true, contexto: contextoAtual }),
    criarRepositorio: vi.fn(() => r as unknown as RepositorioAnexos),
    criarStorage: vi.fn(() => s as unknown as StorageAnexos),
    uuid: vi.fn().mockReturnValueOnce(ANEXO).mockReturnValue(ARQUIVO),
    agora: () => new Date('2026-08-05T10:00:00Z'),
  }
}

function multipart(slot: number | undefined = 1, expectedVersion = 1, mime = 'application/pdf') {
  const form = new FormData()
  form.set('expectedVersion', String(expectedVersion))
  if (slot !== undefined) form.set('slot', String(slot))
  form.set('arquivo', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'arquivo.pdf', { type: mime }))
  return new Request('http://localhost/anexos', { method: 'POST', body: form })
}

function requisicaoRemocao(expectedVersion = 1) {
  return new Request('http://localhost', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expectedVersion }),
  })
}

beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => undefined))

describe('upload de anexo', () => {
  it.each([401, 403])('propaga acesso %i sem tocar no Storage', async (status) => {
    const d = deps()
    vi.mocked(d.carregarContexto).mockResolvedValueOnce({ ok: false, response: new Response('{}', { status }) })
    expect((await uploadAnexo(multipart(), PEDIDO, TAPETE, d)).status).toBe(status)
    expect(d.criarStorage).not.toHaveBeenCalled()
  })

  it('separa o contexto inicial do contexto de gestão sem receber o booleano do navegador', async () => {
    const r = repo({
      buscarTapeteNoEscopo: vi.fn().mockResolvedValue({
        data: escopo(false, { created_by: OUTRO_USUARIO }),
        error: null,
      }),
    })
    const d = deps(r)
    expect((await uploadAnexo(multipart(), PEDIDO, TAPETE, d, 'gestao')).status).toBe(201)
    expect(d.carregarContexto).toHaveBeenCalledWith(['pedidos_personalizados_gestao'])
    expect(r.registrar).toHaveBeenCalledWith(expect.objectContaining({
      p_contabilizar_alteracao_layout: true,
    }))
  })

  it('autoriza novo no próprio pedido RASCUNHO', async () => {
    const r = repo()
    const s = storage()
    expect((await uploadAnexo(
      multipart(),
      PEDIDO,
      TAPETE,
      deps(r, s, contexto('pedidos_personalizados_novo'))
    )).status).toBe(201)
    expect(s.upload).toHaveBeenCalledOnce()
    expect(r.registrar).toHaveBeenCalledWith(expect.objectContaining({
      p_contabilizar_alteracao_layout: false,
    }))
  })

  it.each([
    ['AGUARDANDO LAYOUT', USUARIO],
    ['EM PRODUÇÃO', USUARIO],
    ['RECEBIDO', USUARIO],
    ['RASCUNHO', OUTRO_USUARIO],
  ])('nega novo antes de ler multipart ou enviar ao Storage: %s', async (status, createdBy) => {
    const r = repo({
      buscarTapeteNoEscopo: vi.fn().mockResolvedValue({
        data: escopo(false, { status, created_by: createdBy }),
        error: null,
      }),
    })
    const s = storage()
    const request = new Request('http://localhost/anexos', {
      method: 'POST',
      body: new FormData(),
    })
    const response = await uploadAnexo(
      request,
      PEDIDO,
      TAPETE,
      deps(r, s, contexto('pedidos_personalizados_novo'))
    )
    expect(response.status).toBe(404)
    expect(s.upload).not.toHaveBeenCalled()
    expect(r.registrar).not.toHaveBeenCalled()
  })

  it('oculta pedido ou tapete fora do escopo', async () => {
    const d = deps(repo({ buscarTapeteNoEscopo: vi.fn().mockResolvedValue({ data: null, error: null }) }))
    expect((await uploadAnexo(multipart(), PEDIDO, TAPETE, d)).status).toBe(404)
  })

  it('cria slots 1 e 2 e não expõe caminho', async () => {
    for (const slot of [1, 2]) {
      const response = await uploadAnexo(multipart(slot), PEDIDO, TAPETE, deps())
      const body = await response.json()
      expect(response.status).toBe(201)
      expect(body).toMatchObject({ anexoId: ANEXO, slot, version: 2 })
      expect(JSON.stringify(body)).not.toContain(PEDIDO)
    }
  })

  it('rejeita conflito antes do upload', async () => {
    const s = storage()
    const d = deps(repo({ buscarTapeteNoEscopo: vi.fn().mockResolvedValue({ data: { ...escopo(), pedido: { id: PEDIDO, version: 2 } }, error: null }) }), s)
    expect((await uploadAnexo(multipart(1, 1), PEDIDO, TAPETE, d)).status).toBe(409)
    expect(s.upload).not.toHaveBeenCalled()
  })

  it('rejeita terceiro anexo ou slot ocupado', async () => {
    const r = repo({ listarAnexosTapete: vi.fn().mockResolvedValue({ data: [{ id: ANEXO, slot: 1 }, { id: ARQUIVO, slot: 2 }], error: null }) })
    expect((await uploadAnexo(multipart(), PEDIDO, TAPETE, deps(r))).status).toBe(409)
  })

  it('remove o objeto novo quando a RPC falha', async () => {
    const r = repo({ registrar: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0003', message: 'CONFLITO_VERSAO' } }) })
    const s = storage()
    expect((await uploadAnexo(multipart(), PEDIDO, TAPETE, deps(r, s))).status).toBe(409)
    expect(s.remover).toHaveBeenCalledOnce()
  })

  it('enfileira FALHA_APOS_UPLOAD quando a compensação física falha', async () => {
    const r = repo({ registrar: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha' } }) })
    const s = storage({ remover: vi.fn().mockResolvedValue({ ok: false, error: new Error('falha') }) })
    await uploadAnexo(multipart(), PEDIDO, TAPETE, deps(r, s))
    expect(r.enfileirarFalhaAposUpload).toHaveBeenCalledOnce()
  })
})

describe('regras de anexos por status na gestao', () => {
  it('permite inclusao em producao contabilizando layout', async () => {
    const r = repo({ buscarTapeteNoEscopo: vi.fn().mockResolvedValue({ data: escopo(false, { status: 'EM PRODUÇÃO' }), error: null }) })
    expect((await uploadAnexo(multipart(), PEDIDO, TAPETE, deps(r), 'gestao')).status).toBe(201)
    expect(r.registrar).toHaveBeenCalledWith(expect.objectContaining({ p_contabilizar_alteracao_layout: true }))
  })

  it('permite inclusao em recebido sem contabilizar layout', async () => {
    const r = repo({ buscarTapeteNoEscopo: vi.fn().mockResolvedValue({ data: escopo(false, { status: 'RECEBIDO' }), error: null }) })
    expect((await uploadAnexo(multipart(), PEDIDO, TAPETE, deps(r), 'gestao')).status).toBe(201)
    expect(r.registrar).toHaveBeenCalledWith(expect.objectContaining({ p_contabilizar_alteracao_layout: false }))
  })

  it('bloqueia inclusao em cancelado antes do Storage', async () => {
    const r = repo({ buscarTapeteNoEscopo: vi.fn().mockResolvedValue({ data: escopo(false, { status: 'CANCELADO' }), error: null }) })
    const s = storage()
    expect((await uploadAnexo(multipart(), PEDIDO, TAPETE, deps(r, s), 'gestao')).status).toBe(422)
    expect(s.upload).not.toHaveBeenCalled()
  })

  it.each(['EM PRODUÇÃO', 'RECEBIDO', 'CANCELADO'])('bloqueia substituicao e remocao em %s antes da RPC', async (status) => {
    const r = repo({ buscarAnexoNoEscopo: vi.fn().mockResolvedValue({ data: escopo(true, { status }), error: null }) })
    const s = storage()
    expect((await substituirAnexo(multipart(undefined), ANEXO, deps(r, s), 'gestao')).status).toBe(422)
    expect((await removerAnexo(requisicaoRemocao(), ANEXO, deps(r, s), 'gestao')).status).toBe(422)
    expect(s.upload).not.toHaveBeenCalled()
    expect(r.substituir).not.toHaveBeenCalled()
    expect(r.remover).not.toHaveBeenCalled()
  })
})

describe('abertura, substituição e remoção', () => {
  it('gera URL curta sem caminho na resposta', async () => {
    const response = await abrirAnexo(new Request('http://localhost'), ANEXO, deps())
    const body = await response.json()
    expect(body.url).toBe('https://storage.invalid/signed')
    expect(body.expiraEm).toBe('2026-08-05T10:05:00.000Z')
    expect(JSON.stringify(body)).not.toContain(PEDIDO)
  })

  it('retorna 404 para anexo inexistente ou fora do escopo', async () => {
    const r = repo({ buscarAnexoNoEscopo: vi.fn().mockResolvedValue({ data: null, error: null }) })
    expect((await abrirAnexo(new Request('http://localhost'), ANEXO, deps(r))).status).toBe(404)
  })

  it('novo abre anexo do próprio pedido RASCUNHO', async () => {
    const s = storage()
    const response = await abrirAnexo(
      new Request('http://localhost'),
      ANEXO,
      deps(repo(), s, contexto('pedidos_personalizados_novo'))
    )
    expect(response.status).toBe(200)
    expect(s.urlAssinada).toHaveBeenCalledOnce()
  })

  it.each([
    ['AGUARDANDO LAYOUT', USUARIO],
    ['EM PRODUÇÃO', USUARIO],
    ['RECEBIDO', USUARIO],
    ['RASCUNHO', OUTRO_USUARIO],
  ])('novo não gera URL para recurso negado: %s', async (status, createdBy) => {
    const r = repo({
      buscarAnexoNoEscopo: vi.fn().mockResolvedValue({
        data: escopo(true, { status, created_by: createdBy }),
        error: null,
      }),
    })
    const s = storage()
    const response = await abrirAnexo(
      new Request('http://localhost'),
      ANEXO,
      deps(r, s, contexto('pedidos_personalizados_novo'))
    )
    expect(response.status).toBe(404)
    expect(s.urlAssinada).not.toHaveBeenCalled()
  })

  it('novo recebe 404 para anexo de outro pedido ou UUID inexistente', async () => {
    const r = repo({ buscarAnexoNoEscopo: vi.fn().mockResolvedValue({ data: null, error: null }) })
    expect((await abrirAnexo(
      new Request('http://localhost'),
      ANEXO,
      deps(r, storage(), contexto('pedidos_personalizados_novo'))
    )).status).toBe(404)
  })

  it('substitui sem remover o arquivo antigo antes da RPC', async () => {
    const r = repo()
    const s = storage()
    const response = await substituirAnexo(multipart(undefined), ANEXO, deps(r, s))
    expect(response.status).toBe(200)
    expect(r.substituir).toHaveBeenCalledOnce()
    expect(s.remover).not.toHaveBeenCalled()
  })

  it('contabiliza substituição somente no contexto de gestão', async () => {
    const inicial = repo()
    await substituirAnexo(multipart(undefined), ANEXO, deps(inicial, storage(), contexto('pedidos_personalizados_novo')))
    expect(inicial.substituir).toHaveBeenCalledWith(expect.objectContaining({ p_contabilizar_alteracao_layout: false }))

    const gestao = repo()
    await substituirAnexo(multipart(undefined), ANEXO, deps(gestao), 'gestao')
    expect(gestao.substituir).toHaveBeenCalledWith(expect.objectContaining({ p_contabilizar_alteracao_layout: true }))
  })

  it('novo substitui o anexo próprio e não chama Storage/RPC quando a autorização falha', async () => {
    const autorizado = repo()
    expect((await substituirAnexo(
      multipart(undefined),
      ANEXO,
      deps(autorizado, storage(), contexto('pedidos_personalizados_novo'))
    )).status).toBe(200)
    expect(autorizado.substituir).toHaveBeenCalledOnce()

    const negado = repo({
      buscarAnexoNoEscopo: vi.fn().mockResolvedValue({
        data: escopo(true, { created_by: OUTRO_USUARIO }),
        error: null,
      }),
    })
    const s = storage()
    expect((await substituirAnexo(
      new Request('http://localhost', { method: 'PUT' }),
      ANEXO,
      deps(negado, s, contexto('pedidos_personalizados_novo'))
    )).status).toBe(404)
    expect(s.upload).not.toHaveBeenCalled()
    expect(negado.substituir).not.toHaveBeenCalled()
  })

  it('preserva o antigo e remove apenas o novo se a RPC de substituição falha', async () => {
    const r = repo({ substituir: vi.fn().mockResolvedValue({ data: null, error: { message: 'CONFLITO_VERSAO' } }) })
    const s = storage()
    expect((await substituirAnexo(multipart(undefined), ANEXO, deps(r, s))).status).toBe(409)
    expect(s.remover).toHaveBeenCalledOnce()
  })

  it('remove metadado via RPC e conclui a pendência após exclusão oportunística', async () => {
    const r = repo()
    const response = await removerAnexo(requisicaoRemocao(), ANEXO, deps(r))
    expect(await response.json()).toMatchObject({ anexoId: ANEXO, version: 2 })
    expect(r.marcarProcessadoPorCaminho).toHaveBeenCalledOnce()
  })

  it('contabiliza remoção somente no contexto de gestão', async () => {
    const inicial = repo()
    await removerAnexo(requisicaoRemocao(), ANEXO, deps(inicial, storage(), contexto('pedidos_personalizados_novo')))
    expect(inicial.remover).toHaveBeenCalledWith(expect.objectContaining({ p_contabilizar_alteracao_layout: false }))

    const gestao = repo()
    await removerAnexo(requisicaoRemocao(), ANEXO, deps(gestao), 'gestao')
    expect(gestao.remover).toHaveBeenCalledWith(expect.objectContaining({ p_contabilizar_alteracao_layout: true }))
  })

  it('novo remove o anexo próprio e não chama RPC/Storage quando a autorização falha', async () => {
    const autorizado = repo()
    expect((await removerAnexo(
      requisicaoRemocao(),
      ANEXO,
      deps(autorizado, storage(), contexto('pedidos_personalizados_novo'))
    )).status).toBe(200)
    expect(autorizado.remover).toHaveBeenCalledOnce()

    const negado = repo({
      buscarAnexoNoEscopo: vi.fn().mockResolvedValue({
        data: escopo(true, { status: 'EM PRODUÇÃO' }),
        error: null,
      }),
    })
    const s = storage()
    expect((await removerAnexo(
      requisicaoRemocao(),
      ANEXO,
      deps(negado, s, contexto('pedidos_personalizados_novo'))
    )).status).toBe(404)
    expect(negado.remover).not.toHaveBeenCalled()
    expect(s.remover).not.toHaveBeenCalled()
  })

  it('rejeita conflito de remoção antes da RPC e do Storage', async () => {
    const r = repo()
    const s = storage()
    expect((await removerAnexo(requisicaoRemocao(2), ANEXO, deps(r, s))).status).toBe(409)
    expect(r.remover).not.toHaveBeenCalled()
    expect(s.remover).not.toHaveBeenCalled()
  })

  it('mantém a pendência se a exclusão física falha', async () => {
    const r = repo()
    const s = storage({ remover: vi.fn().mockResolvedValue({ ok: false, error: new Error('temporária') }) })
    expect((await removerAnexo(requisicaoRemocao(), ANEXO, deps(r, s))).status).toBe(200)
    expect(r.marcarProcessadoPorCaminho).not.toHaveBeenCalled()
  })
})
