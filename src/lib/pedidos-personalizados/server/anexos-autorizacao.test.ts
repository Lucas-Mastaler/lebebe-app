import { describe, expect, it } from 'vitest'
import type { ContextoPedidosPersonalizados } from './contexto'
import type { EscopoAnexo } from './anexos-repositorio'
import { verificarAcessoAnexoPedidoPersonalizado } from './anexos-autorizacao'

const USUARIO = '10000000-0000-4000-8000-000000000001'
const OUTRO_USUARIO = '10000000-0000-4000-8000-000000000002'

function contexto(
  moduloAutorizado: ContextoPedidosPersonalizados['moduloAutorizado']
): ContextoPedidosPersonalizados {
  return {
    supabase: {} as never,
    allowedUser: { id: USUARIO, email: 'tecnico@example.com', role: 'user', ativo: true },
    moduloAutorizado,
    unidades: [],
  }
}

function pedido(overrides: Partial<EscopoAnexo['pedido']> = {}): EscopoAnexo['pedido'] {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    version: 1,
    status: 'CADASTRADO',
    created_by: USUARIO,
    fornecedor: { chave: 'moriah_tapetes' },
    ...overrides,
  }
}

describe('autorização central de anexos personalizados', () => {
  it.each([
    'CADASTRADO',
    'AGUARDANDO LAYOUT',
    'AGUARDANDO APROVAÇÃO DO CLIENTE',
    'EM PRODUÇÃO',
    'RECEBIDO',
  ])('gestão autoriza pedido no escopo no status %s', (status) => {
    expect(verificarAcessoAnexoPedidoPersonalizado(
      contexto('pedidos_personalizados_gestao'),
      pedido({ status, created_by: OUTRO_USUARIO })
    )).toBe(true)
  })

  it('novo autoriza somente o próprio pedido Moriah em CADASTRADO', () => {
    expect(verificarAcessoAnexoPedidoPersonalizado(
      contexto('pedidos_personalizados_novo'),
      pedido()
    )).toBe(true)
  })

  it.each([
    ['AGUARDANDO LAYOUT', USUARIO, 'moriah_tapetes'],
    ['EM PRODUÇÃO', USUARIO, 'moriah_tapetes'],
    ['RECEBIDO', USUARIO, 'moriah_tapetes'],
    ['CADASTRADO', OUTRO_USUARIO, 'moriah_tapetes'],
    ['CADASTRADO', USUARIO, 'decorisi'],
  ])('novo nega status=%s, criador=%s e fornecedor=%s', (status, createdBy, fornecedor) => {
    expect(verificarAcessoAnexoPedidoPersonalizado(
      contexto('pedidos_personalizados_novo'),
      pedido({ status, created_by: createdBy, fornecedor: { chave: fornecedor } })
    )).toBe(false)
  })
})
