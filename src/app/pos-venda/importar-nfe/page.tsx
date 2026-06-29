import { redirect } from 'next/navigation'
import { checkModuleAccess } from '@/lib/auth/module-access'
import ImportarNfePageClient from './PageClient'

export default async function ImportarNfePage() {
  const access = await checkModuleAccess('pos_venda')
  if (!access.ok) redirect('/acesso-negado')

  return <ImportarNfePageClient />
}
