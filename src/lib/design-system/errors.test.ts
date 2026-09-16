import { describe, expect, it } from 'vitest'
import { buildErrorSummary, hasFieldErrors, serverErrorMessage } from './errors'

describe('buildErrorSummary / hasFieldErrors (ERR — resumo no topo + inline)', () => {
  it('não aparece nada quando não há erros', () => {
    expect(buildErrorSummary({ nome: undefined, telefone: undefined })).toEqual([])
    expect(hasFieldErrors({ nome: undefined })).toBe(false)
  })

  it('lista todos os campos com erro simultaneamente', () => {
    const summary = buildErrorSummary({ nome: 'Campo obrigatório.', telefone: 'Formato inválido.', email: undefined })
    expect(summary).toEqual([
      { field: 'nome', message: 'Campo obrigatório.' },
      { field: 'telefone', message: 'Formato inválido.' },
    ])
    expect(hasFieldErrors({ nome: 'Campo obrigatório.' })).toBe(true)
  })
})

describe('serverErrorMessage (erro de servidor ≠ erro de campo)', () => {
  it('nunca expõe detalhe técnico por padrão', () => {
    expect(serverErrorMessage('salvar as alterações')).toBe('Não foi possível salvar as alterações. Tente novamente.')
  })

  it('só inclui detalhe quando explicitamente marcado como seguro', () => {
    expect(serverErrorMessage('salvar', 'O pedido já foi removido por outro usuário.')).toBe(
      'Não foi possível salvar. Tente novamente. O pedido já foi removido por outro usuário.'
    )
  })
})
