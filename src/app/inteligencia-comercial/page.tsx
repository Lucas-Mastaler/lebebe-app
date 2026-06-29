import { redirect } from 'next/navigation'
import { checkModuleAccess } from '@/lib/auth/module-access'
import InteligenciaComercialPageClient from './PageClient'

export default async function InteligenciaComercialPage() {
  const access = await checkModuleAccess('inteligencia_comercial')
  if (!access.ok) {
    redirect('/acesso-negado')
  }

  return <InteligenciaComercialPageClient />
}
