import { describe, expect, it } from 'vitest'
import { isUuidList } from './usuarios'

describe('isUuidList', () => {
  it('aceita lista de strings nao vazias', () => {
    expect(isUuidList(['unidade-1', 'unidade-2'])).toBe(true)
  })

  it('rejeita valores que nao sao listas de strings', () => {
    expect(isUuidList('unidade-1')).toBe(false)
    expect(isUuidList(['unidade-1', ''])).toBe(false)
    expect(isUuidList(['unidade-1', 10])).toBe(false)
  })
})
