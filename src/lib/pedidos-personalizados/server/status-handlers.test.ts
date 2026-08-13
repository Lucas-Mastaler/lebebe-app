import { describe, expect, it, vi } from 'vitest'
import type { ContextoPedidosPersonalizados } from './contexto'
import { transicionarStatus, type DependenciasApiStatus } from './status-handlers'

const PEDIDO = '10000000-0000-4000-8000-000000000001'
const USUARIO = '20000000-0000-4000-8000-000000000001'
const UNIDADE = '30000000-0000-4000-8000-000000000001'
const EVENTO = '40000000-0000-4000-8000-000000000001'

function contexto(): ContextoPedidosPersonalizados {
  return {
    supabase: {} as ContextoPedidosPersonalizados['supabase'],
    allowedUser: { id: USUARIO, email: 'teste@example.com', role: 'user' } as ContextoPedidosPersonalizados['allowedUser'],
    moduloAutorizado: 'pedidos_personalizados_gestao',
    unidades: [{ id: UNIDADE, chave: 'bigorrilho', nome: 'BIGORRILHO', nomeExibicao: 'BIGORRILHO' }],
  }
}

function deps(status = 'VENDA FECHADA', overrides: Record<string, unknown> = {}) {
  const repo = {
    buscarPedidoNoEscopo: vi.fn().mockResolvedValue({ data: { id: PEDIDO, unidade_id: UNIDADE, status, version: 1, fornecedor: { chave: 'moriah_tapetes' }, numero_lancamento: '0001', numero_pedido_compra: '123', data_pedido_fornecedor: '2026-08-06', comprador: 'ANA', data_entrega: '2026-08-20' }, error: null }),
    transicionarStatus: vi.fn().mockResolvedValue({ data: { evento_id: EVENTO, status: 'AGUARDANDO LAYOUT', version: 2 }, error: null }),
    ...overrides,
  }
  return {
    repo,
    deps: {
      carregarContexto: vi.fn().mockResolvedValue({ ok: true, contexto: contexto() }),
      criarRepositorio: vi.fn().mockReturnValue(repo),
    } as unknown as DependenciasApiStatus,
  }
}

function request(body: unknown) {
  return new Request('http://localhost/status', { method: 'POST', body: JSON.stringify(body) })
}

describe('handler de transicao de status', () => {
  it('executa a transicao permitida com usuario e versao', async () => {
    const cenario = deps()
    const response = await transicionarStatus(request({ expectedVersion: 1, statusDestino: 'AGUARDANDO LAYOUT' }), PEDIDO, cenario.deps)
    expect(response.status).toBe(200)
    expect(cenario.repo.transicionarStatus).toHaveBeenCalledWith(expect.objectContaining({ p_pedido_id: PEDIDO, p_usuario_id: USUARIO, p_expected_version: 1 }))
    expect(await response.json()).toMatchObject({ eventoId: EVENTO, status: 'AGUARDANDO LAYOUT', version: 2 })
  })

  it('rejeita atalho antes da RPC', async () => {
    const cenario = deps()
    const response = await transicionarStatus(request({ expectedVersion: 1, statusDestino: 'EM PRODUÇÃO', numeroPedidoCompra: '123', dataPedidoFornecedor: '2026-08-06', comprador: 'ANA' }), PEDIDO, cenario.deps)
    expect(response.status).toBe(422)
    expect(cenario.repo.transicionarStatus).not.toHaveBeenCalled()
  })

  it('exige lançamento antes de fechar a venda para qualquer fornecedor', async () => {
    for (const fornecedor of ['moriah_tapetes', 'lebebe_exclusive']) {
      const cenario = deps('RASCUNHO', {
        buscarPedidoNoEscopo: vi.fn().mockResolvedValue({
          data: { id: PEDIDO, unidade_id: UNIDADE, status: 'RASCUNHO', version: 1, fornecedor: { chave: fornecedor }, numero_lancamento: null },
          error: null,
        }),
      })
      const response = await transicionarStatus(request({ expectedVersion: 1, statusDestino: 'VENDA FECHADA' }), PEDIDO, cenario.deps)
      expect(response.status).toBe(422)
      expect((await response.json()).erro).toBe('NUMERO_LANCAMENTO_OBRIGATORIO')
      expect(cenario.repo.transicionarStatus).not.toHaveBeenCalled()
    }
  })

  it('nao revela pedido fora do escopo', async () => {
    const cenario = deps('VENDA FECHADA', { buscarPedidoNoEscopo: vi.fn().mockResolvedValue({ data: null, error: null }) })
    expect((await transicionarStatus(request({ expectedVersion: 1, statusDestino: 'AGUARDANDO LAYOUT' }), PEDIDO, cenario.deps)).status).toBe(404)
  })

  it('mapeia conflito de versao sem alteracao parcial', async () => {
    const cenario = deps('VENDA FECHADA', { transicionarStatus: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0003', message: 'CONFLITO_VERSAO' } }) })
    const response = await transicionarStatus(request({ expectedVersion: 1, statusDestino: 'AGUARDANDO LAYOUT' }), PEDIDO, cenario.deps)
    expect(response.status).toBe(409)
    expect((await response.json()).erro).toBe('CONFLITO_VERSAO')
  })

  it('exige a previsão para produção e justificativa de cancelamento', async () => {
    const producao = deps('AGUARDANDO APROVAÇÃO DO CLIENTE', { buscarPedidoNoEscopo: vi.fn().mockResolvedValue({ data: { id: PEDIDO, unidade_id: UNIDADE, status: 'AGUARDANDO APROVAÇÃO DO CLIENTE', version: 1, fornecedor: { chave: 'moriah_tapetes' }, numero_pedido_compra: '123', data_pedido_fornecedor: '2026-08-06', comprador: 'ANA', data_entrega: null }, error: null }) })
    expect((await transicionarStatus(request({ expectedVersion: 1, statusDestino: 'EM PRODUÇÃO' }), PEDIDO, producao.deps)).status).toBe(422)
    const cancelamento = deps()
    expect((await transicionarStatus(request({ expectedVersion: 1, statusDestino: 'CANCELADO' }), PEDIDO, cancelamento.deps)).status).toBe(422)
  })

  it('exige e encaminha a data manual de recebimento', async () => {
    const cenario = deps('EM PRODUÇÃO')
    expect((await transicionarStatus(request({ expectedVersion: 1, statusDestino: 'RECEBIDO' }), PEDIDO, cenario.deps)).status).toBe(422)
    const response = await transicionarStatus(request({ expectedVersion: 1, statusDestino: 'RECEBIDO', dataRecebimento: '2026-08-06' }), PEDIDO, cenario.deps)
    expect(response.status).toBe(200)
    expect(cenario.repo.transicionarStatus).toHaveBeenLastCalledWith(expect.objectContaining({ p_data_entrega: '2026-08-06' }))
  })

  it('rejeita data do pedido ao fornecedor futura na transicao para AGUARDANDO LAYOUT', async () => {
    const cenario = deps()
    const response = await transicionarStatus(
      request({ expectedVersion: 1, statusDestino: 'AGUARDANDO LAYOUT', numeroPedidoCompra: '123', dataPedidoFornecedor: '2099-01-01', comprador: 'ANA' }),
      PEDIDO,
      cenario.deps,
    )
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.mensagem).toContain('não pode ser futura')
    expect(cenario.repo.transicionarStatus).not.toHaveBeenCalled()
  })
})
