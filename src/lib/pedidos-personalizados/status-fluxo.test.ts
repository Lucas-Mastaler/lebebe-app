import { describe, expect, it } from 'vitest'
import {
  destinosPermitidosStatus,
  operacoesAnexoGestao,
  permiteEdicaoAdministrativa,
  permiteEdicaoComercial,
  podeTransicionarStatus,
} from './status-fluxo'

describe('fluxo de status de pedidos personalizados', () => {
  it('expoe somente as transicoes aprovadas e nenhum atalho', () => {
    expect(destinosPermitidosStatus('CADASTRADO')).toEqual(['AGUARDANDO LAYOUT', 'CANCELADO'])
    expect(destinosPermitidosStatus('AGUARDANDO LAYOUT')).toEqual(['AGUARDANDO APROVAÇÃO DO CLIENTE', 'CANCELADO'])
    expect(destinosPermitidosStatus('AGUARDANDO APROVAÇÃO DO CLIENTE')).toEqual(['EM PRODUÇÃO', 'AGUARDANDO LAYOUT', 'CANCELADO'])
    expect(destinosPermitidosStatus('EM PRODUÇÃO')).toEqual(['RECEBIDO', 'CANCELADO'])
    expect(destinosPermitidosStatus('RECEBIDO')).toEqual([])
    expect(destinosPermitidosStatus('CANCELADO')).toEqual([])
    expect(podeTransicionarStatus('CADASTRADO', 'EM PRODUÇÃO')).toBe(false)
  })

  it('bloqueia comercial e administrativo nos estados definidos', () => {
    expect(permiteEdicaoComercial('AGUARDANDO APROVAÇÃO DO CLIENTE')).toBe(true)
    expect(permiteEdicaoComercial('EM PRODUÇÃO')).toBe(false)
    expect(permiteEdicaoAdministrativa('EM PRODUÇÃO')).toBe(true)
    expect(permiteEdicaoAdministrativa('RECEBIDO')).toBe(false)
    expect(permiteEdicaoAdministrativa('CANCELADO')).toBe(false)
  })

  it('aplica as operacoes e a contabilizacao de anexos por status', () => {
    expect(operacoesAnexoGestao('EM PRODUÇÃO')).toEqual({ abrir: true, adicionar: true, substituir: false, remover: false, contabilizar: true })
    expect(operacoesAnexoGestao('RECEBIDO')).toEqual({ abrir: true, adicionar: true, substituir: false, remover: false, contabilizar: false })
    expect(operacoesAnexoGestao('CANCELADO')).toEqual({ abrir: true, adicionar: false, substituir: false, remover: false, contabilizar: false })
  })
})
