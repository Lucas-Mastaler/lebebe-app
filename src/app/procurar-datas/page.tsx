import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import ProcurarDatasPageClient from './PageClient'

export default async function ProcurarDatasPage() {
  const access = await checkModuleAndWindowAccess('procurar_datas')
  if (!access.ok) redirect(access.redirectTo)

  return <ProcurarDatasPageClient />
}
