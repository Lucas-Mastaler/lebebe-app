import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { registrarAuditoria } from '@/lib/auth/helpers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[OAuth Callback] Erro ao trocar código por sessão:', error)
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    if (!user || !user.email) {
      console.error('[OAuth Callback] Usuário ou email não encontrado')
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    const email = user.email.toLowerCase()
    console.log('[OAuth Callback] Usuário autenticado:', email)

    const { data: usuarioPermitido, error: dbError } = await supabase
      .from('usuarios_permitidos')
      .select('ativo, role')
      .eq('email', email)
      .single()

    if (dbError) {
      console.error('[OAuth Callback] Erro ao buscar usuário no banco:', dbError)
    }

    if (!usuarioPermitido) {
      console.warn('[OAuth Callback] Usuário não encontrado em usuarios_permitidos:', email)
      await supabase.auth.signOut()
      await registrarAuditoria('LOGIN_FALHA', email, {
        reason: 'Usuário não permitido',
        provider: 'google',
      })
      return NextResponse.redirect(`${origin}/login?error=not_allowed`)
    }

    if (!usuarioPermitido.ativo) {
      console.warn('[OAuth Callback] Usuário bloqueado:', email)
      await supabase.auth.signOut()
      await registrarAuditoria('LOGIN_FALHA', email, {
        reason: 'Usuário bloqueado',
        provider: 'google',
      })
      return NextResponse.redirect(`${origin}/login?error=blocked`)
    }

    console.log('[OAuth Callback] Login bem-sucedido:', email, 'role:', usuarioPermitido.role)
    await registrarAuditoria('LOGIN_SUCESSO', email, {
      role: usuarioPermitido.role,
      provider: 'google',
    })

    return NextResponse.redirect(`${origin}/dashboard`)
  }

  console.error('[OAuth Callback] Código OAuth não encontrado na URL')
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
