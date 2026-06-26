import { AcaoAuditoria } from '@/types/supabase'

export async function registrarAuditoria(
  acao: AcaoAuditoria,
  email?: string,
  metadata?: Record<string, unknown>,
  options?: { baseUrl?: string }
) {
  try {
    const isServer = typeof window === 'undefined'

    const url = isServer
      ? new URL(
          '/api/auditoria/registrar',
          options?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        ).toString()
      : '/api/auditoria/registrar'

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (isServer && process.env.AUDITORIA_INTERNAL_SECRET) {
      requestHeaders['X-Internal-Token'] = process.env.AUDITORIA_INTERNAL_SECRET
    }

    await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ acao, email, metadata }),
    })
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error)
  }
}

export function getErrorMessage(error: unknown): string {
  const errorWithMessage = error as { message?: string };
  if (errorWithMessage?.message?.includes('Invalid login credentials')) {
    return 'Credenciais inválidas'
  }
  if (errorWithMessage?.message?.includes('Email not confirmed')) {
    return 'Email não confirmado'
  }
  if (errorWithMessage?.message?.includes('User not found')) {
    return 'Usuário não encontrado'
  }
  return 'Erro ao processar requisição'
}
