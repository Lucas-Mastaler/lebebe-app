import { redirect } from 'next/navigation'
import { checkModuleAccess } from '@/lib/auth/module-access'
import RecebimentoDetalhePageClient from './PageClient'

export default async function RecebimentoDetalhePage() {
  const access = await checkModuleAccess('recebimento')
  if (!access.ok) redirect('/acesso-negado')

  return <RecebimentoDetalhePageClient />
}
