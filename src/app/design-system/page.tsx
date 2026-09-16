import { redirect } from 'next/navigation'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import DesignSystemLabClient from './DesignSystemLabClient'

export const dynamic = 'force-dynamic'

export default async function DesignSystemLabPage() {
  const auth = await requireAuthenticatedUser({
    requireActive: true,
    requiredRole: 'superadmin',
  })

  if (!auth.ok) {
    redirect(auth.response.status === 401 ? '/login' : '/acesso-negado')
  }

  return <DesignSystemLabClient />
}
