import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireSuperadminUsersAccess } from '@/lib/auth/superadmin-users-access'

export const runtime = 'nodejs'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadminUsersAccess()

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

    const { unidadeIds } = body as Record<string, unknown>
    if (!Array.isArray(unidadeIds) || unidadeIds.some((u) => typeof u !== 'string')) {
      return NextResponse.json(
        { ok: false, message: 'unidadeIds deve ser uma lista de IDs' },
        { status: 400 }
      )
    }

    const unidadeIdsUnicos = Array.from(new Set(unidadeIds as string[]))
    const supabaseAdmin = createServiceClient()

    const { data: usuarioAlvo, error: usuarioError } = await supabaseAdmin
      .from('usuarios_permitidos')
      .select('id, email, role')
      .eq('id', id)
      .single()

    if (usuarioError || !usuarioAlvo) {
      return NextResponse.json(
        { ok: false, message: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    if (auth.acessoLimitadoUsuarios) {
      if (usuarioAlvo.id === auth.allowedUser.id || usuarioAlvo.role === 'superadmin') {
        return NextResponse.json(
          { ok: false, message: 'Acesso negado' },
          { status: 403 }
        )
      }
    }

    if (unidadeIdsUnicos.length > 0) {
      const { data: unidadesValidas, error: unidadesError } = await supabaseAdmin
        .from('app_unidades')
        .select('id')
        .in('id', unidadeIdsUnicos)
        .eq('ativo', true)

      if (unidadesError) {
        console.error('[SUPERADMIN USUARIOS UNIDADES] Erro ao validar unidades:', unidadesError)
        return NextResponse.json(
          { ok: false, message: 'Erro ao processar requisição' },
          { status: 500 }
        )
      }

      const idsValidos = new Set((unidadesValidas ?? []).map((u) => u.id))
      if (unidadeIdsUnicos.some((unidadeId) => !idsValidos.has(unidadeId))) {
        return NextResponse.json(
          { ok: false, message: 'Uma ou mais unidades são inválidas ou inativas' },
          { status: 422 }
        )
      }
    }

    const { data: vinculosAnteriores } = await supabaseAdmin
      .from('app_usuarios_unidades')
      .select('unidade_id')
      .eq('usuario_id', id)

    const { error: deleteError } = await supabaseAdmin
      .from('app_usuarios_unidades')
      .delete()
      .eq('usuario_id', id)

    if (deleteError) {
      console.error('[SUPERADMIN USUARIOS UNIDADES] Erro ao remover vínculos anteriores:', deleteError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    if (unidadeIdsUnicos.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('app_usuarios_unidades')
        .insert(unidadeIdsUnicos.map((unidadeId) => ({
          usuario_id: id,
          unidade_id: unidadeId,
          atribuido_por: auth.allowedUser.id,
        })))

      if (insertError) {
        console.error('[SUPERADMIN USUARIOS UNIDADES] Erro ao inserir vínculos:', insertError)
        return NextResponse.json(
          { ok: false, message: 'Erro ao processar requisição' },
          { status: 500 }
        )
      }
    }

    await supabaseAdmin
      .from('app_auditoria_permissoes')
      .insert({
        ator_usuario_id: auth.allowedUser.id,
        alvo_usuario_id: id,
        acao: 'alterar_unidades_usuario',
        entidade: 'app_usuarios_unidades',
        entidade_id: id,
        antes: { unidade_ids: (vinculosAnteriores ?? []).map((v) => v.unidade_id) },
        depois: { unidade_ids: unidadeIdsUnicos },
        metadata: { usuario_email: usuarioAlvo.email },
      })

    return NextResponse.json({ ok: true, message: 'Unidades atualizadas com sucesso' })
  } catch (error) {
    console.error('[SUPERADMIN USUARIOS UNIDADES] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
