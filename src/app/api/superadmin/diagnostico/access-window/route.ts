import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { checkAccessWindowForUser, getTipoJanelaAtual, getAgoraLocalString } from '@/lib/auth/access-window'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
      requiredRole: 'superadmin',
    })

    if (!auth.ok) {
      return auth.response
    }

    const { searchParams } = new URL(request.url)
    const usuarioId = searchParams.get('usuarioId')?.trim()
    const nowParam = searchParams.get('now')?.trim()

    if (!usuarioId) {
      return NextResponse.json(
        { ok: false, message: 'Parâmetro usuarioId é obrigatório' },
        { status: 400 }
      )
    }

    // Valida o parâmetro now opcionalmente
    let now: Date | undefined
    if (nowParam) {
      const parsed = new Date(nowParam)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { ok: false, message: 'Parâmetro now inválido. Use ISO 8601 (ex: 2026-06-29T08:00:00Z)' },
          { status: 400 }
        )
      }
      now = parsed
    }

    // Busca role do usuário alvo
    const supabaseAdmin = createServiceClient()
    const { data: usuarioRow, error: usuarioError } = await supabaseAdmin
      .from('usuarios_permitidos')
      .select('id, email, role, ativo')
      .eq('id', usuarioId)
      .single()

    if (usuarioError || !usuarioRow) {
      return NextResponse.json(
        { ok: false, message: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    const role = usuarioRow.role as 'user' | 'superadmin'

    // Executa avaliação
    const resultado = await checkAccessWindowForUser({ usuarioId, role, now })

    const nowEfetivo = now ?? new Date()

    return NextResponse.json({
      ok: true,
      diagnostico: {
        usuarioId,
        usuarioEmail: usuarioRow.email,
        usuarioRole: role,
        usuarioAtivo: usuarioRow.ativo,
        ignoradoPorSuperadmin: role === 'superadmin',
        tipoJanelaAtual: getTipoJanelaAtual(nowEfetivo),
        agoraLocal: getAgoraLocalString(nowEfetivo),
        nowUtcUsado: nowEfetivo.toISOString(),
        resultado,
      },
    })

  } catch (error) {
    console.error('[DIAGNOSTICO ACCESS WINDOW] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
