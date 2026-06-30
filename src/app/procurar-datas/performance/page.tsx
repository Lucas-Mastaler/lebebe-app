import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import PageClient from './PageClient'

export default async function ProcurarDatasPerformancePage() {
  const access = await checkModuleAndWindowAccess('procurar_datas_performance')
  if (!access.ok) redirect(access.redirectTo)

  return <PageClient />
}
