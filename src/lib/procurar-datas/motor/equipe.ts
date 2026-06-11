// ─────────────────────────────────────────────────────────────────────────────
// motor/equipe.ts  —  Normalização de equipe pura (sem I/O)
//
// Porta fiel de `normTeam(s)` do CEP-CONFIG.gs (linhas 1868-1873).
//
// NÃO FAZ:
//   - Leitura de planilha, Supabase, ou qualquer I/O
//   - Nenhuma alteração em APIs existentes ou frontend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reprodução fiel de `normTeam(s)` do CEP-CONFIG.gs (linhas 1868-1873).
 *
 * Normaliza strings de equipe para o padrão 'EQUIPE 1' ou 'EQUIPE 2'.
 *
 * Aceita variações:
 *   - EQUIPE 1, EQUIPE 01, EQUIPE1, EQP 1, EQP 01, EQP1 → 'EQUIPE 1'
 *   - EQUIPE 2, EQUIPE 02, EQUIPE2, EQP 2, EQP 02, EQP2 → 'EQUIPE 2'
 *   - Case-insensitive (converte para uppercase antes do match)
 *
 * Retorna null se não bater com nenhum padrão.
 */
export function normalizarEquipe(input: unknown): 'EQUIPE 1' | 'EQUIPE 2' | null {
  const s = String(input).toUpperCase()

  if (/EQUIPE\s*0?1|EQP\s*0?1/.test(s)) return 'EQUIPE 1'
  if (/EQUIPE\s*0?2|EQP\s*0?2/.test(s)) return 'EQUIPE 2'

  return null
}
