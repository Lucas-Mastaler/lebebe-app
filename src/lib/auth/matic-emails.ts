export const MATIC_ALLOWED_EMAILS = [
  'posvenda@lebebe.com.br',
  'lucas@lebebe.com.br',
]

export function isMaticEmail(email: string | undefined | null): boolean {
  if (!email) return false
  return MATIC_ALLOWED_EMAILS.includes(email.toLowerCase())
}
