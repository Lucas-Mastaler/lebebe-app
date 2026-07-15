import { createServiceClient } from '@/lib/supabase/service'
import { requireSuperadminUsersAccess } from '@/lib/auth/superadmin-users-access'
import { validarPerfilAtribuivel } from '@/lib/superadmin/usuarios'
import { NextResponse } from 'next/server'

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
        { ok: false, message: 'ID do usuario e obrigatorio' },
        { status: 400 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, message: 'Payload invalido' },
        { status: 400 }
      )
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, message: 'Payload invalido' },
        { status: 400 }
      )
    }

    const { perfilId } = body as Record<string, unknown>

    if (typeof perfilId !== 'string' || !perfilId.trim()) {
      return NextResponse.json(
        { ok: false, message: 'perfilId e obrigatorio' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceClient()

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios_permitidos')
      .select('id, email, role')
      .eq('id', id)
      .single()

    if (usuarioError || !usuario) {
      return NextResponse.json(
        { ok: false, message: 'Usuario nao encontrado' },
        { status: 404 }
      )
    }

    if (auth.acessoLimitadoUsuarios) {
      if (usuario.id === auth.allowedUser.id || usuario.role === 'superadmin') {
        return NextResponse.json(
          { ok: false, message: 'Acesso negado' },
          { status: 403 }
        )
      }
    }

    const perfilResult = await validarPerfilAtribuivel(
      supabaseAdmin,
      perfilId,
      auth.acessoLimitadoUsuarios
    )

    if (!perfilResult.ok) {
      return NextResponse.json(
        { ok: false, message: perfilResult.message },
        { status: perfilResult.status }
      )
    }

    const perfil = perfilResult.perfil

    const { data: perfilAnterior } = await supabaseAdmin
      .from('app_usuarios_perfis')
      .select('perfil_id')
      .eq('usuario_id', id)
      .single()

    const { error: upsertError } = await supabaseAdmin
      .from('app_usuarios_perfis')
      .upsert(
        {
          usuario_id: id,
          perfil_id: perfilId,
          atribuido_por: auth.allowedUser.id,
        },
        { onConflict: 'usuario_id' }
      )

    if (upsertError) {
      console.error('[SUPERADMIN USUARIOS PERFIL PUT] Erro ao atribuir perfil:', upsertError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisicao' },
        { status: 500 }
      )
    }

    await supabaseAdmin
      .from('app_auditoria_permissoes')
      .insert({
        ator_usuario_id: auth.allowedUser.id,
        alvo_usuario_id: id,
        acao: 'atribuir_perfil',
        entidade: 'app_usuarios_perfis',
        entidade_id: perfilId,
        antes: perfilAnterior ? { perfil_id: perfilAnterior.perfil_id } : null,
        depois: { perfil_id: perfilId, perfil_chave: perfil.chave },
        metadata: { usuario_email: usuario.email, perfil_nome: perfil.nome },
      })

    return NextResponse.json({
      ok: true,
      message: 'Perfil atribuido com sucesso',
    })
  } catch (error) {
    console.error('[SUPERADMIN USUARIOS PERFIL PUT] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisicao' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
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
        { ok: false, message: 'ID do usuario e obrigatorio' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceClient()

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios_permitidos')
      .select('id, email, role')
      .eq('id', id)
      .single()

    if (usuarioError || !usuario) {
      return NextResponse.json(
        { ok: false, message: 'Usuario nao encontrado' },
        { status: 404 }
      )
    }

    if (auth.acessoLimitadoUsuarios) {
      if (usuario.id === auth.allowedUser.id || usuario.role === 'superadmin') {
        return NextResponse.json(
          { ok: false, message: 'Acesso negado' },
          { status: 403 }
        )
      }
    }

    const { data: vinculoAtual, error: vinculoError } = await supabaseAdmin
      .from('app_usuarios_perfis')
      .select('perfil_id')
      .eq('usuario_id', id)
      .single()

    if (vinculoError || !vinculoAtual) {
      return NextResponse.json(
        { ok: false, message: 'Usuario nao possui perfil atribuido' },
        { status: 404 }
      )
    }

    const { error: deleteError } = await supabaseAdmin
      .from('app_usuarios_perfis')
      .delete()
      .eq('usuario_id', id)

    if (deleteError) {
      console.error('[SUPERADMIN USUARIOS PERFIL DELETE] Erro ao remover perfil:', deleteError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisicao' },
        { status: 500 }
      )
    }

    await supabaseAdmin
      .from('app_auditoria_permissoes')
      .insert({
        ator_usuario_id: auth.allowedUser.id,
        alvo_usuario_id: id,
        acao: 'remover_perfil',
        entidade: 'app_usuarios_perfis',
        entidade_id: vinculoAtual.perfil_id,
        antes: { perfil_id: vinculoAtual.perfil_id },
        depois: null,
        metadata: { usuario_email: usuario.email },
      })

    return NextResponse.json({
      ok: true,
      message: 'Perfil removido com sucesso',
    })
  } catch (error) {
    console.error('[SUPERADMIN USUARIOS PERFIL DELETE] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisicao' },
      { status: 500 }
    )
  }
}
