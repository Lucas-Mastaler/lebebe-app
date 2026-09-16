/**
 * ERR=C com ajuste aprovado:
 *   - erro de campo: sempre inline, associado ao campo (aria-invalid +
 *     aria-describedby), nunca só cor/borda;
 *   - vários erros: resumo no topo ALÉM dos erros inline (nunca substitui);
 *   - erro de servidor/integração: NUNCA é erro de campo — é um banner de
 *     operação separado (ver `Alert`), sem detalhe técnico exposto ao
 *     usuário operacional.
 */
export type FieldErrors = Record<string, string | undefined>

export interface ErrorSummaryItem {
  field: string
  message: string
}

/** Só retorna itens com mensagem — decide sozinho se o resumo deve aparecer (lista vazia = não renderizar nada). */
export function buildErrorSummary(errors: FieldErrors): ErrorSummaryItem[] {
  return Object.entries(errors)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([field, message]) => ({ field, message }))
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return buildErrorSummary(errors).length > 0
}

/**
 * Mensagem segura para banner de erro de servidor: nunca deve conter
 * stack trace, payload ou detalhe técnico interno. Use `safeDetail` só
 * para informação já sabidamente segura para o usuário operacional.
 */
export function serverErrorMessage(operation: string, safeDetail?: string): string {
  const base = `Não foi possível ${operation}. Tente novamente.`
  return safeDetail ? `${base} ${safeDetail}` : base
}
