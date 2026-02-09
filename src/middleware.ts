import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { deveDesconectarPorHorario, getDataHojeBRT } from '@/lib/auth/auto-logout'

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

  // NOVA REGRA: Rota /horarios-agendamentos é 100% pública
  const isHorariosAgendamentos = request.nextUrl.pathname.startsWith('/horarios-agendamentos')
  if (isHorariosAgendamentos) {
    console.log(`[AUTH] Rota pública liberada: ${request.nextUrl.pathname}`)
    return response
  }

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

    // Verificar logout automático às 19h BRT (apenas para não-superadmin)
    if (usuarioPermitido.role !== 'superadmin') {
      const cookieLogoutDate = request.cookies.get('auto_logout_date')?.value

      const deveDesconectar = deveDesconectarPorHorario(
        usuarioPermitido.role,
        cookieLogoutDate
      )

      if (deveDesconectar) {
        const hojeBRT = getDataHojeBRT()
        console.log(`[MIDDLEWARE-AUTO-LOGOUT] Desconectando ${user.email} - passou das 19h BRT (${hojeBRT}) e não foi desconectado hoje`)

        await supabase.auth.signOut()

        const redirectResponse = NextResponse.redirect(new URL('/login?auto_logout=true', request.url))
        // Cookie marca que o usuário já foi deslogado hoje — impede loop infinito
        redirectResponse.cookies.set('auto_logout_date', hojeBRT, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 12, // 12h — expira automaticamente na manhã seguinte
        })
        return redirectResponse
      }
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
