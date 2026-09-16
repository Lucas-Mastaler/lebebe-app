import { describe, expect, it } from 'vitest'
import { TABLE_PAGE_SIZE, clampPageSize } from './pagination'

describe('pagination', () => {
  it('TABLE_PAGE_SIZE is 20', () => {
    expect(TABLE_PAGE_SIZE).toBe(20)
  })

  it('clampPageSize never exceeds TABLE_PAGE_SIZE, even if the caller asks for more', () => {
    expect(clampPageSize(500)).toBe(20)
    expect(clampPageSize(100)).toBe(20)
  })

  it('clampPageSize keeps a smaller requested size as-is', () => {
    expect(clampPageSize(5)).toBe(5)
  })

  it('clampPageSize falls back to TABLE_PAGE_SIZE for missing/invalid input', () => {
    expect(clampPageSize(undefined)).toBe(20)
    expect(clampPageSize(0)).toBe(20)
    expect(clampPageSize(-3)).toBe(20)
  })
})
