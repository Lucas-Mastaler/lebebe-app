// ─────────────────────────────────────────────────────────────────────────────
// motor/tempo.test.ts  —  Testes unitários para conversões de tempo
//
// Cobre os comportamentos de:
//   - parseMinutos()       (paridade com parseMinutes do Apps Script)
//   - formatarMinutos()    (paridade com _fmtHHMMFromAny_ do Apps Script)
//   - adicionarMinutosHHMM() (paridade com _addMinHHMM_ do Apps Script)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { parseMinutos, formatarMinutos, adicionarMinutosHHMM } from './tempo'

// ─── parseMinutos ────────────────────────────────────────────────────────────

describe('parseMinutos', () => {
  it('string vazia → 0', () => {
    expect(parseMinutos('')).toBe(0)
  })

  it('null → 0', () => {
    expect(parseMinutos(null)).toBe(0)
  })

  it('undefined → 0', () => {
    expect(parseMinutos(undefined)).toBe(0)
  })

  it('zero → 0', () => {
    expect(parseMinutos(0)).toBe(0)
  })

  it('formato HH:MM → minutos', () => {
    expect(parseMinutos('02:30')).toBe(150)
  })

  it('formato H:MM → minutos', () => {
    expect(parseMinutos('2:30')).toBe(150)
  })

  it('meia-noite → 0', () => {
    expect(parseMinutos('00:00')).toBe(0)
  })

  it('uma hora → 60', () => {
    expect(parseMinutos('01:00')).toBe(60)
  })

  it('Date nativo → horas*60 + minutos', () => {
    const d = new Date('2024-01-01T14:45:00')
    expect(parseMinutos(d)).toBe(14 * 60 + 45)
  })

  it('número (fração de dia) → Math.round(t * 24 * 60)', () => {
    // 0.1 dia = 2.4h = 144min
    expect(parseMinutos(0.1)).toBe(Math.round(0.1 * 24 * 60))
    // 0.5 dia = 12h = 720min
    expect(parseMinutos(0.5)).toBe(720)
    // 1.0 dia = 24h = 1440min
    expect(parseMinutos(1)).toBe(1440)
  })

  it('string com apenas horas → 0 (formato inválido, sem minutos)', () => {
    expect(parseMinutos('5')).toBe(0)
  })

  it('string com mais de dois segmentos → 0 (formato inválido)', () => {
    expect(parseMinutos('01:30:45')).toBe(0)
  })

  it('string inválida → 0', () => {
    expect(parseMinutos('abc')).toBe(0)
  })

  it('boolean true → 0 (coerção)', () => {
    expect(parseMinutos(true as unknown as string)).toBe(0)
  })

  it('formato sem minutos → 0', () => {
    expect(parseMinutos('2:')).toBe(0)
  })

  it('formato sem horas → 0', () => {
    expect(parseMinutos(':05')).toBe(0)
  })

  it('minutos inválidos > 59 → 0', () => {
    expect(parseMinutos('99:99')).toBe(0)
  })

  it('minutos negativos → 0', () => {
    expect(parseMinutos('-1:30')).toBe(0)
  })

  it('casos válidos da tela real: 2:05 → 125', () => {
    expect(parseMinutos('2:05')).toBe(125)
  })

  it('casos válidos da tela real: 02:05 → 125', () => {
    expect(parseMinutos('02:05')).toBe(125)
  })

  it('casos válidos da tela real: 0:40 → 40', () => {
    expect(parseMinutos('0:40')).toBe(40)
  })

  it('casos válidos da tela real: 00:40 → 40', () => {
    expect(parseMinutos('00:40')).toBe(40)
  })
})

// ─── formatarMinutos ───────────────────────────────────────────────────────────

describe('formatarMinutos', () => {
  it('string HH:MM já válida → HH:MM com padStart', () => {
    expect(formatarMinutos('2:30')).toBe('02:30')
    expect(formatarMinutos('14:05')).toBe('14:05')
  })

  it('string inválida → " "', () => {
    expect(formatarMinutos('abc')).toBe('')
  })

  it('string vazia → "00:00" (Number("") = 0)', () => {
    expect(formatarMinutos('')).toBe('00:00')
  })

  it('Date nativo → HH:MM UTC', () => {
    const d = new Date('2024-01-01T14:45:00Z')
    expect(formatarMinutos(d)).toBe('14:45')
  })

  it('número (minutos) → HH:MM', () => {
    expect(formatarMinutos(150)).toBe('02:30')
    expect(formatarMinutos(0)).toBe('00:00')
    expect(formatarMinutos(60)).toBe('01:00')
    expect(formatarMinutos(1440)).toBe('24:00')
  })

  it('número negativo → " "', () => {
    expect(formatarMinutos(-10)).toBe('')
  })

  it('null → "00:00" (Number(null) = 0)', () => {
    expect(formatarMinutos(null)).toBe('00:00')
  })

  it('undefined → " "', () => {
    expect(formatarMinutos(undefined)).toBe('')
  })
})

// ─── adicionarMinutosHHMM ─────────────────────────────────────────────────────

describe('adicionarMinutosHHMM', () => {
  it('adiciona minutos a HH:MM', () => {
    expect(adicionarMinutosHHMM('02:30', 10)).toBe('2:40')
  })

  it('adiciona zero → mesmo horário', () => {
    expect(adicionarMinutosHHMM('02:30', 0)).toBe('2:30')
  })

  it('adiciona para próxima hora', () => {
    expect(adicionarMinutosHHMM('02:50', 20)).toBe('3:10')
  })

  it('adiciona para próximo dia', () => {
    expect(adicionarMinutosHHMM('23:50', 20)).toBe('24:10')
  })

  it('subtrai minutos', () => {
    expect(adicionarMinutosHHMM('02:30', -10)).toBe('2:20')
  })

  it('subtrai abaixo de zero → trunca em 00:00', () => {
    expect(adicionarMinutosHHMM('00:10', -20)).toBe('0:00')
  })

  it('formato inválido → retorna string original', () => {
    expect(adicionarMinutosHHMM('abc', 10)).toBe('abc')
  })

  it('string vazia → retorna vazia', () => {
    expect(adicionarMinutosHHMM('', 10)).toBe('')
  })

  it('add não-numérico → trata como 0', () => {
    expect(adicionarMinutosHHMM('02:30', NaN)).toBe('2:30')
  })
})
