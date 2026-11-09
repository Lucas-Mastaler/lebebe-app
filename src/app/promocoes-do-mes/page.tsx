import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import PageClient from './PageClient'

export default async function PromocoesDoMesPage() {
  const access = await checkModuleAndWindowAccess('promocoes_mes')
  if (!access.ok) redirect(access.redirectTo)

  return <PageClient />
}
