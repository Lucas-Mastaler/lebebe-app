import { describe, expect, it } from 'vitest'
import { asyncActionReducer, initialAsyncActionState, isBlocked } from './async-action'

describe('asyncActionReducer (SAV=A com ajuste — loading bloqueia reenvio)', () => {
  it('começa idle e não bloqueado', () => {
    expect(isBlocked(initialAsyncActionState)).toBe(false)
  })

  it('START entra em loading e fica bloqueado', () => {
    const state = asyncActionReducer(initialAsyncActionState, { type: 'START' })
    expect(state.status).toBe('loading')
    expect(isBlocked(state)).toBe(true)
  })

  it('um segundo START enquanto já está loading é ignorado (previne duplo clique)', () => {
    const loading = asyncActionReducer(initialAsyncActionState, { type: 'START' })
    const stillLoading = asyncActionReducer(loading, { type: 'START' })
    expect(stillLoading).toEqual(loading)
    expect(stillLoading.status).toBe('loading')
  })

  it('SUCCESS só some efeito vindo de loading, e libera o bloqueio', () => {
    const loading = asyncActionReducer(initialAsyncActionState, { type: 'START' })
    const done = asyncActionReducer(loading, { type: 'SUCCESS' })
    expect(done.status).toBe('success')
    expect(isBlocked(done)).toBe(false)
  })

  it('ERROR libera o bloqueio para nova tentativa', () => {
    const loading = asyncActionReducer(initialAsyncActionState, { type: 'START' })
    const failed = asyncActionReducer(loading, { type: 'ERROR' })
    expect(failed.status).toBe('error')
    expect(isBlocked(failed)).toBe(false)
  })

  it('SUCCESS/ERROR sem START prévio (fora de loading) não faz nada', () => {
    expect(asyncActionReducer(initialAsyncActionState, { type: 'SUCCESS' })).toEqual(initialAsyncActionState)
    expect(asyncActionReducer(initialAsyncActionState, { type: 'ERROR' })).toEqual(initialAsyncActionState)
  })

  it('RESET sempre volta para idle', () => {
    const loading = asyncActionReducer(initialAsyncActionState, { type: 'START' })
    expect(asyncActionReducer(loading, { type: 'RESET' })).toEqual(initialAsyncActionState)
  })
})
