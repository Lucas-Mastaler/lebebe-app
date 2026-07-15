import { createServiceClient } from '@/lib/supabase/service'
import { requireSuperadminUsersAccess } from '@/lib/auth/superadmin-users-access'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireSuperadminUsersAccess()

    if (!auth.ok) {
      return auth.response
    }

    const supabaseAdmin = createServiceClient()

    const [usuariosResult, perfisVinculosResult, unidadesVinculosResult] = await Promise.all([
      supabaseAdmin
        .from('usuarios_permitidos')
        .select('id, email, role, ativo, created_at')
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('app_usuarios_perfis')
        .select('usuario_id, perfil_id, app_perfis_acesso!inner(id, chave, nome, ativo)'),

      supabaseAdmin
        .from('app_usuarios_unidades')
        .select('usuario_id, unidade_id, app_unidades!inner(id, chave, nome, ativo, ordem)'),
    ])

    if (usuariosResult.error) {
      console.error('[SUPERADMIN USUARIOS] Erro ao buscar usuários:', usuariosResult.error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    if (perfisVinculosResult.error) {
      console.error('[SUPERADMIN USUARIOS] Erro ao buscar perfis vinculados:', perfisVinculosResult.error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    if (unidadesVinculosResult.error) {
      console.error('[SUPERADMIN USUARIOS] Erro ao buscar unidades vinculadas:', unidadesVinculosResult.error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisiÃ§Ã£o' },
        { status: 500 }
      )
    }

    type PerfilRow = { id: string; chave: string; nome: string; ativo: boolean }
    type VinculoRow = { usuario_id: string; perfil_id: string; app_perfis_acesso: PerfilRow }
    type UnidadeRow = { id: string; chave: string; nome: string; ativo: boolean; ordem: number | null }
    type VinculoUnidadeRow = { usuario_id: string; unidade_id: string; app_unidades: UnidadeRow }

    const perfilPorUsuario = new Map<string, PerfilRow>(
      ((perfisVinculosResult.data ?? []) as unknown as VinculoRow[]).map((v) => [
        v.usuario_id,
        v.app_perfis_acesso,
      ])
    )

    const unidadesPorUsuario = new Map<string, UnidadeRow[]>()
    for (const vinculo of (unidadesVinculosResult.data ?? []) as unknown as VinculoUnidadeRow[]) {
      const atuais = unidadesPorUsuario.get(vinculo.usuario_id) ?? []
      atuais.push(vinculo.app_unidades)
      unidadesPorUsuario.set(vinculo.usuario_id, atuais)
    }

    const usuarios = (usuariosResult.data ?? []).map((u) => {
      const perfil = perfilPorUsuario.get(u.id) ?? null
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        ativo: u.ativo,
        created_at: u.created_at,
        perfil: perfil
          ? { id: perfil.id, chave: perfil.chave, nome: perfil.nome, ativo: perfil.ativo }
          : null,
        unidades: (unidadesPorUsuario.get(u.id) ?? [])
          .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
          .map((unidade) => ({
            id: unidade.id,
            chave: unidade.chave,
            nome: unidade.nome,
            ativo: unidade.ativo,
            ordem: unidade.ordem,
          })),
      }
    })

    return NextResponse.json({
      ok: true,
      usuarios,
      acessoTotal: !auth.acessoLimitadoUsuarios,
    })

  } catch (error) {
    console.error('[SUPERADMIN USUARIOS] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
