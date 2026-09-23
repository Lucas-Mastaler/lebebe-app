import { describe, expect, it } from 'vitest'
import {
  destinosPermitidosStatus,
  operacoesAnexoGestao,
  permiteEdicaoAdministrativa,
  permiteEdicaoComercial,
  permiteEdicaoProdutos,
  permiteVerAvancoStatus,
  podeCancelarPedido,
  podeTransicionarStatus,
} from './status-fluxo'

describe('fluxo de status de pedidos personalizados', () => {
  it('expoe somente as transicoes aprovadas e nenhum atalho', () => {
    expect(destinosPermitidosStatus('RASCUNHO')).toEqual(['VENDA FECHADA', 'CANCELADO'])
    expect(destinosPermitidosStatus('VENDA FECHADA')).toEqual(['AGUARDANDO LAYOUT', 'CANCELADO'])
    expect(destinosPermitidosStatus('AGUARDANDO LAYOUT')).toEqual(['AGUARDANDO APROVAÇÃO DO CLIENTE', 'CANCELADO'])
    expect(destinosPermitidosStatus('AGUARDANDO APROVAÇÃO DO CLIENTE')).toEqual(['EM PRODUÇÃO', 'AGUARDANDO LAYOUT', 'CANCELADO'])
    expect(destinosPermitidosStatus('EM PRODUÇÃO')).toEqual(['RECEBIDO', 'CANCELADO'])
    expect(destinosPermitidosStatus('RECEBIDO')).toEqual([])
    expect(destinosPermitidosStatus('CANCELADO')).toEqual([])
    expect(podeTransicionarStatus('RASCUNHO', 'EM PRODUÇÃO')).toBe(false)
    expect(destinosPermitidosStatus('VENDA FECHADA', 'lebebe_exclusive')).toEqual(['EM PRODUÇÃO', 'CANCELADO'])
    expect(destinosPermitidosStatus('VENDA FECHADA', 'lebebe_exclusive')).not.toContain('AGUARDANDO LAYOUT')
  })

  it('bloqueia comercial e administrativo nos estados definidos', () => {
    expect(permiteEdicaoComercial('AGUARDANDO APROVAÇÃO DO CLIENTE')).toBe(true)
    expect(permiteEdicaoComercial('VENDA FECHADA', 'lebebe_exclusive')).toBe(true)
    expect(permiteEdicaoComercial('EM PRODUÇÃO')).toBe(false)
    expect(permiteEdicaoAdministrativa('EM PRODUÇÃO')).toBe(true)
    expect(permiteEdicaoAdministrativa('RECEBIDO')).toBe(false)
    expect(permiteEdicaoAdministrativa('CANCELADO')).toBe(false)
  })

  it('permite editar produtos somente em RASCUNHO, para os dois fornecedores', () => {
    expect(permiteEdicaoProdutos('RASCUNHO')).toBe(true)
    expect(permiteEdicaoProdutos('VENDA FECHADA')).toBe(false)
    expect(permiteEdicaoProdutos('AGUARDANDO LAYOUT')).toBe(false)
    expect(permiteEdicaoProdutos('AGUARDANDO APROVAÇÃO DO CLIENTE')).toBe(false)
    expect(permiteEdicaoProdutos('EM PRODUÇÃO')).toBe(false)
    expect(permiteEdicaoProdutos('RECEBIDO')).toBe(false)
    expect(permiteEdicaoProdutos('CANCELADO')).toBe(false)
  })

  it('aplica as operacoes e a contabilizacao de anexos por status', () => {
    expect(operacoesAnexoGestao('EM PRODUÇÃO')).toEqual({ abrir: true, adicionar: true, substituir: false, remover: false, contabilizar: true })
    expect(operacoesAnexoGestao('RECEBIDO')).toEqual({ abrir: true, adicionar: true, substituir: false, remover: false, contabilizar: false })
    expect(operacoesAnexoGestao('CANCELADO')).toEqual({ abrir: true, adicionar: false, substituir: false, remover: false, contabilizar: false })
  })

  it('podeCancelarPedido reaproveita exatamente a mesma regra de transicoes (sem lista paralela)', () => {
    expect(podeCancelarPedido('RASCUNHO')).toBe(true)
    expect(podeCancelarPedido('VENDA FECHADA')).toBe(true)
    expect(podeCancelarPedido('AGUARDANDO LAYOUT')).toBe(true)
    expect(podeCancelarPedido('AGUARDANDO APROVAÇÃO DO CLIENTE')).toBe(true)
    expect(podeCancelarPedido('EM PRODUÇÃO')).toBe(true)
    expect(podeCancelarPedido('RECEBIDO')).toBe(false)
    expect(podeCancelarPedido('CANCELADO')).toBe(false)
    // Lebebe Exclusive não passa por AGUARDANDO LAYOUT/AGUARDANDO APROVAÇÃO — permanece sem transição (nunca "true" por engano).
    expect(podeCancelarPedido('AGUARDANDO LAYOUT', 'lebebe_exclusive')).toBe(false)
    expect(podeCancelarPedido('VENDA FECHADA', 'lebebe_exclusive')).toBe(true)
    expect(podeCancelarPedido('EM PRODUÇÃO', 'lebebe_exclusive')).toBe(true)
    expect(podeCancelarPedido('RECEBIDO', 'lebebe_exclusive')).toBe(false)
  })

  it('permiteVerAvancoStatus mostra o avanco em RASCUNHO para qualquer perfil, e restringe a partir de Venda Fechada', () => {
    // RASCUNHO: regra inalterada, nenhuma restrição por perfil.
    expect(permiteVerAvancoStatus('RASCUNHO', 'consultora', false)).toBe(true)
    expect(permiteVerAvancoStatus('RASCUNHO', 'supervisora_loja', false)).toBe(true)
    expect(permiteVerAvancoStatus('RASCUNHO', null, false)).toBe(true)

    // A partir de Venda Fechada (inclusive): só perfis operacionais reais (gestao/pos_venda) ou acesso total.
    expect(permiteVerAvancoStatus('VENDA FECHADA', 'gestao', false)).toBe(true)
    expect(permiteVerAvancoStatus('VENDA FECHADA', 'pos_venda', false)).toBe(true)
    expect(permiteVerAvancoStatus('VENDA FECHADA', 'consultora', false)).toBe(false)
    expect(permiteVerAvancoStatus('VENDA FECHADA', 'supervisora_loja', false)).toBe(false)
    expect(permiteVerAvancoStatus('VENDA FECHADA', null, false)).toBe(false)
    expect(permiteVerAvancoStatus('VENDA FECHADA', null, true)).toBe(true)

    expect(permiteVerAvancoStatus('AGUARDANDO LAYOUT', 'consultora', false)).toBe(false)
    expect(permiteVerAvancoStatus('AGUARDANDO APROVAÇÃO DO CLIENTE', 'gestao', false)).toBe(true)
    expect(permiteVerAvancoStatus('EM PRODUÇÃO', 'pos_venda', false)).toBe(true)
    expect(permiteVerAvancoStatus('EM PRODUÇÃO', 'consultora', false)).toBe(false)
  })
})
