// ─────────────────────────────────────────────────────────────────────────────
// motor/datas.ts  —  Helpers puros de data (sem I/O)
//
// Porta operações nativas de JavaScript usadas no Apps Script:
//   - diferença em dias entre datas
//   - adicionar dias a uma data
//
// NÃO FAZ:
//   - Leitura de planilha, Supabase, ou qualquer I/O
//   - Nenhuma alteração em APIs existentes ou frontend
//   - Não depende de Utilities.formatDate ou Apps Script
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula a diferença em dias entre duas datas.
 *
 * Reproduz a lógica usada no Apps Script:
 *   Math.abs(Math.round((cj.date.getTime() - ci.date.getTime()) / 86400000))
 *
 * Retorna valor absoluto arredondado.
 */
export function diffDias(d1: Date, d2: Date): number {
  return Math.abs(Math.round((d2.getTime() - d1.getTime()) / 86400000))
}

/**
 * Adiciona dias a uma data.
 *
 * Reproduz a lógica usada no Apps Script:
 *   const x = new Date(d.getTime())
 *   x.setDate(x.getDate() + n)
 *
 * Retorna nova data (imutável).
 */
export function adicionarDias(d: Date, n: number): Date {
  const x = new Date(d.getTime())
  x.setDate(x.getDate() + n)
  return x
}
