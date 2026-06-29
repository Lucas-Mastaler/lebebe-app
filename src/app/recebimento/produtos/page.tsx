import { redirect } from 'next/navigation'
import { checkModuleAccess } from '@/lib/auth/module-access'
import RecebimentoProdutosPageClient from './PageClient'

export default async function RecebimentoProdutosPage() {
  const access = await checkModuleAccess('recebimento')
  if (!access.ok) redirect('/acesso-negado')

  return <RecebimentoProdutosPageClient />
}
