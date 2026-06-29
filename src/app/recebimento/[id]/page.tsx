import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import RecebimentoDetalhePageClient from './PageClient'

export default async function RecebimentoDetalhePage() {
  const access = await checkModuleAndWindowAccess('recebimento')
  if (!access.ok) redirect(access.redirectTo)

  return <RecebimentoDetalhePageClient />
}
