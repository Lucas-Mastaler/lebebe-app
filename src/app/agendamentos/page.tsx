import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import { AgendamentosPage } from '@/components/AgendamentosPage'

export default async function Page() {
  const access = await checkModuleAndWindowAccess('agendamentos')
  if (!access.ok) redirect(access.redirectTo)

  return <AgendamentosPage />
}
