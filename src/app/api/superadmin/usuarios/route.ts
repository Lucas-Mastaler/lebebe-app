import { createServiceClient } from '@/lib/supabase/service'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
      requiredRole: 'superadmin',
    })

    if (!auth.ok) {
      return auth.response
    }

    const supabaseAdmin = createServiceClient()

    const [usuariosResult, perfisVinculosResult] = await Promise.all([
      supabaseAdmin
        .from('usuarios_permitidos')
        .select('id, email, role, ativo, created_at')
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('app_usuarios_perfis')
        .select('usuario_id, perfil_id, app_perfis_acesso!inner(id, chave, nome, ativo)'),
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

    type PerfilRow = { id: string; chave: string; nome: string; ativo: boolean }
    type VinculoRow = { usuario_id: string; perfil_id: string; app_perfis_acesso: PerfilRow }

    const perfilPorUsuario = new Map<string, PerfilRow>(
      ((perfisVinculosResult.data ?? []) as unknown as VinculoRow[]).map((v) => [
        v.usuario_id,
        v.app_perfis_acesso,
      ])
    )

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
      }
    })

    return NextResponse.json({ ok: true, usuarios })

  } catch (error) {
    console.error('[SUPERADMIN USUARIOS] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
