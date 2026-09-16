import { describe, expect, it } from 'vitest'
import { toggleMultiSelectValue } from './multi-select'

describe('toggleMultiSelectValue', () => {
  it('adiciona e remove opções sem afetar as demais seleções', () => {
    expect(toggleMultiSelectValue(['Bigorrilho', 'Feira'], 'Marechal')).toEqual(['Bigorrilho', 'Feira', 'Marechal'])
    expect(toggleMultiSelectValue(['Bigorrilho', 'Feira'], 'Feira')).toEqual(['Bigorrilho'])
  })
})
