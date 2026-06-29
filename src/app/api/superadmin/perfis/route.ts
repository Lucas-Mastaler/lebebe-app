import { createServiceClient } from '@/lib/supabase/service'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
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
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const supabaseAdmin = createServiceClient()

    let query = supabaseAdmin
      .from('app_perfis_acesso')
      .select('id, chave, nome, descricao, ativo, sistema, ordem')
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('nome', { ascending: true })

    if (!includeInactive) {
      query = query.eq('ativo', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('[SUPERADMIN PERFIS] Erro ao buscar perfis:', error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      perfis: data ?? [],
    })

  } catch (error) {
    console.error('[SUPERADMIN PERFIS] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
