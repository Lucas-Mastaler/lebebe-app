import { describe, expect, it } from 'vitest'
import { nomeClienteRascunho, nomeConsultoraRascunho } from './rascunho-display'

describe('exibicao de rascunhos', () => {
  it('usa fallback para cliente ausente', () => {
    expect(nomeClienteRascunho(null)).toBe('Cliente ainda não informado')
    expect(nomeClienteRascunho('  ')).toBe('Cliente ainda não informado')
  })

  it('usa o nome da cliente quando informado', () => {
    expect(nomeClienteRascunho(' Mariana Souza ')).toBe('Mariana Souza')
  })

  it('usa fallback para consultora ausente', () => {
    expect(nomeConsultoraRascunho(undefined)).toBe('Consultora não identificada')
  })

  it('usa o email quando ele é o nome resolvido', () => {
    expect(nomeConsultoraRascunho('consultora@example.com')).toBe('consultora@example.com')
  })
})
