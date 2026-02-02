import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { registrarAuditoria } from '@/lib/auth/helpers'
import { enviarEmail, gerarHtmlConvite } from '@/lib/email/resend'
import { gerarTokenConvite } from '@/lib/crypto/tokens'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { ok: false, message: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    const emailNormalizado = email.toLowerCase().trim()

    if (!emailNormalizado.includes('@')) {
      return NextResponse.json(
        { ok: false, message: 'Email inválido' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    const { data: usuarioExistente } = await supabase
      .from('usuarios_permitidos')
      .select('id, ativo, last_invite_sent_at, invite_status, role')
      .eq('email', emailNormalizado)
      .single()

    if (!usuarioExistente) {
      return NextResponse.json(
        { ok: false, message: 'Usuário não encontrado no sistema' },
        { status: 404 }
      )
    }

    if (usuarioExistente.invite_status === 'accepted') {
      return NextResponse.json(
        { ok: false, message: 'Usuário já definiu senha e está ativo' },
        { status: 400 }
      )
    }

    if (usuarioExistente.last_invite_sent_at) {
      const lastSentAt = new Date(usuarioExistente.last_invite_sent_at)
      const now = new Date()
      const diffSeconds = (now.getTime() - lastSentAt.getTime()) / 1000

      if (diffSeconds < 60) {
        const remainingSeconds = Math.ceil(60 - diffSeconds)
        return NextResponse.json(
          { 
            ok: false, 
            status: 'skipped_recent',
            message: `Aguarde ${remainingSeconds} segundos para reenviar o convite.` 
          },
          { status: 429 }
        )
      }
    }

    console.log(`[RESEND INVITE] Gerando novo token seguro para ${emailNormalizado}`)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
    const inviteToken = gerarTokenConvite()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    const confirmUrl = `${appUrl}/api/auth/convite/${inviteToken}`

    console.log(`[RESEND] Enviando email para ${emailNormalizado}`)

    try {
      const htmlEmail = gerarHtmlConvite({ 
        confirmUrl,
        email: emailNormalizado 
      })

      await enviarEmail({
        to: emailNormalizado,
        subject: 'Convite - le bébé',
        html: htmlEmail,
      })

      console.log(`[RESEND] Email reenviado com sucesso para ${emailNormalizado}`)

      await registrarAuditoria('INVITE_EMAIL_SENT', emailNormalizado, {
        action: 'resend',
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

    } catch (emailError: any) {
      console.error('[RESEND ERROR]', emailError)
      
      await supabase
        .from('usuarios_permitidos')
        .update({ invite_status: 'failed' })
        .eq('email', emailNormalizado)

      await registrarAuditoria('INVITE_EMAIL_FAILED', emailNormalizado, {
        action: 'resend',
        error: emailError.message,
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

      return NextResponse.json(
        { ok: false, message: 'Erro ao enviar email: ' + emailError.message },
        { status: 500 }
      )
    }

    const { error: updateError } = await supabase
      .from('usuarios_permitidos')
      .update({
        last_invite_sent_at: new Date().toISOString(),
        invite_status: 'sent',
        invite_token: inviteToken,
        invite_token_expires_at: expiresAt.toISOString(),
      })
      .eq('email', emailNormalizado)

    if (updateError) {
      console.error('[RESEND INVITE] Erro ao atualizar registro:', updateError)
    }

    await registrarAuditoria('USUARIO_PERMITIDO_CRIADO', emailNormalizado, {
      action: 'resend_invite',
    }, {
      baseUrl: request.headers.get('origin') || undefined,
    })

    return NextResponse.json({
      ok: true,
      status: 'resent',
      message: `Novo convite enviado para ${emailNormalizado}`,
    })

  } catch (error) {
    console.error('[RESEND INVITE] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
