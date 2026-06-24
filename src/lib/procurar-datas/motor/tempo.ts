// ─────────────────────────────────────────────────────────────────────────────
// motor/tempo.ts  —  Conversões de tempo puro (sem I/O)
//
// Porta fiel das funções do Apps Script:
//   - parseMinutes()       → parseMinutos()
//   - _fmtHHMMFromAny_()   → formatarMinutos()
//   - _addMinHHMM_()       → adicionarMinutosHHMM()
//
// NÃO FAZ:
//   - Leitura de planilha, Supabase, ou qualquer I/O
//   - Nenhuma alteração em APIs existentes ou frontend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reprodução fiel de `parseMinutes(t)` do CEP-CONFIG.gs (linhas 1856-1862).
 *
 * Aceita:
 *   - null/undefined/'' → 0
 *   - Date              → horas*60 + minutos
 *   - number            → Math.round(t * 24 * 60)  (fração de dia, estilo Excel)
 *   - string "H:MM"     → h*60 + m (hora sem zero à esquerda)
 *   - string "HH:MM"    → h*60 + m (hora com zero à esquerda)
 *   - string inválida   → 0 (NaN vira 0)
 */
export function parseMinutos(input: unknown): number {
  if (!input) return 0

  if (input instanceof Date) {
    return input.getHours() * 60 + input.getMinutes()
  }

  if (typeof input === 'number') {
    return Math.round(input * 24 * 60)
  }

  const str = String(input).trim()
  const p = str.split(':')
  if (p.length !== 2) return 0

  const hStr = p[0]
  const mStr = p[1]

  if (hStr.length === 0 || mStr.length === 0) return 0

  const h = Number(hStr)
  const m = Number(mStr)

  if (isNaN(h) || isNaN(m)) return 0
  if (h < 0 || m < 0 || m > 59) return 0

  return h * 60 + m
}

/**
 * Reprodução fiel de `_fmtHHMMFromAny_(v)` do CEP-APIBACK.gs (linhas 2022-2037).
 *
 * Aceita:
 *   - string "HH:MM"    → "HH:MM" (com padStart)
 *   - Date              → "HH:MM" (UTC hours/minutes)
 *   - number (minutos)  → "HH:MM"
 *   - inválido          → ''
 */
export function formatarMinutos(input: unknown): string {
  if (typeof input === 'string') {
    const m = input.match(/^(\d{1,2}):(\d{2})$/)
    if (m) {
      return m[1].padStart(2, '0') + ':' + m[2]
    }
  }

  if (input instanceof Date && !isNaN(input.getTime())) {
    const h = input.getUTCHours()
    const m2 = input.getUTCMinutes()
    return String(h).padStart(2, '0') + ':' + String(m2).padStart(2, '0')
  }

  const n = Number(input)
  if (!isNaN(n) && n >= 0) {
    const h2 = Math.floor(n / 60)
    const m3 = n % 60
    return String(h2).padStart(2, '0') + ':' + String(m3).padStart(2, '0')
  }

  return ''
}

/**
 * Reprodução fiel de `_addMinHHMM_(hhmm, add)` do CEP-APIBACK.gs (linhas 2000-2007).
 *
 * Recebe string "HH:MM" e minutos a adicionar.
 * Retorna "HH:MM" ou string original se formato inválido.
 * Total negativo é truncado em 0.
 */
export function adicionarMinutosHHMM(hhmm: unknown, add: unknown): string {
  const str = String(hhmm || '').trim()
  const m = str.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return str

  let total = Number(m[1]) * 60 + Number(m[2]) + (Number(add) || 0)
  if (total < 0) total = 0

  const h = Math.floor(total / 60)
  const mm = String(total % 60).padStart(2, '0')
  return h + ':' + mm
}
