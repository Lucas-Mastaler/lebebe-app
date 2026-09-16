import { describe, expect, it } from 'vitest'
import { getSectionToneAt, SECTION_TONES, SECTION_TONE_CLASSES } from './section-tones'

describe('section-tones', () => {
  it('has exactly 3 tones', () => {
    expect(SECTION_TONES).toHaveLength(3)
  })

  it('cycles the decorative sequence without consumers reimplementing it', () => {
    expect(Array.from({ length: 6 }, (_, index) => getSectionToneAt(index))).toEqual([
      'section-1', 'section-2', 'section-3', 'section-1', 'section-2', 'section-3',
    ])
  })

  it('every tone has distinct surface/border/accent classes', () => {
    const surfaces = SECTION_TONES.map((t) => SECTION_TONE_CLASSES[t].surface)
    const borders = SECTION_TONES.map((t) => SECTION_TONE_CLASSES[t].border)
    const accents = SECTION_TONES.map((t) => SECTION_TONE_CLASSES[t].accentBar)
    expect(new Set(surfaces).size).toBe(3)
    expect(new Set(borders).size).toBe(3)
    expect(new Set(accents).size).toBe(3)
  })

  it('never reuses a semantic color name (success/warning/danger/info)', () => {
    const semanticWords = ['success', 'warning', 'danger', 'destructive', 'info']
    for (const tone of SECTION_TONES) {
      const cls = SECTION_TONE_CLASSES[tone]
      const all = `${cls.surface} ${cls.border} ${cls.accentBar} ${cls.icon} ${cls.title} ${cls.divider}`
      for (const word of semanticWords) {
        expect(all).not.toContain(word)
      }
    }
  })
})
