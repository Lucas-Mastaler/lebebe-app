// ─────────────────────────────────────────────────────────────────────────────
// motor/equipe.test.ts  —  Testes unitários para normalização de equipe
//
// Cobre os comportamentos de normalizarEquipe() (paridade com normTeam do Apps Script)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { normalizarEquipe } from './equipe'

describe('normalizarEquipe', () => {
  // EQUIPE 1
  it('EQUIPE 1 → EQUIPE 1', () => {
    expect(normalizarEquipe('EQUIPE 1')).toBe('EQUIPE 1')
  })

  it('EQUIPE 01 → EQUIPE 1', () => {
    expect(normalizarEquipe('EQUIPE 01')).toBe('EQUIPE 1')
  })

  it('EQUIPE1 → EQUIPE 1', () => {
    expect(normalizarEquipe('EQUIPE1')).toBe('EQUIPE 1')
  })

  it('EQP 1 → EQUIPE 1', () => {
    expect(normalizarEquipe('EQP 1')).toBe('EQUIPE 1')
  })

  it('EQP 01 → EQUIPE 1', () => {
    expect(normalizarEquipe('EQP 01')).toBe('EQUIPE 1')
  })

  it('EQP1 → EQUIPE 1', () => {
    expect(normalizarEquipe('EQP1')).toBe('EQUIPE 1')
  })

  it('equipe 1 → EQUIPE 1 (case-insensitive)', () => {
    expect(normalizarEquipe('equipe 1')).toBe('EQUIPE 1')
  })

  it('Equipe 1 → EQUIPE 1 (case-insensitive)', () => {
    expect(normalizarEquipe('Equipe 1')).toBe('EQUIPE 1')
  })

  it('eqp 1 → EQUIPE 1 (case-insensitive)', () => {
    expect(normalizarEquipe('eqp 1')).toBe('EQUIPE 1')
  })

  // EQUIPE 2
  it('EQUIPE 2 → EQUIPE 2', () => {
    expect(normalizarEquipe('EQUIPE 2')).toBe('EQUIPE 2')
  })

  it('EQUIPE 02 → EQUIPE 2', () => {
    expect(normalizarEquipe('EQUIPE 02')).toBe('EQUIPE 2')
  })

  it('EQUIPE2 → EQUIPE 2', () => {
    expect(normalizarEquipe('EQUIPE2')).toBe('EQUIPE 2')
  })

  it('EQP 2 → EQUIPE 2', () => {
    expect(normalizarEquipe('EQP 2')).toBe('EQUIPE 2')
  })

  it('EQP 02 → EQUIPE 2', () => {
    expect(normalizarEquipe('EQP 02')).toBe('EQUIPE 2')
  })

  it('EQP2 → EQUIPE 2', () => {
    expect(normalizarEquipe('EQP2')).toBe('EQUIPE 2')
  })

  it('equipe 2 → EQUIPE 2 (case-insensitive)', () => {
    expect(normalizarEquipe('equipe 2')).toBe('EQUIPE 2')
  })

  it('eqp 2 → EQUIPE 2 (case-insensitive)', () => {
    expect(normalizarEquipe('eqp 2')).toBe('EQUIPE 2')
  })

  // Não bate com padrão
  it('texto sem equipe → null', () => {
    expect(normalizarEquipe('abc')).toBe(null)
  })

  it('string vazia → null', () => {
    expect(normalizarEquipe('')).toBe(null)
  })

  it('null → null', () => {
    expect(normalizarEquipe(null)).toBe(null)
  })

  it('undefined → null', () => {
    expect(normalizarEquipe(undefined)).toBe(null)
  })

  it('número → null (String(number) não bate regex)', () => {
    expect(normalizarEquipe(1)).toBe(null)
  })

  it('EQUIPE 3 → null', () => {
    expect(normalizarEquipe('EQUIPE 3')).toBe(null)
  })

  it('EQP 3 → null', () => {
    expect(normalizarEquipe('EQP 3')).toBe(null)
  })

  it('EQUIPE → null (sem número)', () => {
    expect(normalizarEquipe('EQUIPE')).toBe(null)
  })

  it('EQP → null (sem número)', () => {
    expect(normalizarEquipe('EQP')).toBe(null)
  })
})
