import { describe, expect, it } from 'vitest'
import { COLUMN_WIDTH_CLASSES } from './column-sizing'

describe('column-sizing', () => {
  it('has exactly the 5 documented roles', () => {
    expect(Object.keys(COLUMN_WIDTH_CLASSES).sort()).toEqual(['compact', 'content', 'fill', 'standard', 'wide'])
  })

  it('compact hugs content (nowrap, no forced min/max)', () => {
    const cls = COLUMN_WIDTH_CLASSES.compact
    expect(cls).toContain('whitespace-nowrap')
    expect(cls).not.toMatch(/min-w-|max-w-/)
  })

  it('content hugs content like compact but is a distinct semantic role', () => {
    const cls = COLUMN_WIDTH_CLASSES.content
    expect(cls).toContain('whitespace-nowrap')
    expect(cls).not.toMatch(/min-w-|max-w-/)
    expect(cls).not.toBe(COLUMN_WIDTH_CLASSES.wide)
    expect(cls).not.toBe(COLUMN_WIDTH_CLASSES.fill)
  })

  it('wide and fill allow wrapping (narrative text)', () => {
    expect(COLUMN_WIDTH_CLASSES.wide).toContain('whitespace-normal')
    expect(COLUMN_WIDTH_CLASSES.fill).toContain('whitespace-normal')
  })

  it('fill is the only role that absorbs remaining space', () => {
    expect(COLUMN_WIDTH_CLASSES.fill).toContain('w-full')
    expect(COLUMN_WIDTH_CLASSES.standard).not.toContain('w-full')
    expect(COLUMN_WIDTH_CLASSES.wide).not.toContain('w-full')
    expect(COLUMN_WIDTH_CLASSES.compact).not.toContain('w-full')
    expect(COLUMN_WIDTH_CLASSES.content).not.toContain('w-full')
  })

  it('standard and wide define bounded min/max', () => {
    expect(COLUMN_WIDTH_CLASSES.standard).toMatch(/min-w-\[\d+px\]/)
    expect(COLUMN_WIDTH_CLASSES.standard).toMatch(/max-w-\[\d+px\]/)
    expect(COLUMN_WIDTH_CLASSES.wide).toMatch(/min-w-\[\d+px\]/)
    expect(COLUMN_WIDTH_CLASSES.wide).toMatch(/max-w-\[\d+px\]/)
  })

  it('NO-CELL-OVERLAP: any role with a max-w also allows wrapping (never nowrap + bounded max-w)', () => {
    for (const [role, cls] of Object.entries(COLUMN_WIDTH_CLASSES)) {
      const hasMaxWidth = /max-w-\[\d+px\]/.test(cls)
      if (hasMaxWidth) {
        expect(cls, `${role} has max-w but does not allow wrapping — content could overflow into the next column`).toContain('whitespace-normal')
      }
    }
  })

  it('NO-CELL-OVERLAP: every role picks an explicit strategy — grow (nowrap, no max-w) or wrap (whitespace-normal)', () => {
    for (const [role, cls] of Object.entries(COLUMN_WIDTH_CLASSES)) {
      const grows = cls.includes('whitespace-nowrap') && !/max-w-\[\d+px\]/.test(cls)
      const wraps = cls.includes('whitespace-normal')
      expect(grows || wraps, `${role} does not declare a valid NO-CELL-OVERLAP strategy`).toBe(true)
    }
  })
})
