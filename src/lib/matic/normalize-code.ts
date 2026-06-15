// Helper: remove leading zeros and trim spaces for matching (02685 -> 2685)
export function normalizeCode(code: string): string {
  if (!code) return '0'
  return code.trim().replace(/^0+/, '') || '0'
}
