import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { redirect } from 'next/navigation'
import { InicioBoasVindas } from '@/components/inicio/InicioBoasVindas'

export default async function InicioPage() {
  const auth = await requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })
  if (!auth.ok) {
    redirect('/login')
  }

  return <InicioBoasVindas />
}
