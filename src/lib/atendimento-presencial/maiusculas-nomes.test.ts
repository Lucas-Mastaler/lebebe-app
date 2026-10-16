import { describe, expect, it } from 'vitest'
import { maiusculasNomeComCursor } from './maiusculas-nomes'

describe('nomes em maiúsculas com posição de edição', () => {
  it('preserva acentos e ajusta o cursor ao inserir texto no meio', () => {
    expect(maiusculasNomeComCursor('João pedro', 5, 10)).toEqual({ valor: 'JOÃO PEDRO', inicio: 5, fim: 10 })
  })

  it('mapeia a seleção quando a caixa alta expande caracteres', () => {
    expect(maiusculasNomeComCursor('aßb', 2, 3)).toEqual({ valor: 'ASSB', inicio: 3, fim: 4 })
  })
})
