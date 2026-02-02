import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { registrarAuditoria } from '@/lib/auth/helpers'
import { enviarEmail, gerarHtmlConvite } from '@/lib/email/resend'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json(
        { ok: false, message: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { data: usuarioLogado } = await supabase
      .from('usuarios_permitidos')
      .select('role')
      .eq('email', user.email.toLowerCase())
      .single()

    if (usuarioLogado?.role !== 'superadmin') {
      return NextResponse.json(
        { ok: false, message: 'Acesso negado' },
        { status: 403 }
      )
    }

    const { email, role } = await request.json()

    if (!email || !role) {
      return NextResponse.json(
        { ok: false, message: 'Email e role são obrigatórios' },
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

    const { data: usuarioExistente } = await supabase
      .from('usuarios_permitidos')
      .select('id, ativo, last_invite_sent_at, invite_status')
      .eq('email', emailNormalizado)
      .single()

    if (usuarioExistente) {
      if (usuarioExistente.ativo && usuarioExistente.invite_status === 'accepted') {
        return NextResponse.json(
          { ok: false, message: 'Usuário já está cadastrado e ativo no sistema' },
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
              message: `Convite já enviado recentemente. Aguarde ${remainingSeconds} segundos para reenviar.` 
            },
            { status: 429 }
          )
        }
      }
    }

    const supabaseAdmin = createServiceClient()

    console.log(`[INVITE] Gerando link de convite para ${emailNormalizado}`)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: emailNormalizado,
      options: {
        redirectTo: `${appUrl}/definir-senha`,
      }
    })

    if (inviteError || !inviteData.properties?.action_link) {
      console.error('[INVITE ERROR]', inviteError)
      
      if (usuarioExistente) {
        await supabase
          .from('usuarios_permitidos')
          .update({ invite_status: 'failed' })
          .eq('email', emailNormalizado)
      }

      await registrarAuditoria('INVITE_EMAIL_FAILED', user.email, {
        target_email: emailNormalizado,
        error: inviteError?.message || 'Link não gerado',
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

      return NextResponse.json(
        { ok: false, message: 'Erro ao gerar link de convite: ' + (inviteError?.message || 'Link não gerado') },
        { status: 500 }
      )
    }

    console.log(`[INVITE] Link gerado com sucesso para ${emailNormalizado}`)

    const confirmUrl = inviteData.properties.action_link

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

      console.log(`[RESEND] Email enviado com sucesso para ${emailNormalizado}`)

      await registrarAuditoria('INVITE_EMAIL_SENT', user.email, {
        target_email: emailNormalizado,
        role: role,
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

    } catch (emailError: any) {
      console.error('[RESEND ERROR]', emailError)
      
      if (usuarioExistente) {
        await supabase
          .from('usuarios_permitidos')
          .update({ invite_status: 'failed' })
          .eq('email', emailNormalizado)
      }

      await registrarAuditoria('INVITE_EMAIL_FAILED', user.email, {
        target_email: emailNormalizado,
        error: emailError.message,
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

      return NextResponse.json(
        { ok: false, message: 'Erro ao enviar email: ' + emailError.message },
        { status: 500 }
      )
    }

    if (usuarioExistente) {
      const { error: updateError } = await supabase
        .from('usuarios_permitidos')
        .update({
          ativo: true,
          last_invite_sent_at: new Date().toISOString(),
          invite_status: 'sent',
        })
        .eq('email', emailNormalizado)

      if (updateError) {
        console.error('[INVITE] Erro ao atualizar registro existente:', updateError)
      }

      await registrarAuditoria('USUARIO_PERMITIDO_CRIADO', user.email, {
        novo_usuario: emailNormalizado,
        role: role,
        action: 'reactivated_and_sent',
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

      return NextResponse.json({
        ok: true,
        status: 'reactivated_and_sent',
        message: `Convite reenviado para ${emailNormalizado}`,
      })
    }

    const { error: insertError } = await supabase
      .from('usuarios_permitidos')
      .insert({
        email: emailNormalizado,
        role: role,
        ativo: true,
        last_invite_sent_at: new Date().toISOString(),
        invite_status: 'sent',
      })

    if (insertError) {
      console.error('[INVITE] Erro ao inserir usuário permitido:', insertError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao criar registro de permissão' },
        { status: 500 }
      )
    }

    await registrarAuditoria('USUARIO_PERMITIDO_CRIADO', user.email, {
      novo_usuario: emailNormalizado,
      role: role,
    }, {
      baseUrl: request.headers.get('origin') || undefined,
    })

    return NextResponse.json({
      ok: true,
      status: 'sent',
      message: `Convite enviado para ${emailNormalizado}. O usuário receberá um email para definir a senha.`,
    })

  } catch (error) {
    console.error('[INVITE] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
