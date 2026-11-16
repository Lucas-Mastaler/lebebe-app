import { describe, it, expect } from 'vitest'
import { validarDuracaoManual } from './correcao-manual-tempo'
describe('duração manual', () => {
  it('aceita duração positiva até 12 horas', () => {
    expect(validarDuracaoManual(5400)).toEqual({ valido: true, segundos: 5400 })
    expect(validarDuracaoManual(43200).valido).toBe(true)
  })
  it.each([0, -1, 43201, 1.5, '60', null])('rejeita %s', valor => {
    expect(validarDuracaoManual(valor).valido).toBe(false)
  })
})
