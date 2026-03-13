import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { registrarAuditoria } from '@/lib/auth/helpers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    
    // ─────────────────────────────────────────────────────────
    // 1.0 – Trocar code por sessão (captura completa)
    // ─────────────────────────────────────────────────────────
    const { data: { user, session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[OAuth Callback] Erro ao trocar código por sessão:', error)
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    if (!user || !user.email) {
      console.error('[OAuth Callback] Usuário ou email não encontrado')
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    const email = user.email.toLowerCase()
    console.log('[OAuth Callback] ✓ Usuário autenticado:', email)

    // ─────────────────────────────────────────────────────────
    // 2.0 – Captura do Google Refresh Token + Escopos
    // ─────────────────────────────────────────────────────────
    if (session) {
      const providerRefreshToken = session.provider_refresh_token
      const providerToken = session.provider_token

      console.log('[OAuth Callback] ── Detalhes da sessão OAuth ──')
      console.log('[OAuth Callback] provider_token presente:', !!providerToken)
      console.log('[OAuth Callback] provider_refresh_token presente:', !!providerRefreshToken)
      console.log('[OAuth Callback] refresh_token (primeiros 10 chars):', providerRefreshToken ? providerRefreshToken.substring(0, 10) + '...' : 'AUSENTE')

      if (providerRefreshToken) {
        console.log('[OAuth Callback] ✓ NOVO refresh_token capturado com sucesso!')
        console.log('[OAuth Callback] ✓ Este token deve incluir os escopos: script.external_request, spreadsheets, drive, calendar, script.scriptapp')
        
        try {
          await supabase.from('google_oauth_setup').insert({
            user_email: email,
            provider_refresh_token: providerRefreshToken,
            provider_token: providerToken || null,
            notes: 'Token capturado com escopos completos (script.external_request + spreadsheets + drive + calendar + script.scriptapp) - ' + new Date().toISOString()
          })
          console.log('[OAuth Callback] ✓ Token salvo na tabela google_oauth_setup')
          console.log('[OAuth Callback] ⚠️ AÇÃO NECESSÁRIA: Copie o refresh_token da tabela google_oauth_setup e atualize a env var GOOGLE_OAUTH_REFRESH_TOKEN')
        } catch (insertError) {
          console.error('[OAuth Callback] ⚠️ Erro ao salvar token (tabela pode não existir):', insertError)
          console.error('[OAuth Callback] Crie a tabela google_oauth_setup ou salve manualmente o refresh_token')
        }
      } else {
        console.warn('[OAuth Callback] ⚠️ provider_refresh_token NÃO retornado pelo Google')
        console.warn('[OAuth Callback] Possíveis causas:')
        console.warn('[OAuth Callback]   1. access_type=offline não está sendo enviado')
        console.warn('[OAuth Callback]   2. prompt=consent não está sendo enviado')
        console.warn('[OAuth Callback]   3. O Supabase não repassa os query params para o Google')
        console.warn('[OAuth Callback]   4. O usuário já tem um refresh_token ativo (revogar em https://myaccount.google.com/permissions)')
        
        try {
          await supabase.from('google_oauth_setup').insert({
            user_email: email,
            provider_refresh_token: null,
            provider_token: providerToken || null,
            notes: 'REFRESH TOKEN AUSENTE - verificar configuração OAuth - ' + new Date().toISOString()
          })
        } catch (insertError) {
          console.error('[OAuth Callback] Erro ao registrar ausência de token:', insertError)
        }
      }
    } else {
      console.warn('[OAuth Callback] ⚠️ Sessão não retornada pelo Supabase')
    }

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
