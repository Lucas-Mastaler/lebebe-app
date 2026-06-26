import { createServiceClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/auth/helpers'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
      requiredRole: 'superadmin',
    })

    if (!auth.ok) {
      return auth.response
    }

    const { id } = await params

    if (!id?.trim()) {
      return NextResponse.json(
        { ok: false, message: 'ID do usuário é obrigatório' },
        { status: 400 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, message: 'Payload inválido' },
        { status: 400 }
      )
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, message: 'Payload inválido' },
        { status: 400 }
      )
    }

    const { role } = body as Record<string, unknown>

    if (role !== 'user' && role !== 'superadmin') {
      return NextResponse.json(
        { ok: false, message: 'Role inválida' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceClient()

    const { data: alvo, error: alvoError } = await supabaseAdmin
      .from('usuarios_permitidos')
      .select('id, email, role, ativo')
      .eq('id', id)
      .single()

    if (alvoError || !alvo) {
      return NextResponse.json(
        { ok: false, message: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    if (alvo.role === 'superadmin' && role === 'user') {
      const { data: superadminsAtivos, error: countError } = await supabaseAdmin
        .from('usuarios_permitidos')
        .select('id')
        .eq('role', 'superadmin')
        .eq('ativo', true)

      if (countError) {
        console.error('[SUPERADMIN ROLE] Erro ao contar superadmins:', countError)
        return NextResponse.json(
          { ok: false, message: 'Erro ao processar requisição' },
          { status: 500 }
        )
      }

      const ativos = Array.isArray(superadminsAtivos) ? superadminsAtivos.length : 0

      if (ativos <= 1) {
        return NextResponse.json(
          { ok: false, message: 'Não é possível remover o último superadmin ativo' },
          { status: 409 }
        )
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('usuarios_permitidos')
      .update({ role })
      .eq('id', id)

    if (updateError) {
      console.error('[SUPERADMIN ROLE] Erro ao atualizar role:', updateError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    await registrarAuditoria('ROLE_ALTERADA', auth.email, {
      usuario_alvo: alvo.email,
      usuario_alvo_id: alvo.id,
      role_anterior: alvo.role,
      role_nova: role,
    }, {
      baseUrl: request.headers.get('origin') || undefined,
    })

    return NextResponse.json({
      ok: true,
      message: 'Role alterada com sucesso',
    })

  } catch (error) {
    console.error('[SUPERADMIN ROLE] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
