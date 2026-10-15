import { describe, expect, it } from 'vitest'
import { decorisiDispensaLayout, destinosPermitidosStatus } from '../status-fluxo'

const papel = { tipo: 'PAPEL', classificacao: 'CATALOGO' }
describe('fluxo Decorisi conforme todos os produtos', () => {
  it.each([
    [[papel], true],
    [[papel, papel], true],
    [[{ tipo: 'PAPEL', classificacao: 'PERSONALIZADO' }], false],
    [[{ tipo: 'PAINEL', classificacao: 'CATALOGO' }], false],
    [[{ tipo: 'PAINEL', classificacao: 'PERSONALIZADO' }], false],
    [[papel, { tipo: 'PAPEL', classificacao: 'PERSONALIZADO' }], false],
    [[papel, { tipo: 'PAINEL', classificacao: 'CATALOGO' }], false],
    [[{ tipo: 'PAINEL', classificacao: 'CATALOGO' }, papel], false],
    [[], false],
  ] as const)('calcula elegibilidade para %j', (itens, esperado) => {
    const dispensa = decorisiDispensaLayout(itens)
    expect(dispensa).toBe(esperado)
    expect(destinosPermitidosStatus('VENDA FECHADA', 'decorisi', dispensa)).toEqual([
      esperado ? 'EM PRODUÇÃO' : 'AGUARDANDO LAYOUT', 'CANCELADO',
    ])
  })
  it('dispensado não oferece layout nem aprovação e mantém recebimento', () => {
    expect(destinosPermitidosStatus('AGUARDANDO LAYOUT', 'decorisi', true)).not.toContain('AGUARDANDO APROVAÇÃO DO CLIENTE')
    expect(destinosPermitidosStatus('AGUARDANDO APROVAÇÃO DO CLIENTE', 'decorisi', true)).not.toContain('AGUARDANDO LAYOUT')
    expect(destinosPermitidosStatus('EM PRODUÇÃO', 'decorisi', true)).toEqual(['RECEBIDO', 'CANCELADO'])
  })
  it('preserva Moriah e Exclusive mesmo com flag de dispensa', () => {
    expect(destinosPermitidosStatus('VENDA FECHADA', 'moriah_tapetes', true)).toEqual(['AGUARDANDO LAYOUT', 'CANCELADO'])
    expect(destinosPermitidosStatus('VENDA FECHADA', 'lebebe_exclusive', false)).toEqual(['EM PRODUÇÃO', 'CANCELADO'])
  })
})
