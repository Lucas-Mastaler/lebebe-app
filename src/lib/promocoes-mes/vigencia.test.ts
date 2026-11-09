import { describe, expect, it } from 'vitest'
import { classificarVigencia, dataIsoValida, hojeOperacional } from './vigencia'

describe('vigência de promoções', () => {
  it('é inclusiva no início e no fim', () => {
    expect(classificarVigencia('2026-11-10', '2026-11-20', '2026-11-10')).toBe('VIGENTE')
    expect(classificarVigencia('2026-11-10', '2026-11-20', '2026-11-20')).toBe('VIGENTE')
    expect(classificarVigencia('2026-11-10', '2026-11-20', '2026-11-09')).toBe('FUTURA')
    expect(classificarVigencia('2026-11-10', '2026-11-20', '2026-11-21')).toBe('ENCERRADA')
  })

  it('promoção de um dia só é vigente naquele dia', () => {
    expect(classificarVigencia('2026-11-10', '2026-11-10', '2026-11-10')).toBe('VIGENTE')
  })

  it('usa a data de São Paulo na virada do dia (23:59 → 00:00)', () => {
    // 2026-11-10 23:59 BRT = 2026-11-11T02:59Z ; 00:00 BRT = 03:00Z
    expect(hojeOperacional(new Date('2026-11-11T02:59:00Z'))).toBe('2026-11-10')
    expect(hojeOperacional(new Date('2026-11-11T03:00:00Z'))).toBe('2026-11-11')
    const fim = '2026-11-10'
    expect(classificarVigencia('2026-11-01', fim, hojeOperacional(new Date('2026-11-11T02:59:00Z')))).toBe('VIGENTE')
    expect(classificarVigencia('2026-11-01', fim, hojeOperacional(new Date('2026-11-11T03:00:00Z')))).toBe('ENCERRADA')
  })

  it('valida datas ISO reais', () => {
    expect(dataIsoValida('2026-02-28')).toBe(true)
    expect(dataIsoValida('2026-02-30')).toBe(false)
    expect(dataIsoValida('10/11/2026')).toBe(false)
    expect(dataIsoValida(null)).toBe(false)
  })
})
