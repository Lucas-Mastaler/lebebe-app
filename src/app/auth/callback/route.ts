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

    if (!error && user) {
      const email = user.email?.toLowerCase() || ''

      const { data: usuarioPermitido } = await supabase
        .from('usuarios_permitidos')
        .select('ativo, role')
        .eq('email', email)
        .single()

      if (!usuarioPermitido || !usuarioPermitido.ativo) {
        await supabase.auth.signOut()
        await registrarAuditoria('LOGIN_FALHA', email, {
          reason: usuarioPermitido ? 'Usuário bloqueado' : 'Usuário não permitido',
          provider: 'google',
        })
        return NextResponse.redirect(`${origin}/login?error=not_allowed`)
      }

      await registrarAuditoria('LOGIN_SUCESSO', email, {
        role: usuarioPermitido.role,
        provider: 'google',
      })

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
