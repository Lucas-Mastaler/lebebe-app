import { NextResponse } from 'next/server'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { requireModuleAccess } from '@/lib/auth/module-access'

export async function requireAtendimentoPresencialClientesAccess() {
  const auth = await requireModuleAccess('atendimento_presencial_clientes')

  if (!auth.ok) return auth

  const windowAccess = await checkAccessWindowForUser({
    usuarioId: auth.allowedUser.id,
    role: auth.allowedUser.role as 'user' | 'superadmin',
  })

  if (!windowAccess.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: 'Fora da janela de acesso' },
        { status: 403 }
      ),
    }
  }

  return {
    ...auth,
    windowAccess,
  }
}
