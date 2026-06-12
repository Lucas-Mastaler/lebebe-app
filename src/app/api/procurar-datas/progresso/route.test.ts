import { describe, expect, it } from 'vitest'
import {
  getProgressoTimeoutMs,
  PROGRESS_CAPTURE_TIMEOUT_MS,
  PROGRESS_TIMEOUT_MS,
} from './route'

describe('getProgressoTimeoutMs', () => {
  it('preserva o timeout padrao sem modoCaptura', () => {
    expect(getProgressoTimeoutMs(new URLSearchParams('clientToken=fixture-1'))).toBe(PROGRESS_TIMEOUT_MS)
  })

  it('usa timeout maior com modoCaptura=1', () => {
    expect(getProgressoTimeoutMs(new URLSearchParams('clientToken=fixture-1&modoCaptura=1'))).toBe(PROGRESS_CAPTURE_TIMEOUT_MS)
  })

  it('nao ativa modo captura com query param invalido', () => {
    expect(getProgressoTimeoutMs(new URLSearchParams('clientToken=fixture-1&modoCaptura=true'))).toBe(PROGRESS_TIMEOUT_MS)
  })
})
