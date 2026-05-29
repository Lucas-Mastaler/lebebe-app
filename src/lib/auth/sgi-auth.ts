import { createClient } from '@/lib/supabase/server'

export async function validateComercialUser(): Promise<{ authorized: boolean; userId?: string; email?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return { authorized: false }
  }

  const { data } = await supabase
    .from('usuarios_permitidos')
    .select('ativo')
    .eq('email', user.email.toLowerCase())
    .single()

  if (!data?.ativo) {
    return { authorized: false }
  }

  return { authorized: true, userId: user.id, email: user.email }
}
