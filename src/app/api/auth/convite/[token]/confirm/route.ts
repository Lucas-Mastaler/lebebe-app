import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { ok: false, message: 'Token inválido.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceClient()

    let usuario:
      | {
          email: string
          invite_status: string | null
          invite_token_expires_at: string | null
          invite_token_used_at?: string | null
        }
      | null = null

    let fetchError: any = null

    {
      const res = await supabaseAdmin
        .from('usuarios_permitidos')
        .select('email, invite_status, invite_token_expires_at, invite_token_used_at')
        .eq('invite_token', token)
        .single()

      usuario = res.data as any
      fetchError = res.error
    }

    // Compatibilidade: caso a migration 005 ainda não tenha sido aplicada
    if (fetchError && String(fetchError.message || '').includes('invite_token_used_at')) {
      const resFallback = await supabaseAdmin
        .from('usuarios_permitidos')
        .select('email, invite_status, invite_token_expires_at')
        .eq('invite_token', token)
        .single()

      usuario = resFallback.data as any
      fetchError = resFallback.error
    }

    if (fetchError || !usuario) {
      console.error('[CONVITE CONFIRM] Token não encontrado:', token, fetchError)
      return NextResponse.json(
        { ok: false, message: 'Link inválido ou expirado. Solicite um novo convite ao administrador.' },
        { status: 404 }
      )
    }

    if (usuario.invite_status === 'accepted') {
      return NextResponse.json(
        { ok: false, message: 'Convite já foi aceito. Faça login para continuar.' },
        { status: 400 }
      )
    }

    if (usuario.invite_token_used_at) {
      return NextResponse.json(
        { ok: false, message: 'Este convite já foi confirmado. Se precisar, solicite um novo convite ao administrador.' },
        { status: 400 }
      )
    }

    if (!usuario.invite_token_expires_at || new Date(usuario.invite_token_expires_at) < new Date()) {
      await supabaseAdmin
        .from('usuarios_permitidos')
        .update({ invite_status: 'expired' })
        .eq('invite_token', token)

      return NextResponse.json(
        { ok: false, message: 'Este convite expirou. Solicite um novo convite ao administrador.' },
        { status: 400 }
      )
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: usuario.email,
      options: {
        redirectTo: `${appUrl}/definir-senha`,
      },
    })

    if (inviteError || !inviteData.properties?.action_link) {
      console.error('[CONVITE CONFIRM] Erro ao gerar link OTP:', inviteError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao gerar link. Tente novamente.' },
        { status: 500 }
      )
    }

    {
      const resMarkUsed = await supabaseAdmin
        .from('usuarios_permitidos')
        .update({ invite_token_used_at: new Date().toISOString() })
        .eq('invite_token', token)
        .is('invite_token_used_at', null)

      if (resMarkUsed.error) {
        // Compatibilidade: se a coluna ainda não existe, não quebra o fluxo
        if (!String(resMarkUsed.error.message || '').includes('invite_token_used_at')) {
          console.error('[CONVITE CONFIRM] Erro ao marcar token como usado:', resMarkUsed.error)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      redirectUrl: inviteData.properties.action_link,
    })
  } catch (error) {
    console.error('[CONVITE CONFIRM] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao confirmar convite.' },
      { status: 500 }
    )
  }
}
