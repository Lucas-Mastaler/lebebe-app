import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import InteligenciaComercialPageClient from './PageClient'

export default async function InteligenciaComercialPage() {
  const access = await checkModuleAndWindowAccess('inteligencia_comercial')
  if (!access.ok) redirect(access.redirectTo)

  return <InteligenciaComercialPageClient />
}
