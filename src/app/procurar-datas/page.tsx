import { redirect } from 'next/navigation'
import { checkModuleAccess } from '@/lib/auth/module-access'
import ProcurarDatasPageClient from './PageClient'

export default async function ProcurarDatasPage() {
  const access = await checkModuleAccess('procurar_datas')
  if (!access.ok) redirect('/acesso-negado')

  return <ProcurarDatasPageClient />
}
