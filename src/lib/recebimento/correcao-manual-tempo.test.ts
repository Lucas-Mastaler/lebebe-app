import { describe, expect, it } from 'vitest'
import { LIMITE_TEMPO_RECEBIMENTO_SEGUNDOS } from './metricas-tempo'
import { precisaCorrecaoManual, validarCorrecaoManual } from './correcao-manual-tempo'

describe('precisaCorrecaoManual', () => {
  it.each([
    [8 * 3600, false],
    [LIMITE_TEMPO_RECEBIMENTO_SEGUNDOS, false], // exatamente 12h — normal
    [LIMITE_TEMPO_RECEBIMENTO_SEGUNDOS + 1, true], // 12h + 1s — exige fallback
    [18 * 3600, true],
    [3 * 24 * 3600, true],
  ])('%d segundos automáticos -> precisa de correção = %s', (segundos, esperado) => {
    expect(precisaCorrecaoManual(segundos)).toBe(esperado)
  })
})

describe('validarCorrecaoManual', () => {
  it('rejeita sem início', () => {
    const r = validarCorrecaoManual({ inicio: null, fim: '2026-01-01T15:00:00Z' })
    expect(r.valido).toBe(false)
  })

  it('rejeita sem fim', () => {
    const r = validarCorrecaoManual({ inicio: '2026-01-01T08:00:00Z', fim: null })
    expect(r.valido).toBe(false)
  })

  it('rejeita fim anterior ao início', () => {
    const r = validarCorrecaoManual({ inicio: '2026-01-01T15:00:00Z', fim: '2026-01-01T08:00:00Z' })
    expect(r.valido).toBe(false)
  })

  it('rejeita início = fim (duração zero)', () => {
    const r = validarCorrecaoManual({ inicio: '2026-01-01T08:00:00Z', fim: '2026-01-01T08:00:00Z' })
    expect(r.valido).toBe(false)
  })

  it('rejeita datas inválidas', () => {
    const r = validarCorrecaoManual({ inicio: 'não é uma data', fim: '2026-01-01T08:00:00Z' })
    expect(r.valido).toBe(false)
  })

  it('aceita duração manual de 8h', () => {
    const r = validarCorrecaoManual({ inicio: '2026-01-01T08:00:00Z', fim: '2026-01-01T16:00:00Z' })
    expect(r.valido).toBe(true)
    if (r.valido) expect(r.segundos).toBe(8 * 3600)
  })

  it('aceita exatamente 12h manuais', () => {
    const r = validarCorrecaoManual({ inicio: '2026-01-01T08:00:00Z', fim: '2026-01-01T20:00:00Z' })
    expect(r.valido).toBe(true)
    if (r.valido) expect(r.segundos).toBe(LIMITE_TEMPO_RECEBIMENTO_SEGUNDOS)
  })

  it('rejeita duração manual acima de 12h — o fallback não pode aceitar outro valor irreal', () => {
    const r = validarCorrecaoManual({ inicio: '2026-01-01T08:00:00Z', fim: '2026-01-01T20:00:01Z' })
    expect(r.valido).toBe(false)
  })

  it('exemplo do pedido: início 08:00, fim 15:30 -> 7h30', () => {
    const r = validarCorrecaoManual({ inicio: '2026-01-01T08:00:00Z', fim: '2026-01-01T15:30:00Z' })
    expect(r.valido).toBe(true)
    if (r.valido) expect(r.segundos).toBe(7.5 * 3600)
  })
})
