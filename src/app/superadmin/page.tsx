import { redirect } from 'next/navigation'
import SuperAdminPageClient from './PageClient'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { checkModuleAccess } from '@/lib/auth/module-access'

const VALID_TABS = ['usuarios', 'perfis', 'auditoria'] as const
type SuperAdminTab = (typeof VALID_TABS)[number]

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function getRequestedTab(params: Record<string, string | string[] | undefined>): SuperAdminTab {
  const raw = params.tab
  const tab = Array.isArray(raw) ? raw[0] : raw
  return VALID_TABS.includes(tab as SuperAdminTab) ? (tab as SuperAdminTab) : 'usuarios'
}

function hasValidTab(params: Record<string, string | string[] | undefined>) {
  const raw = params.tab
  const tab = Array.isArray(raw) ? raw[0] : raw
  return VALID_TABS.includes(tab as SuperAdminTab)
}

export default async function SuperAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const requestedTab = getRequestedTab(params)
  const validTab = hasValidTab(params)

  const auth = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
  })

  if (!auth.ok) {
    redirect('/login')
  }

  const isSuperadmin = auth.allowedUser?.role === 'superadmin'

  if (!validTab) {
    redirect('/superadmin?tab=usuarios')
  }

  if (!isSuperadmin) {
    const access = await checkModuleAccess('superadmin_usuarios')
    if (!access.ok) {
      redirect('/acesso-negado')
    }

    if (requestedTab !== 'usuarios') {
      redirect('/superadmin?tab=usuarios')
    }
  }

  return <SuperAdminPageClient initialTab={requestedTab} acessoTotal={isSuperadmin} />
}
