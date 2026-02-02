import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { registrarAuditoria } from '@/lib/auth/helpers'
import { enviarEmail, gerarHtmlResetSenha } from '@/lib/email/resend'
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
      .select('email, ativo')
      .eq('email', emailNormalizado)
      .single()

    if (!usuarioExistente || !usuarioExistente.ativo) {
      console.log(`[RESET] Email não encontrado ou inativo: ${emailNormalizado}`)
      
      return NextResponse.json({
        ok: true,
        message: 'Se o email estiver cadastrado, você receberá um link para redefinir sua senha.',
      })
    }

    const supabaseAdmin = createServiceClient()

    console.log(`[RESET] Gerando link de recuperação para ${emailNormalizado}`)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'

    const { data, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: emailNormalizado,
      options: {
        redirectTo: `${appUrl}/resetar-senha`,
      }
    })

    if (resetError || !data.properties?.action_link) {
      console.error('[RESET ERROR]', resetError)

      await registrarAuditoria('RESET_EMAIL_FAILED', emailNormalizado, {
        error: resetError?.message || 'Link não gerado',
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

      return NextResponse.json(
        { ok: false, message: 'Erro ao gerar link de recuperação' },
        { status: 500 }
      )
    }

    console.log(`[RESET] Link gerado com sucesso para ${emailNormalizado}`)

    const confirmUrl = data.properties.action_link

    console.log(`[RESEND] Enviando email de reset para ${emailNormalizado}`)

    try {
      const htmlEmail = gerarHtmlResetSenha({ 
        confirmUrl,
        email: emailNormalizado 
      })

      await enviarEmail({
        to: emailNormalizado,
        subject: 'Recuperação de Senha - le bébé',
        html: htmlEmail,
      })

      console.log(`[RESEND] Email de reset enviado com sucesso para ${emailNormalizado}`)

      await registrarAuditoria('RESET_EMAIL_SENT', emailNormalizado, {
        action: 'password_reset',
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

      await registrarAuditoria('RESET_SOLICITADO', emailNormalizado, {}, {
        baseUrl: request.headers.get('origin') || undefined,
      })

      return NextResponse.json({
        ok: true,
        message: 'Email de recuperação enviado com sucesso. Verifique sua caixa de entrada.',
      })

    } catch (emailError: any) {
      console.error('[RESEND ERROR]', emailError)

      await registrarAuditoria('RESET_EMAIL_FAILED', emailNormalizado, {
        error: emailError.message,
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

      return NextResponse.json(
        { ok: false, message: 'Erro ao enviar email: ' + emailError.message },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[RESET] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
