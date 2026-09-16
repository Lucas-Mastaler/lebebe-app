import { describe, expect, it } from 'vitest'
import { createInitialFilterState, filterReducer, isDirty } from './filters'

interface Filtros {
  cliente: string
  status: string
}

const vazio: Filtros = { cliente: '', status: 'todos' }

describe('filterReducer (FLT-EXEC=MANUAL + FLT-CLR=C)', () => {
  it('SET_FIELD altera o draft mas nunca o applied — alterar filtro não consulta', () => {
    const state = createInitialFilterState(vazio)
    const afterChange = filterReducer(state, { type: 'SET_FIELD', field: 'cliente', value: 'Ana' })
    expect(afterChange.draft.cliente).toBe('Ana')
    expect(afterChange.applied.cliente).toBe('') // nada mudou no aplicado
  })

  it('vários SET_FIELD seguidos continuam sem tocar o applied', () => {
    let state = createInitialFilterState(vazio)
    state = filterReducer(state, { type: 'SET_FIELD', field: 'cliente', value: 'Ana' })
    state = filterReducer(state, { type: 'SET_FIELD', field: 'status', value: 'producao' })
    expect(state.applied).toEqual(vazio)
  })

  it('APPLY (clicar em Filtrar) promove o draft para applied', () => {
    let state = createInitialFilterState(vazio)
    state = filterReducer(state, { type: 'SET_FIELD', field: 'cliente', value: 'Ana' })
    state = filterReducer(state, { type: 'APPLY' })
    expect(state.applied.cliente).toBe('Ana')
  })

  it('CLEAR (FLT-CLR=C) zera draft e applied imediatamente', () => {
    let state = createInitialFilterState(vazio)
    state = filterReducer(state, { type: 'SET_FIELD', field: 'cliente', value: 'Ana' })
    state = filterReducer(state, { type: 'APPLY' })
    state = filterReducer(state, { type: 'CLEAR', emptyValues: vazio })
    expect(state.draft).toEqual(vazio)
    expect(state.applied).toEqual(vazio)
  })

  it('isDirty reflete se há alteração não aplicada', () => {
    let state = createInitialFilterState(vazio)
    expect(isDirty(state)).toBe(false)
    state = filterReducer(state, { type: 'SET_FIELD', field: 'cliente', value: 'Ana' })
    expect(isDirty(state)).toBe(true)
    state = filterReducer(state, { type: 'APPLY' })
    expect(isDirty(state)).toBe(false)
  })
})
