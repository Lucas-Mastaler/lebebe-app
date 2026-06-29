import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import ChamadosFinalizadosPageClient from './PageClient'

export default async function ChamadosFinalizadosPage() {
  const access = await checkModuleAndWindowAccess('chamados_finalizados')
  if (!access.ok) redirect(access.redirectTo)

  return <ChamadosFinalizadosPageClient />
}
