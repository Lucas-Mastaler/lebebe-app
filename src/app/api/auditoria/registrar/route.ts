import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { AcaoAuditoria } from '@/types/supabase'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

const ACOES_PERMITIDAS: readonly AcaoAuditoria[] = [
  'LOGIN_SUCESSO',
  'LOGIN_FALHA',
  'LOGOUT',
  'AUTO_LOGOUT_19H',
  'RESET_SOLICITADO',
  'RESET_CONCLUIDO',
  'SENHA_DEFINIDA',
  'USUARIO_PERMITIDO_CRIADO',
  'USUARIO_BLOQUEADO',
  'USUARIO_DESBLOQUEADO',
  'ROLE_ALTERADA',
  'INVITE_EMAIL_SENT',
  'INVITE_EMAIL_FAILED',
  'RESET_EMAIL_SENT',
  'RESET_EMAIL_FAILED',
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const METADATA_MAX_BYTES = 2048

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Payload inválido' },
        { status: 400 }
      )
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Payload inválido' },
        { status: 400 }
      )
    }

    const { acao, email: emailDoBody, metadata } = body as Record<string, unknown>

    if (!acao || typeof acao !== 'string') {
      return NextResponse.json(
        { error: 'Ação é obrigatória' },
        { status: 400 }
      )
    }

    if (!(ACOES_PERMITIDAS as readonly string[]).includes(acao)) {
      return NextResponse.json(
        { error: 'Ação não permitida' },
        { status: 400 }
      )
    }

    if (metadata !== undefined && metadata !== null) {
      if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        return NextResponse.json(
          { error: 'Metadata inválido' },
          { status: 400 }
        )
      }
      const metadataStr = JSON.stringify(metadata)
      if (metadataStr.length > METADATA_MAX_BYTES) {
        return NextResponse.json(
          { error: 'Metadata excede tamanho permitido' },
          { status: 400 }
        )
      }
    }

    const headersList = await headers()

    // ─────────────────────────────────────────────────────────
    // Autenticação: três caminhos possíveis
    // ─────────────────────────────────────────────────────────

    const internalToken = headersList.get('x-internal-token')
    const internalSecret = process.env.AUDITORIA_INTERNAL_SECRET

    let emailFinal: string | null = null

    if (internalSecret && internalToken === internalSecret) {
      // Caminho 1: chamada server-side interna autenticada por token interno
      // Email vem do body, validado pela rota chamadora (que conhece o usuário real)
      if (emailDoBody !== undefined && emailDoBody !== null) {
        if (typeof emailDoBody !== 'string' || emailDoBody.length > 255 || !EMAIL_REGEX.test(emailDoBody)) {
          return NextResponse.json(
            { error: 'Email inválido' },
            { status: 400 }
          )
        }
        emailFinal = emailDoBody
      }
    } else {
      // Caminho 2: chamada browser — tentar obter sessão via cookie same-origin
      const supabaseBrowser = await createClient()
      const { data: { user } } = await supabaseBrowser.auth.getUser()

      if (!user?.email) {
        // Sem token interno válido e sem sessão → 401
        return NextResponse.json(
          { error: 'Não autenticado' },
          { status: 401 }
        )
      }

      // Email da sessão sobrepõe qualquer email enviado pelo client
      emailFinal = user.email.toLowerCase()
    }

    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('auditoria_acessos')
      .insert({
        acao: acao as AcaoAuditoria,
        email: emailFinal,
        ip,
        user_agent: userAgent,
        metadata: (metadata as Record<string, unknown>) || null,
      })

    if (error) {
      console.error('Erro ao registrar auditoria:', error)
      return NextResponse.json(
        { error: 'Erro ao registrar auditoria' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao processar requisição de auditoria:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
