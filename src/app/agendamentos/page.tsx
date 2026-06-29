import { redirect } from 'next/navigation'
import { checkModuleAccess } from '@/lib/auth/module-access'
import { AgendamentosPage } from '@/components/AgendamentosPage'

export default async function Page() {
  const access = await checkModuleAccess('agendamentos')
  if (!access.ok) redirect('/acesso-negado')

  return <AgendamentosPage />
}
