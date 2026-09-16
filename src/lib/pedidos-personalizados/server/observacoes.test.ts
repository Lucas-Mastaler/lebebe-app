import { describe, expect, it, vi } from 'vitest'
import type { ContextoPedidosPersonalizados } from './contexto'
import { adicionarObservacao, type DependenciasApiPedidos } from './handlers'
import type { RepositorioPedidosPersonalizados } from './repositorio'

const USUARIO_ID = '10000000-0000-4000-8000-000000000001'
const PEDIDO_ID = '20000000-0000-4000-8000-000000000001'
const UNIDADE_ID = '40000000-0000-4000-8000-000000000001'
const OBSERVACAO_ID = '90000000-0000-4000-8000-000000000001'

function contexto(overrides: Partial<ContextoPedidosPersonalizados> = {}): ContextoPedidosPersonalizados {
  return {
    supabase: {} as never,
    allowedUser: { id: USUARIO_ID, email: 'tecnico@example.com', role: 'user', ativo: true },
    moduloAutorizado: 'pedidos_personalizados_gestao',
    unidades: [{ id: UNIDADE_ID, chave: 'bigorrilho', nome: 'BIGORRILHO', nomeExibicao: 'BIGORRILHO' }],
    ...overrides,
  }
}

function criarRepo(overrides: Record<string, unknown> = {}) {
  return {
    buscarPedidoNoEscopo: vi.fn().mockResolvedValue({
      data: { id: PEDIDO_ID, unidade_id: UNIDADE_ID, status: 'RASCUNHO', version: 1 },
      error: null,
    }),
    adicionarObservacao: vi.fn().mockResolvedValue({
      data: {
        id: OBSERVACAO_ID,
        texto: 'Observação de teste',
        created_at: '2026-09-15T12:00:00.000Z',
        usuario: { email: 'tecnico@example.com' },
      },
      error: null,
    }),
    ...overrides,
  }
}

function deps(repo = criarRepo(), contextoAtual = contexto()): DependenciasApiPedidos {
  return {
    carregarContexto: vi.fn().mockResolvedValue({ ok: true, contexto: contextoAtual }),
    criarRepositorio: vi.fn(() => repo as unknown as RepositorioPedidosPersonalizados),
  }
}

function request(body: unknown) {
  return new Request('http://localhost/observacoes', { method: 'POST', body: JSON.stringify(body) })
}

describe('adicionar observação a um pedido personalizado', () => {
  it('insere a observação com o usuário resolvido no contexto autenticado, nunca do payload', async () => {
    const repo = criarRepo()
    const response = await adicionarObservacao(request({ texto: 'Observação de teste' }), PEDIDO_ID, deps(repo))
    expect(response.status).toBe(200)
    expect(repo.adicionarObservacao).toHaveBeenCalledWith({
      pedidoId: PEDIDO_ID,
      usuarioId: USUARIO_ID,
      texto: 'Observação de teste',
    })
    expect(await response.json()).toEqual({
      ok: true,
      observacao: {
        id: OBSERVACAO_ID,
        texto: 'Observação de teste',
        createdAt: '2026-09-15T12:00:00.000Z',
        usuario: { email: 'tecnico@example.com' },
      },
    })
  })

  it('aplica trim no texto antes de persistir', async () => {
    const repo = criarRepo()
    await adicionarObservacao(request({ texto: '  com espaços  ' }), PEDIDO_ID, deps(repo))
    expect(repo.adicionarObservacao).toHaveBeenCalledWith(expect.objectContaining({ texto: 'com espaços' }))
  })

  it('rejeita texto vazio (após trim) sem chamar o repositório', async () => {
    const repo = criarRepo()
    const response = await adicionarObservacao(request({ texto: '   ' }), PEDIDO_ID, deps(repo))
    expect(response.status).toBe(422)
    expect((await response.json()).erro).toBe('OBSERVACAO_VAZIA')
    expect(repo.adicionarObservacao).not.toHaveBeenCalled()
  })

  it('rejeita texto acima do limite de 2000 caracteres', async () => {
    const repo = criarRepo()
    const response = await adicionarObservacao(request({ texto: 'a'.repeat(2001) }), PEDIDO_ID, deps(repo))
    expect(response.status).toBe(422)
    expect((await response.json()).erro).toBe('OBSERVACAO_MUITO_LONGA')
    expect(repo.adicionarObservacao).not.toHaveBeenCalled()
  })

  it('rejeita payload com campos além de texto (impede forjar autoria/timestamp pelo frontend)', async () => {
    const repo = criarRepo()
    const response = await adicionarObservacao(
      request({ texto: 'Observação', usuarioId: 'outro-usuario', createdAt: '2000-01-01' }),
      PEDIDO_ID,
      deps(repo)
    )
    expect(response.status).toBe(422)
    expect((await response.json()).erro).toBe('CAMPO_NAO_PERMITIDO')
    expect(repo.adicionarObservacao).not.toHaveBeenCalled()
  })

  it('rejeita ID de pedido inválido', async () => {
    const response = await adicionarObservacao(request({ texto: 'x' }), 'invalido', deps())
    expect(response.status).toBe(400)
  })

  it('retorna 404 quando o pedido não pertence às unidades permitidas ao usuário', async () => {
    const repo = criarRepo({ buscarPedidoNoEscopo: vi.fn().mockResolvedValue({ data: null, error: null }) })
    const response = await adicionarObservacao(request({ texto: 'Observação' }), PEDIDO_ID, deps(repo))
    expect(response.status).toBe(404)
    expect(repo.adicionarObservacao).not.toHaveBeenCalled()
  })

  it('propaga a negação de acesso quando o usuário não tem o módulo autorizado', async () => {
    const negado = new Response(JSON.stringify({ ok: false, erro: 'ACESSO_NEGADO' }), { status: 403 })
    const semAcesso: DependenciasApiPedidos = {
      carregarContexto: vi.fn().mockResolvedValue({ ok: false, response: negado }),
      criarRepositorio: vi.fn(),
    }
    const response = await adicionarObservacao(request({ texto: 'Observação' }), PEDIDO_ID, semAcesso)
    expect(response.status).toBe(403)
  })

  it('permite observação independentemente do status atual do pedido', async () => {
    for (const status of ['RASCUNHO', 'VENDA FECHADA', 'EM PRODUÇÃO', 'RECEBIDO', 'CANCELADO']) {
      const repo = criarRepo({
        buscarPedidoNoEscopo: vi.fn().mockResolvedValue({
          data: { id: PEDIDO_ID, unidade_id: UNIDADE_ID, status, version: 1 },
          error: null,
        }),
      })
      const response = await adicionarObservacao(request({ texto: 'Observação' }), PEDIDO_ID, deps(repo))
      expect(response.status).toBe(200)
    }
  })
})
