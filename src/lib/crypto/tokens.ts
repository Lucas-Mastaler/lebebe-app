import crypto from 'crypto'

export function gerarTokenConvite(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function tokenEstaValido(expiresAt: string): boolean {
  return new Date(expiresAt) > new Date()
}
