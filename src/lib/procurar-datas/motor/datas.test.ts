// ─────────────────────────────────────────────────────────────────────────────
// motor/datas.test.ts  —  Testes unitários para helpers de data
//
// Cobre os comportamentos de diffDias() e adicionarDias()
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { diffDias, adicionarDias } from './datas'

describe('diffDias', () => {
  it('mesmo dia → 0', () => {
    const d1 = new Date('2024-01-01T00:00:00')
    const d2 = new Date('2024-01-01T00:00:00')
    expect(diffDias(d1, d2)).toBe(0)
  })

  it('diferença de 1 dia → 1', () => {
    const d1 = new Date('2024-01-01T00:00:00')
    const d2 = new Date('2024-01-02T00:00:00')
    expect(diffDias(d1, d2)).toBe(1)
  })

  it('diferença de 7 dias → 7', () => {
    const d1 = new Date('2024-01-01T00:00:00')
    const d2 = new Date('2024-01-08T00:00:00')
    expect(diffDias(d1, d2)).toBe(7)
  })

  it('ordem inversa → valor absoluto', () => {
    const d1 = new Date('2024-01-08T00:00:00')
    const d2 = new Date('2024-01-01T00:00:00')
    expect(diffDias(d1, d2)).toBe(7)
  })

  it('diferença com horas → arredonda', () => {
    const d1 = new Date('2024-01-01T00:00:00')
    const d2 = new Date('2024-01-02T12:00:00') // 36h = 1.5 dias
    expect(diffDias(d1, d2)).toBe(2)
  })

  it('diferença menor que 12h → arredonda para 0', () => {
    const d1 = new Date('2024-01-01T00:00:00')
    const d2 = new Date('2024-01-01T11:00:00') // 11h
    expect(diffDias(d1, d2)).toBe(0)
  })
})

describe('adicionarDias', () => {
  it('adiciona 0 dias → mesma data', () => {
    const d = new Date('2024-01-01T00:00:00')
    const result = adicionarDias(d, 0)
    expect(result.getTime()).toBe(d.getTime())
  })

  it('adiciona 1 dia', () => {
    const d = new Date('2024-01-01T00:00:00')
    const result = adicionarDias(d, 1)
    expect(result.getDate()).toBe(2)
    expect(result.getMonth()).toBe(0)
    expect(result.getFullYear()).toBe(2024)
  })

  it('adiciona 7 dias', () => {
    const d = new Date('2024-01-01T00:00:00')
    const result = adicionarDias(d, 7)
    expect(result.getDate()).toBe(8)
  })

  it('adiciona dias cruzando mês', () => {
    const d = new Date('2024-01-30T00:00:00')
    const result = adicionarDias(d, 2)
    expect(result.getDate()).toBe(1)
    expect(result.getMonth()).toBe(1) // fevereiro
  })

  it('adiciona dias cruzando ano', () => {
    const d = new Date('2024-12-30T00:00:00')
    const result = adicionarDias(d, 5)
    expect(result.getDate()).toBe(4)
    expect(result.getMonth()).toBe(0)
    expect(result.getFullYear()).toBe(2025)
  })

  it('retorna nova data (imutável)', () => {
    const d = new Date('2024-01-01T00:00:00')
    const originalTime = d.getTime()
    adicionarDias(d, 5)
    expect(d.getTime()).toBe(originalTime)
  })

  it('adiciona dias negativos', () => {
    const d = new Date('2024-01-05T00:00:00')
    const result = adicionarDias(d, -2)
    expect(result.getDate()).toBe(3)
  })
})
