import { redirect } from 'next/navigation'
import { checkModuleAccess } from '@/lib/auth/module-access'
import RecebimentoPageClient from './PageClient'

export default async function RecebimentoPage() {
  const access = await checkModuleAccess('recebimento')
  if (!access.ok) redirect('/acesso-negado')

  return <RecebimentoPageClient />
}
