import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import PageClient from './PageClient'

export default async function HubVendasGestaoPage() {
  const access = await checkModuleAndWindowAccess('hub_vendas_gestao')
  if (!access.ok) redirect(access.redirectTo)

  return <PageClient />
}
