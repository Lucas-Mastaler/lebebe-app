import { redirect } from 'next/navigation'
import { checkModuleAccess } from '@/lib/auth/module-access'
import ChamadosFinalizadosPageClient from './PageClient'

export default async function ChamadosFinalizadosPage() {
  const access = await checkModuleAccess('chamados_finalizados')
  if (!access.ok) {
    redirect('/acesso-negado')
  }

  return <ChamadosFinalizadosPageClient />
}
