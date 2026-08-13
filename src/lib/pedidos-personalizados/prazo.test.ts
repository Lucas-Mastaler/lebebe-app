import { describe, expect, it } from 'vitest'
import { adicionarDiasIso, classificarSituacaoPrazo } from './prazo'

describe('prazo de pedido personalizado', () => {
  it.each([
    ['2026-08-16', 'NO PRAZO'],
    ['2026-08-15', 'PRESTES A VENCER'],
    ['2026-08-08', 'PRESTES A VENCER'],
    ['2026-08-07', 'ATRASADO'],
  ] as const)('classifica %s', (data, esperado) => {
    expect(classificarSituacaoPrazo(data, 'EM PRODUÇÃO', '2026-08-08')).toBe(esperado)
  })

  it('não classifica sem previsão ou em estado final', () => {
    expect(classificarSituacaoPrazo(null, 'RASCUNHO', '2026-08-08')).toBeNull()
    expect(classificarSituacaoPrazo('2026-08-01', 'RECEBIDO', '2026-08-08')).toBeNull()
    expect(classificarSituacaoPrazo('2026-08-01', 'CANCELADO', '2026-08-08')).toBeNull()
  })

  it('soma dias sem depender do fuso do processo', () => {
    expect(adicionarDiasIso('2026-12-28', 7)).toBe('2027-01-04')
  })
})
