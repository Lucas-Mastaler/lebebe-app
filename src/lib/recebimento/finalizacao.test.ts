import { describe, expect, it } from 'vitest'
import { registroPodeFinalizar } from './finalizacao'

describe('registroPodeFinalizar', () => {
  const cenarios = [
    ['completo sem divergência', 5, 5, null, true],
    ['incompleto sem divergência', 3, 5, null, false],
    ['incompleto com faltou', 3, 5, 'faltou', true],
    ['incompleto com sobrou', 0, 5, 'sobrou', true],
    ['incompleto com avaria', 3, 5, 'avaria', true],
    ['tipo inválido', 3, 5, 'outro', false],
  ] as const

  it.each(cenarios)('%s', (_nome, recebidos, previstos, divergencia, esperado) => {
    expect(registroPodeFinalizar(recebidos, previstos, divergencia)).toBe(esperado)
  })
})
