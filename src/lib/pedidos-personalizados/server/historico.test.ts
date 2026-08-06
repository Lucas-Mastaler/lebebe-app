import { describe, expect, it, vi } from 'vitest'
import { buscarPedidosPersonalizadosPorTelefones } from './historico'

function consulta(resultado: { data: unknown[]; error: null }) {
  const api = {
    select: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (valor: typeof resultado) => unknown) => Promise.resolve(resultado).then(resolve),
  }
  api.select.mockReturnValue(api)
  api.in.mockReturnValue(api)
  api.order.mockReturnValue(api)
  api.limit.mockReturnValue(api)
  return api
}

describe('histórico de pedidos personalizados por telefone', () => {
  it('normaliza, cruza exatamente no escopo e conta tapetes em uma consulta agregada', async () => {
    const pedidos = consulta({
      data: [{
        id: 'pedido-1', created_at: '2026-08-06T12:00:00Z', unidade_id: 'unidade-1',
        status: 'CADASTRADO', numero_lancamento: '000001', numero_pedido_compra: '00001',
        data_pedido_fornecedor: '2026-08-06', data_entrega: '2026-08-20',
        unidade: { chave: 'portao', nome: 'PORTAO' },
      }],
      error: null,
    })
    const tapetes = consulta({ data: [{ pedido_id: 'pedido-1' }, { pedido_id: 'pedido-1' }], error: null })
    const from = vi.fn((tabela: string) => tabela === 'pedidos_personalizados_pedidos' ? pedidos : tapetes)

    const resultado = await buscarPedidosPersonalizadosPorTelefones(
      { from } as never,
      { telefones: ['+55 (41) 99999-9999', '41999999999', 'telefone inválido'], unidadeIds: ['unidade-1'] }
    )

    expect(from).toHaveBeenCalledTimes(2)
    expect(pedidos.in).toHaveBeenNthCalledWith(1, 'telefone_normalizado', ['41999999999'])
    expect(pedidos.in).toHaveBeenNthCalledWith(2, 'unidade_id', ['unidade-1'])
    expect(tapetes.in).toHaveBeenCalledWith('pedido_id', ['pedido-1'])
    expect(resultado).toEqual([expect.objectContaining({
      id: 'pedido-1', unidade: 'PORTÃO', quantidadeTapetes: 2, podeAbrirDetalhe: true,
    })])
    expect(resultado[0]).not.toHaveProperty('telefone')
    expect(resultado[0]).not.toHaveProperty('anexos')
    expect(resultado[0]).not.toHaveProperty('observacoes')
  })

  it('não consulta o banco sem telefone válido ou sem unidade autorizada', async () => {
    const from = vi.fn()
    await expect(buscarPedidosPersonalizadosPorTelefones(
      { from } as never,
      { telefones: ['inválido'], unidadeIds: ['unidade-1'] }
    )).resolves.toEqual([])
    await expect(buscarPedidosPersonalizadosPorTelefones(
      { from } as never,
      { telefones: ['41999999999'], unidadeIds: [] }
    )).resolves.toEqual([])
    expect(from).not.toHaveBeenCalled()
  })
})
