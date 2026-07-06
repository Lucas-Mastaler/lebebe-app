import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import RecebimentoPageClient from './PageClient'

export const dynamic = 'force-dynamic'

export default async function RecebimentoPage() {
  const access = await checkModuleAndWindowAccess('recebimento')
  if (!access.ok) redirect(access.redirectTo)

  return <RecebimentoPageClient />
}
