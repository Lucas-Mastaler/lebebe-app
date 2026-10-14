import { describe, expect, it } from 'vitest'
import { classificarEstadoRecalculoSlot } from './estado-recalculo-slot'

const completo = { fontesCompletas: true, disponibilidadeConfirmada: true, candidatoPresente: true,
  calculoOk: true, kmAdicionalNaRotaM: 38909, filtroEarlyDescartado: false, elegivel: true }

describe('estado da evidência do recálculo', () => {
  it('separa elegível, rejeitado e inconclusivo sem mudar a regra do motor', () => {
    expect(classificarEstadoRecalculoSlot(completo)).toBe('elegivel')
    expect(classificarEstadoRecalculoSlot({ ...completo, elegivel: false })).toBe('rejeitado')
    expect(classificarEstadoRecalculoSlot({ ...completo, elegivel: false, kmAdicionalNaRotaM: null })).toBe('inconclusivo')
  })
  it('reconhece rejeição early sem afirmar que a distância foi calculada', () => {
    expect(classificarEstadoRecalculoSlot({ ...completo, elegivel: false, kmAdicionalNaRotaM: null, filtroEarlyDescartado: true })).toBe('rejeitado')
  })
  it.each(['fontesCompletas', 'disponibilidadeConfirmada', 'candidatoPresente', 'calculoOk'] as const)('não conclui sem %s', (campo) => {
    expect(classificarEstadoRecalculoSlot({ ...completo, [campo]: false })).toBe('inconclusivo')
  })
})
