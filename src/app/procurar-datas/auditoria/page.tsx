import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import PageClient from './PageClient'

export default async function ProcurarDatasAuditoriaPage() {
  const access = await checkModuleAndWindowAccess('procurar_datas_auditoria')
  if (!access.ok) redirect(access.redirectTo)

  return <PageClient />
}
