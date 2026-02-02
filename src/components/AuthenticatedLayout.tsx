import { createClient } from '@/lib/supabase/server'
import { Navigation } from './Navigation'
import { redirect } from 'next/navigation'

export async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: usuarioPermitido } = await supabase
    .from('usuarios_permitidos')
    .select('role')
    .eq('email', user.email?.toLowerCase())
    .single()

  const isSuperadmin = usuarioPermitido?.role === 'superadmin'

  return (
    <>
      <Navigation userEmail={user.email} isSuperadmin={isSuperadmin} />
      {children}
    </>
  )
}
