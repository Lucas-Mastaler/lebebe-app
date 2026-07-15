import { createServiceClient } from '@/lib/supabase/service'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import {
  getProfilePermissionGroupLabel,
  getProfilePermissionOrder,
  type AppModuleKey,
} from '@/lib/auth/modulos-app'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
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
        { ok: false, message: 'ID do perfil é obrigatório' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceClient()

    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('app_perfis_acesso')
      .select('id, chave, nome, ativo')
      .eq('id', id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json(
        { ok: false, message: 'Perfil não encontrado' },
        { status: 404 }
      )
    }

    const [modulosResult, permissoesResult] = await Promise.all([
      supabaseAdmin
        .from('app_modulos')
        .select('id, chave, nome, rota_base, categoria, ordem')
        .eq('ativo', true)
        .eq('publico', false)
        .eq('somente_superadmin', false)
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('nome', { ascending: true }),

      supabaseAdmin
        .from('app_permissoes_perfil')
        .select('modulo_id, permitido')
        .eq('perfil_id', id),
    ])

    if (modulosResult.error) {
      console.error('[SUPERADMIN PERFIS PERMISSOES GET] Erro ao buscar módulos:', modulosResult.error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    if (permissoesResult.error) {
      console.error('[SUPERADMIN PERFIS PERMISSOES GET] Erro ao buscar permissões:', permissoesResult.error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    const permissoesMap = new Map<string, boolean>(
      (permissoesResult.data ?? []).map((p) => [p.modulo_id, p.permitido])
    )

    const permissoes = (modulosResult.data ?? [])
      .map((m) => {
        const moduleKey = m.chave as AppModuleKey
        return {
          moduloId: m.id,
          chave: m.chave,
          nome: m.nome,
          rotaBase: m.rota_base,
          categoria: m.categoria,
          ordem: m.ordem,
          grupo: getProfilePermissionGroupLabel(moduleKey),
          permitido: permissoesMap.get(m.id) ?? false,
        }
      })
      .sort((a, b) => {
        const orderA = getProfilePermissionOrder(a.chave as AppModuleKey)
        const orderB = getProfilePermissionOrder(b.chave as AppModuleKey)
        if (orderA !== orderB) return orderA - orderB
        return (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER)
      })

    return NextResponse.json({
      ok: true,
      perfil: { id: perfil.id, chave: perfil.chave, nome: perfil.nome, ativo: perfil.ativo },
      permissoes,
    })

  } catch (error) {
    console.error('[SUPERADMIN PERFIS PERMISSOES GET] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
        { ok: false, message: 'ID do perfil é obrigatório' },
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

    const { permissoes } = body as Record<string, unknown>

    if (!Array.isArray(permissoes) || permissoes.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'permissoes deve ser array não vazio' },
        { status: 400 }
      )
    }

    for (const item of permissoes) {
      if (
        typeof item !== 'object' || item === null ||
        typeof (item as Record<string, unknown>).moduloId !== 'string' ||
        typeof (item as Record<string, unknown>).permitido !== 'boolean'
      ) {
        return NextResponse.json(
          { ok: false, message: 'Cada item de permissoes deve ter moduloId (string) e permitido (boolean)' },
          { status: 400 }
        )
      }
    }

    const supabaseAdmin = createServiceClient()

    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('app_perfis_acesso')
      .select('id, chave, nome, ativo')
      .eq('id', id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json(
        { ok: false, message: 'Perfil não encontrado' },
        { status: 404 }
      )
    }

    if (!perfil.ativo) {
      return NextResponse.json(
        { ok: false, message: 'Não é possível editar permissões de perfil inativo' },
        { status: 422 }
      )
    }

    // Validar que os moduloIds são módulos controláveis (ativo, não público, não somente_superadmin)
    const moduloIds = permissoes.map((p) => (p as Record<string, unknown>).moduloId as string)

    const { data: modulosValidos, error: modulosError } = await supabaseAdmin
      .from('app_modulos')
      .select('id')
      .in('id', moduloIds)
      .eq('ativo', true)
      .eq('publico', false)
      .eq('somente_superadmin', false)

    if (modulosError) {
      console.error('[SUPERADMIN PERFIS PERMISSOES PUT] Erro ao validar módulos:', modulosError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    const modulosValidosSet = new Set((modulosValidos ?? []).map((m) => m.id))
    const invalidos = moduloIds.filter((mid) => !modulosValidosSet.has(mid))

    if (invalidos.length > 0) {
      return NextResponse.json(
        { ok: false, message: 'Um ou mais moduloId são inválidos, públicos, exclusivos de superadmin ou inativos' },
        { status: 400 }
      )
    }

    // Snapshot anterior para auditoria
    const { data: permissoesAntes } = await supabaseAdmin
      .from('app_permissoes_perfil')
      .select('modulo_id, permitido')
      .eq('perfil_id', id)

    const rows = permissoes.map((item) => {
      const p = item as { moduloId: string; permitido: boolean }
      return {
        perfil_id: id,
        modulo_id: p.moduloId,
        permitido: p.permitido,
      }
    })

    const { error: upsertError } = await supabaseAdmin
      .from('app_permissoes_perfil')
      .upsert(rows, { onConflict: 'perfil_id,modulo_id' })

    if (upsertError) {
      console.error('[SUPERADMIN PERFIS PERMISSOES PUT] Erro ao salvar permissões:', upsertError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    await supabaseAdmin
      .from('app_auditoria_permissoes')
      .insert({
        ator_usuario_id: auth.allowedUser!.id,
        alvo_usuario_id: null,
        acao: 'atualizar_permissoes_perfil',
        entidade: 'app_permissoes_perfil',
        entidade_id: perfil.id,
        antes: { permissoes: permissoesAntes ?? [] },
        depois: { permissoes: rows.map((r) => ({ modulo_id: r.modulo_id, permitido: r.permitido })) },
        metadata: { perfil_chave: perfil.chave, perfil_nome: perfil.nome },
      })

    return NextResponse.json({
      ok: true,
      message: 'Permissões atualizadas com sucesso',
    })

  } catch (error) {
    console.error('[SUPERADMIN PERFIS PERMISSOES PUT] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
