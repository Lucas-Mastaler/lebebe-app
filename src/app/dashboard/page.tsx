import { redirect } from 'next/navigation'
import { checkModuleAccess } from '@/lib/auth/module-access'
import DashboardPageClient from './PageClient'

export default async function DashboardPage() {
  const access = await checkModuleAccess('dashboard')
  if (!access.ok) {
    redirect('/acesso-negado')
  }

  return <DashboardPageClient />
}
