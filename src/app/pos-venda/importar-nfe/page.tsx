import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import ImportarNfePageClient from './PageClient'

export default async function ImportarNfePage() {
  const access = await checkModuleAndWindowAccess('pos_venda')
  if (!access.ok) redirect(access.redirectTo)

  return <ImportarNfePageClient />
}
