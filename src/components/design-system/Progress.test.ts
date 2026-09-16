import { describe, expect, it } from 'vitest'
import { clampProgress, progressToneClass } from './Progress'

describe('clampProgress', () => {
  it('mantém percentuais válidos', () => {
    expect(clampProgress(42)).toBe(42)
  })

  it('limita valores fora da faixa de 0 a 100', () => {
    expect(clampProgress(-5)).toBe(0)
    expect(clampProgress(120)).toBe(100)
  })
})

describe('progressToneClass', () => {
  it('mapeia brand (default) para a mesma cor de marca usada antes da prop existir', () => {
    expect(progressToneClass('brand')).toBe('bg-primary')
  })

  it('mapeia success/warning/neutral para as cores semânticas correspondentes', () => {
    expect(progressToneClass('success')).toBe('bg-emerald-500')
    expect(progressToneClass('warning')).toBe('bg-amber-400')
    expect(progressToneClass('neutral')).toBe('bg-slate-300')
  })
})
