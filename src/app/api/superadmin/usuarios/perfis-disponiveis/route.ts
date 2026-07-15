import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireSuperadminUsersAccess, SUPERADMIN_USUARIOS_MODULE_KEY } from '@/lib/auth/superadmin-users-access'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireSuperadminUsersAccess()

    if (!auth.ok) {
      return auth.response
    }

    const supabaseAdmin = createServiceClient()

    const { data: perfis, error: perfisError } = await supabaseAdmin
      .from('app_perfis_acesso')
      .select('id, chave, nome, ativo')
      .eq('ativo', true)
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('nome', { ascending: true })

    if (perfisError) {
      console.error('[SUPERADMIN USUARIOS PERFIS DISPONIVEIS] Erro ao buscar perfis:', perfisError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    if (!auth.acessoLimitadoUsuarios) {
      return NextResponse.json({ ok: true, perfis: perfis ?? [] })
    }

    const { data: moduloUsuarios, error: moduloError } = await supabaseAdmin
      .from('app_modulos')
      .select('id')
      .eq('chave', SUPERADMIN_USUARIOS_MODULE_KEY)
      .single()

    if (moduloError || !moduloUsuarios) {
      return NextResponse.json({ ok: true, perfis: [] })
    }

    const { data: perfisComGestaoUsuarios, error: permissoesError } = await supabaseAdmin
      .from('app_permissoes_perfil')
      .select('perfil_id')
      .eq('modulo_id', moduloUsuarios.id)
      .eq('permitido', true)

    if (permissoesError) {
      console.error('[SUPERADMIN USUARIOS PERFIS DISPONIVEIS] Erro ao filtrar perfis:', permissoesError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    const perfisRestritos = new Set((perfisComGestaoUsuarios ?? []).map((p) => p.perfil_id))
    const perfisSeguros = (perfis ?? []).filter((perfil) => !perfisRestritos.has(perfil.id))

    return NextResponse.json({ ok: true, perfis: perfisSeguros })
  } catch (error) {
    console.error('[SUPERADMIN USUARIOS PERFIS DISPONIVEIS] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
