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

// O histórico é compartilhado por estas três telas já protegidas. Não concede
// módulos: basta um acesso já existente, seguido da mesma janela e do escopo.
export async function requireAtendimentoPresencialHistoricoAccess() {
  let respostaNegada: NextResponse | undefined
  for (const modulo of ['atendimento_presencial_clientes', 'atendimento_presencial_registros', 'atendimento_presencial_ficha'] as const) {
    const auth = await requireModuleAccess(modulo)
    if (!auth.ok) {
      if (auth.response.status === 401 || auth.response.status >= 500) return auth
      respostaNegada ??= auth.response
      continue
    }
    const windowAccess = await checkAccessWindowForUser({
      usuarioId: auth.allowedUser.id,
      role: auth.allowedUser.role as 'user' | 'superadmin',
    })
    if (!windowAccess.ok) return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: 'Fora da janela de acesso' }, { status: 403 }),
    }
    return auth
  }
  return { ok: false as const, response: respostaNegada ?? NextResponse.json({ ok: false, message: 'Acesso negado' }, { status: 403 }) }
}
