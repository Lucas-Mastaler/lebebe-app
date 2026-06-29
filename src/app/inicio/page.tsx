import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { redirect } from 'next/navigation'

export default async function InicioPage() {
  const auth = await requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })
  if (!auth.ok) {
    redirect('/login')
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-slate-500 text-sm">Seja bem-vindo ao app da le bebé!</p>
    </div>
  )
}
