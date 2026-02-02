import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token

    if (!token || token.length !== 64) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'}/definir-senha?error=invalid_token`
      )
    }

    const supabase = await createClient()

    const { data: usuario, error } = await supabase
      .from('usuarios_permitidos')
      .select('email, invite_token, invite_token_expires_at, invite_status')
      .eq('invite_token', token)
      .single()

    if (error || !usuario) {
      console.error('[CONVITE] Token não encontrado:', token)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'}/definir-senha?error=invalid_token`
      )
    }

    if (usuario.invite_status === 'accepted') {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'}/login?message=already_registered`
      )
    }

    if (!usuario.invite_token_expires_at || new Date(usuario.invite_token_expires_at) < new Date()) {
      console.error('[CONVITE] Token expirado:', token)
      
      await supabase
        .from('usuarios_permitidos')
        .update({ invite_status: 'expired' })
        .eq('invite_token', token)

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'}/definir-senha?error=token_expired&email=${encodeURIComponent(usuario.email)}`
      )
    }

    const supabaseAdmin = createServiceClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'

    console.log(`[CONVITE] Gerando link OTP para ${usuario.email}`)

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: usuario.email,
      options: {
        redirectTo: `${appUrl}/definir-senha`,
      }
    })

    if (inviteError || !inviteData.properties?.action_link) {
      console.error('[CONVITE] Erro ao gerar link OTP:', inviteError)
      return NextResponse.redirect(
        `${appUrl}/definir-senha?error=server_error`
      )
    }

    console.log(`[CONVITE] Redirecionando para link OTP`)

    return NextResponse.redirect(inviteData.properties.action_link)

  } catch (error) {
    console.error('[CONVITE] Erro geral:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'}/definir-senha?error=server_error`
    )
  }
}
