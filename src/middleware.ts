import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const publicRoutes = ['/login', '/recuperar-senha', '/resetar-senha', '/definir-senha', '/convite']
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // Se as variáveis de ambiente não estão configuradas, redireciona para login
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[MIDDLEWARE] Variáveis de ambiente do Supabase não configuradas!')
    if (!isPublicRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach((cookie: CookieToSet) => {
            request.cookies.set(cookie.name, cookie.value)
            response.cookies.set(cookie.name, cookie.value, cookie.options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Usuário não autenticado tentando acessar rota protegida
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Usuário autenticado - verificar se está na lista de permitidos
  if (user && !isPublicRoute) {
    const { data: usuarioPermitido, error } = await supabase
      .from('usuarios_permitidos')
      .select('ativo, role')
      .eq('email', user.email?.toLowerCase())
      .single()

    // Usuário não está na lista de permitidos ou ocorreu erro
    if (error || !usuarioPermitido) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Usuário está bloqueado
    if (!usuarioPermitido.ativo) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Verificar acesso a área superadmin
    if (request.nextUrl.pathname.startsWith('/superadmin')) {
      if (usuarioPermitido.role !== 'superadmin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  // Usuário autenticado tentando acessar página de login
  if (user && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/agendamentos/:path*',
    '/dashboard/:path*',
    '/chamados-finalizados/:path*',
    '/superadmin/:path*',
    '/login',
    '/recuperar-senha',
    '/resetar-senha',
    '/definir-senha',
    '/convite/:path*',
    '/',
  ],
}
