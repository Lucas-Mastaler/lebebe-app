import { describe, expect, it } from 'vitest'
import { resolveRowToneClass, type RowTone } from './row-tones'

const TONES: RowTone[] = ['dangerSubtle', 'danger', 'warning', 'success', 'info']

function extractPercents(cls: string): number[] {
  return [...cls.matchAll(/_(\d+)%,white/g)].map((m) => Number(m[1]))
}

describe('row-tones', () => {
  it('base and alternate differ for every tone (zebra survives inside a row-state)', () => {
    for (const tone of TONES) {
      expect(resolveRowToneClass(tone, 'base')).not.toBe(resolveRowToneClass(tone, 'alternate'))
    }
  })

  it('every variant is opaque — no Tailwind alpha shorthand (bg-token/N)', () => {
    for (const tone of TONES) {
      for (const parity of ['base', 'alternate'] as const) {
        const cls = resolveRowToneClass(tone, parity)
        expect(cls).not.toMatch(/bg-[a-z-]+\/\d/)
        expect(cls).toContain('color-mix(in_srgb')
        expect(cls).toContain('%,white)')
      }
    }
  })

  it('every variant resolves hover to a distinct, still-opaque surface', () => {
    for (const tone of TONES) {
      for (const parity of ['base', 'alternate'] as const) {
        const cls = resolveRowToneClass(tone, parity)
        expect(cls).toMatch(/hover:bg-\[color-mix\(in_srgb/)
        const percents = extractPercents(cls)
        expect(percents).toHaveLength(2)
        expect(percents[1]).toBeGreaterThan(percents[0])
      }
    }
  })

  it('dangerSubtle is lighter than danger at both parities', () => {
    for (const parity of ['base', 'alternate'] as const) {
      const subtlePct = extractPercents(resolveRowToneClass('dangerSubtle', parity))[0]
      const dangerPct = extractPercents(resolveRowToneClass('danger', parity))[0]
      expect(subtlePct).toBeLessThan(dangerPct)
    }
  })

  it('keeps the approved subtle-danger variants explicit for Tailwind scanning', () => {
    expect(resolveRowToneClass('dangerSubtle', 'base')).toBe(
      'bg-[color-mix(in_srgb,var(--destructive)_5%,white)] hover:bg-[color-mix(in_srgb,var(--destructive)_9%,white)]'
    )
    expect(resolveRowToneClass('dangerSubtle', 'alternate')).toBe(
      'bg-[color-mix(in_srgb,var(--destructive)_9%,white)] hover:bg-[color-mix(in_srgb,var(--destructive)_13%,white)]'
    )
  })

  it('alternate is a visibly different intensity than base within the same tone', () => {
    for (const tone of TONES) {
      const [basePct] = extractPercents(resolveRowToneClass(tone, 'base'))
      const [altPct] = extractPercents(resolveRowToneClass(tone, 'alternate'))
      expect(altPct).toBeGreaterThan(basePct)
    }
  })
})
