import { createClient } from '@/lib/supabase/server'
import { MATIC_ALLOWED_EMAILS } from './matic-emails'

export async function validateMaticUser(): Promise<{ authorized: boolean; userId?: string; email?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return { authorized: false }
  }

  const email = user.email.toLowerCase()

  if (!MATIC_ALLOWED_EMAILS.includes(email)) {
    return { authorized: false }
  }

  return { authorized: true, userId: user.id, email }
}
