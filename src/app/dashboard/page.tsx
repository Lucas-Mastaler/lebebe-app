import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import DashboardPageClient from './PageClient'

export default async function DashboardPage() {
  const access = await checkModuleAndWindowAccess('dashboard')
  if (!access.ok) redirect(access.redirectTo)

  return <DashboardPageClient />
}
