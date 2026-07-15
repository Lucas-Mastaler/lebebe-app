import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import PageClient from './PageClient'

export default async function ConfiguracoesProcurarDatasPage() {
  const access = await checkModuleAndWindowAccess('configuracoes_procurar_datas')
  if (!access.ok) redirect(access.redirectTo)

  return <PageClient />
}