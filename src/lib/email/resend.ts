import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface EnviarEmailParams {
  to: string
  subject: string
  html: string
}

export async function enviarEmail({ to, subject, html }: EnviarEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || 'lebebe.app@lebebe.cloud',
      to,
      subject,
      html,
      replyTo: process.env.RESEND_REPLY_TO,
    })

    if (error) {
      console.error('[RESEND ERROR]', error)
      throw new Error(error.message)
    }

    console.log(`[RESEND] Email enviado com sucesso messageId=${data?.id}`)
    return { success: true, messageId: data?.id }
  } catch (error: any) {
    console.error('[RESEND] Erro ao enviar email:', error)
    throw error
  }
}

export function gerarHtmlConvite({ confirmUrl, email }: { confirmUrl: string; email: string }) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite - le bébé</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header com logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <img src="https://phsoawbdvhurroryfnok.supabase.co/storage/v1/object/public/logo/logo.png" alt="le bébé" style="max-width: 120px; height: auto; margin-bottom: 20px;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0;">Bem-vindo ao le bébé!</h1>
            </td>
          </tr>
          
          <!-- Conteúdo -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 20px 0;">Olá!</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Você foi convidado para acessar o sistema <strong>le bébé</strong>.
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Para começar, você precisa definir sua senha clicando no botão abaixo:
              </p>
              
              <!-- Botão CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                      Definir Senha e Acessar
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 30px 0;">
                <p style="color: #92400e; font-size: 14px; line-height: 1.5; margin: 0;">
                  <strong>⚠️ Importante:</strong><br>
                  Este link é de uso único e expira em 24 horas.<br>
                  Se não funcionar, solicite um novo convite ao administrador.
                </p>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${confirmUrl}" style="color: #667eea; word-break: break-all;">${confirmUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0 0 10px 0;">
                Este email foi enviado para <strong>${email}</strong>
              </p>
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">
                © ${new Date().getFullYear()} le bébé - Todos os direitos reservados
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

export function gerarHtmlResetSenha({ confirmUrl, email }: { confirmUrl: string; email: string }) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha - le bébé</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header com logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <img src="https://phsoawbdvhurroryfnok.supabase.co/storage/v1/object/public/logo/logo.png" alt="le bébé" style="max-width: 120px; height: auto; margin-bottom: 20px;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0;">Recuperação de Senha</h1>
            </td>
          </tr>
          
          <!-- Conteúdo -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 20px 0;">Olá!</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>le bébé</strong>.
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Clique no botão abaixo para criar uma nova senha:
              </p>
              
              <!-- Botão CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                      Redefinir Senha
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 30px 0;">
                <p style="color: #92400e; font-size: 14px; line-height: 1.5; margin: 0;">
                  <strong>⚠️ Importante:</strong><br>
                  Este link é de uso único e expira em 1 hora.<br>
                  Se você não solicitou esta alteração, ignore este email.
                </p>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${confirmUrl}" style="color: #667eea; word-break: break-all;">${confirmUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0 0 10px 0;">
                Este email foi enviado para <strong>${email}</strong>
              </p>
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">
                © ${new Date().getFullYear()} le bébé - Todos os direitos reservados
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}
