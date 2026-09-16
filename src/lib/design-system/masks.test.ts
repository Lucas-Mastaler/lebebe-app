import { describe, expect, it } from 'vitest'
import { formatCep, formatCnpj, formatCpf, formatCurrencyFromCents, formatPhone, onlyDigits, parseCurrencyToCents } from './masks'

describe('masks (MSK=C — formatação progressiva)', () => {
  it('formatCpf aplica pontuação conforme os dígitos avançam', () => {
    expect(formatCpf('123')).toBe('123')
    expect(formatCpf('123456')).toBe('123.456')
    expect(formatCpf('12345678900')).toBe('123.456.789-00')
  })

  it('formatCpf normaliza valor colado já formatado', () => {
    expect(formatCpf('123.456.789-00')).toBe('123.456.789-00')
  })

  it('formatCnpj formata progressivamente', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('formatPhone formata celular com DDD', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
  })

  it('formatCep formata em dois blocos', () => {
    expect(formatCep('01310100')).toBe('01310-100')
  })

  it('onlyDigits remove toda formatação', () => {
    expect(onlyDigits('123.456.789-00')).toBe('12345678900')
  })

  it('moeda: formatCurrencyFromCents e parseCurrencyToCents são inversos', () => {
    expect(formatCurrencyFromCents('12345')).toBe('R$ 123,45')
    expect(parseCurrencyToCents('R$ 123,45')).toBe(12345)
  })
})
