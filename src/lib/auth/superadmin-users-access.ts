import { NextResponse } from 'next/server'
import { requireModuleAccess, type RequireModuleAccessResult, type RequireModuleAccessSuccess } from '@/lib/auth/module-access'

export const SUPERADMIN_USUARIOS_MODULE_KEY = 'superadmin_usuarios' as const

export type SuperadminUsersAccessSuccess = RequireModuleAccessSuccess & {
  acessoLimitadoUsuarios: boolean
}

export type SuperadminUsersAccessResult =
  | SuperadminUsersAccessSuccess
  | { ok: false; response: NextResponse }

export async function requireSuperadminUsersAccess(): Promise<SuperadminUsersAccessResult> {
  const access: RequireModuleAccessResult = await requireModuleAccess(SUPERADMIN_USUARIOS_MODULE_KEY)

  if (!access.ok) {
    return access
  }

  return {
    ...access,
    acessoLimitadoUsuarios: access.allowedUser.role !== 'superadmin',
  }
}

export function canManageCommonUserOnly(access: SuperadminUsersAccessSuccess) {
  return access.acessoLimitadoUsuarios
}
