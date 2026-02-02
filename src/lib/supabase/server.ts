import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * =========================================================
 * 1) TIPOS (EVITA any NO BUILD)
 * =========================================================
 */
type CookieToSet = {
  name: string
  value: string
  options?: {
    path?: string
    domain?: string
    maxAge?: number
    expires?: Date
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'lax' | 'strict' | 'none'
  }
}

/**
 * =========================================================
 * 2) CLIENTE SUPABASE (SERVER)
 * =========================================================
 * Next 16.1.4: cookies() pode ser Promise no tipo.
 * Então aqui precisa ser async + await.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },

        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach((cookie: CookieToSet) => {
              cookieStore.set(cookie.name, cookie.value, cookie.options)
            })
          } catch {
            // Em Server Components, set de cookie pode falhar.
            // É esperado. Não deve quebrar o app.
          }
        },
      },
    }
  )
}
