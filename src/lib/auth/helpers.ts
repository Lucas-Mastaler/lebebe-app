import { AcaoAuditoria } from '@/types/supabase'

export async function registrarAuditoria(
  acao: AcaoAuditoria,
  email?: string,
  metadata?: Record<string, any>,
  options?: { baseUrl?: string }
) {
  try {
    const url =
      typeof window !== 'undefined'
        ? '/api/auditoria/registrar'
        : new URL(
            '/api/auditoria/registrar',
            options?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          ).toString()

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ acao, email, metadata }),
    })
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error)
  }
}

export function getErrorMessage(error: any): string {
  if (error?.message?.includes('Invalid login credentials')) {
    return 'Credenciais inválidas'
  }
  if (error?.message?.includes('Email not confirmed')) {
    return 'Email não confirmado'
  }
  if (error?.message?.includes('User not found')) {
    return 'Usuário não encontrado'
  }
  return 'Erro ao processar requisição'
}
