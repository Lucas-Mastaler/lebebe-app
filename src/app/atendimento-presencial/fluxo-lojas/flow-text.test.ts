import { describe, expect, it } from 'vitest'
import { adjustedTotal } from './flow-text'

describe('total ajustado diário', () => {
  it('soma lojas e dias, inclusive zeros', () => {
    expect(adjustedTotal([{ ajustado: 3 }, { ajustado: 0 }, { ajustado: 2 }])).toBe(5)
  })
  it('não apresenta total parcial como completo', () => {
    expect(adjustedTotal([{ ajustado: 3 }, { ajustado: null }])).toBeNull()
    expect(adjustedTotal([])).toBeNull()
  })
})
