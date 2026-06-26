import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

export type RequiredRole = 'superadmin' | 'user' | string

export type AllowedUser = {
  id: string
  email: string
  role: string
  ativo: boolean
}

export type RequireAuthenticatedUserOptions = {
  /**
   * Se true, consulta o registro em `usuarios_permitidos`.
   * Necessário para validações de role ou ativo.
   */
  requireAllowedUser?: boolean
  /**
   * Se true, rejeita usuários com `ativo !== true`.
   * Implica `requireAllowedUser = true`.
   */
  requireActive?: boolean
  /**
   * Se informado, rejeita usuários cujo role não seja exatamente igual.
   * Implica `requireAllowedUser = true`.
   */
  requiredRole?: RequiredRole
}

export type RequireAuthenticatedUserSuccess = {
  ok: true
  user: User
  email: string
  allowedUser: AllowedUser | null
}

export type RequireAuthenticatedUserError = {
  ok: false
  response: NextResponse
}

export type RequireAuthenticatedUserResult =
  | RequireAuthenticatedUserSuccess
  | RequireAuthenticatedUserError

const resposta401 = () =>
  NextResponse.json(
    { ok: false, message: 'Não autenticado' },
    { status: 401 }
  )

const resposta403 = () =>
  NextResponse.json(
    { ok: false, message: 'Acesso negado' },
    { status: 403 }
  )

const resposta500 = () =>
  NextResponse.json(
    { ok: false, message: 'Erro ao processar requisição' },
    { status: 500 }
  )

/**
 * Helper central para validar autenticação em API Routes.
 *
 * Padrão do projeto:
 * - Sessão via `createClient()` (anon key + cookies).
 * - Consulta `usuarios_permitidos` via `createServiceClient()` para evitar
 *   interferência de RLS e garantir leitura confiável da role/atividade.
 *
 * Não loga dados sensíveis e não expõe detalhes internos no response.
 */
export async function requireAuthenticatedUser(
  options: RequireAuthenticatedUserOptions = {}
): Promise<RequireAuthenticatedUserResult> {
  const { requireAllowedUser = false, requireActive = false, requiredRole } = options

  const needsAllowedUser = requireAllowedUser || requireActive || requiredRole !== undefined

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return { ok: false, response: resposta401() }
    }

    const email = user.email.toLowerCase()

    if (!needsAllowedUser) {
      return {
        ok: true,
        user,
        email,
        allowedUser: null,
      }
    }

    const supabaseAdmin = createServiceClient()
    const { data: allowedUser, error } = await supabaseAdmin
      .from('usuarios_permitidos')
      .select('id, email, role, ativo')
      .eq('email', email)
      .single()

    if (error || !allowedUser) {
      console.error('[api-auth] Usuário autenticado não encontrado em usuarios_permitidos:', error)
      return { ok: false, response: resposta403() }
    }

    if (requireActive && allowedUser.ativo !== true) {
      return { ok: false, response: resposta403() }
    }

    if (requiredRole !== undefined && allowedUser.role !== requiredRole) {
      return { ok: false, response: resposta403() }
    }

    return {
      ok: true,
      user,
      email,
      allowedUser: {
        id: allowedUser.id,
        email: allowedUser.email,
        role: allowedUser.role,
        ativo: allowedUser.ativo,
      },
    }
  } catch (error) {
    console.error('[api-auth] Erro ao validar autenticação:', error)
    return { ok: false, response: resposta500() }
  }
}
