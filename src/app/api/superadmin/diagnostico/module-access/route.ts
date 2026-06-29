import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { diagnosticoModuleAccess } from '@/lib/auth/module-access'
import { NextResponse } from 'next/server'
import type { ModuleKey } from '@/lib/auth/module-access'

export const runtime = 'nodejs'

const MODULE_KEYS_VALIDAS: ModuleKey[] = [
  'dashboard',
  'agendamentos',
  'procurar_datas',
  'chamados_finalizados',
  'inteligencia_comercial',
  'pos_venda',
  'recebimento',
  'superadmin',
  'configuracoes',
]

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
    requiredRole: 'superadmin',
  })

  if (!auth.ok) {
    return auth.response
  }

  const { searchParams } = new URL(request.url)
  const moduleKey = searchParams.get('moduleKey') as ModuleKey | null

  if (!moduleKey || !MODULE_KEYS_VALIDAS.includes(moduleKey)) {
    return NextResponse.json(
      {
        ok: false,
        message: `moduleKey inválido. Valores aceitos: ${MODULE_KEYS_VALIDAS.join(', ')}`,
      },
      { status: 400 }
    )
  }

  const diagnostico = await diagnosticoModuleAccess(
    auth.allowedUser!.id,
    auth.allowedUser!.role,
    moduleKey
  )

  return NextResponse.json({ ok: true, diagnostico })
}
