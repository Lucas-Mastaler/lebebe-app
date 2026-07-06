import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import RecebimentoProdutosPageClient from './PageClient'

export const dynamic = 'force-dynamic'

export default async function RecebimentoProdutosPage() {
  const access = await checkModuleAndWindowAccess('recebimento')
  if (!access.ok) redirect(access.redirectTo)

  return <RecebimentoProdutosPageClient />
}
