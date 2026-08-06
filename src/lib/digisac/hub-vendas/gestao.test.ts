import { describe, it, expect } from 'vitest'
import {
  validarLimiteDiario,
  mascararTelefone,
  LIMITE_DIARIO_MAXIMO,
} from './gestao'

describe('validarLimiteDiario', () => {
  it('aceita valor inteiro positivo dentro do máximo', () => {
    const r = validarLimiteDiario(10)
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(10)
    expect(r.erro).toBeNull()
  })

  it('aceita zero', () => {
    const r = validarLimiteDiario(0)
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(0)
  })

  it('aceita valor igual ao máximo seguro', () => {
    const r = validarLimiteDiario(LIMITE_DIARIO_MAXIMO)
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(LIMITE_DIARIO_MAXIMO)
  })

  it('rejeita valor acima do máximo seguro', () => {
    const r = validarLimiteDiario(LIMITE_DIARIO_MAXIMO + 1)
    expect(r.ok).toBe(false)
    expect(r.valor).toBeNull()
    expect(r.erro).toContain('máximo')
  })

  it('rejeita valor negativo', () => {
    const r = validarLimiteDiario(-1)
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('negativo')
  })

  it('rejeita valor decimal', () => {
    const r = validarLimiteDiario(5.5)
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('inteiro')
  })

  it('rejeita NaN', () => {
    const r = validarLimiteDiario(NaN)
    expect(r.ok).toBe(false)
  })

  it('rejeita Infinity', () => {
    const r = validarLimiteDiario(Infinity)
    expect(r.ok).toBe(false)
  })

  it('aceita string numérica inteira positiva', () => {
    const r = validarLimiteDiario('15')
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(15)
  })

  it('rejeita string vazia', () => {
    const r = validarLimiteDiario('')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('vazio')
  })

  it('rejeita string apenas com espaços', () => {
    const r = validarLimiteDiario('   ')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('vazio')
  })

  it('rejeita string não numérica', () => {
    const r = validarLimiteDiario('abc')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('número inteiro')
  })

  it('rejeita string decimal', () => {
    const r = validarLimiteDiario('10.5')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('número inteiro')
  })

  it('rejeita string negativa', () => {
    const r = validarLimiteDiario('-5')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('negativo')
  })

  it('rejeita string acima do máximo', () => {
    const r = validarLimiteDiario(String(LIMITE_DIARIO_MAXIMO + 1))
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('máximo')
  })

  it('rejeita tipo inválido (objeto)', () => {
    const r = validarLimiteDiario({ valor: 10 })
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('Tipo')
  })

  it('rejeita tipo inválido (array)', () => {
    const r = validarLimiteDiario([10])
    expect(r.ok).toBe(false)
  })

  it('rejeita null', () => {
    const r = validarLimiteDiario(null)
    expect(r.ok).toBe(false)
  })

  it('rejeita undefined', () => {
    const r = validarLimiteDiario(undefined)
    expect(r.ok).toBe(false)
  })
})

describe('mascararTelefone', () => {
  it('retorna null para null', () => {
    expect(mascararTelefone(null)).toBeNull()
  })

  it('retorna null para string vazia', () => {
    expect(mascararTelefone('')).toBeNull()
  })

  it('mascara telefone brasileiro com DDI + DDD (12+ dígitos)', () => {
    const r = mascararTelefone('554184426528')
    expect(r).toBe('+55 41 ****-****')
  })

  it('mascara telefone com 10 dígitos', () => {
    const r = mascararTelefone('5541844265')
    expect(r).toBe('+55 ** ****-4265')
  })

  it('mascara telefone curto (8 dígitos)', () => {
    const r = mascararTelefone('84426528')
    expect(r).toBe('** ****-6528')
  })

  it('preserva apenas dígitos, ignorando formatação', () => {
    const r = mascararTelefone('+55 (41) 8442-6528')
    expect(r).toBe('+55 41 ****-****')
  })

  it('retorna *** para telefone muito curto', () => {
    const r = mascararTelefone('123')
    expect(r).toBe('***')
  })
})
