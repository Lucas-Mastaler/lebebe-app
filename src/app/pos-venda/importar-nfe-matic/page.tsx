import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import ImportarNfeMaticPageClient from './PageClient'

export default async function ImportarNfeMaticPage() {
  const access = await checkModuleAndWindowAccess('pos_venda')
  if (!access.ok) redirect(access.redirectTo)

  return <ImportarNfeMaticPageClient />
}
