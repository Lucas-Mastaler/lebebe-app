import { describe, expect, it } from 'vitest'
import { dateToBr, dateToIso, formatDateBr, parseBrDate, validateDateRange, validateSingleDate } from './dates'

describe('formatDateBr (digitação manual, DAT=A)', () => {
  it('formata progressivamente enquanto digita', () => {
    expect(formatDateBr('1')).toBe('1')
    expect(formatDateBr('12')).toBe('12')
    expect(formatDateBr('120')).toBe('12/0')
    expect(formatDateBr('12092026')).toBe('12/09/2026')
  })
})

describe('parseBrDate', () => {
  it('converte dd/mm/aaaa completo em Date', () => {
    const d = parseBrDate('12/09/2026')
    expect(d).not.toBeNull()
    expect(dateToIso(d!)).toBe('2026-09-12')
  })

  it('retorna null para datas incompletas ou inexistentes', () => {
    expect(parseBrDate('12/09')).toBeNull()
    expect(parseBrDate('31/02/2026')).toBeNull() // fevereiro não tem dia 31
    expect(parseBrDate('12/13/2026')).toBeNull() // mês 13 não existe
  })

  it('dateToBr é o inverso de parseBrDate', () => {
    const d = parseBrDate('05/01/2026')!
    expect(dateToBr(d)).toBe('05/01/2026')
  })
})

describe('validateSingleDate', () => {
  it('campo vazio é válido (obrigatoriedade é responsabilidade do FormField/REQ)', () => {
    expect(validateSingleDate('').ok).toBe(true)
  })

  it('data mal formada é inválida', () => {
    const result = validateSingleDate('31/02/2026')
    expect(result.ok).toBe(false)
    expect(result.message).toBe('Data inválida.')
  })

  it('respeita limites mínimo e máximo quando fornecidos', () => {
    const min = new Date(2026, 0, 1)
    const max = new Date(2026, 11, 31)
    expect(validateSingleDate('15/06/2026', { min, max }).ok).toBe(true)
    expect(validateSingleDate('01/01/2020', { min, max }).ok).toBe(false)
    expect(validateSingleDate('01/01/2030', { min, max }).ok).toBe(false)
  })
})

describe('validateDateRange', () => {
  it('rejeita data final anterior à inicial', () => {
    const result = validateDateRange('10/09/2026', '05/09/2026')
    expect(result.ok).toBe(false)
    expect(result.message).toBe('A data final não pode ser anterior à data inicial.')
  })

  it('aceita período com data final igual ou posterior à inicial', () => {
    expect(validateDateRange('05/09/2026', '05/09/2026').ok).toBe(true)
    expect(validateDateRange('05/09/2026', '10/09/2026').ok).toBe(true)
  })
})
