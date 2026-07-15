import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireSuperadminUsersAccess } from '@/lib/auth/superadmin-users-access'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireSuperadminUsersAccess()

    if (!auth.ok) {
      return auth.response
    }

    const supabaseAdmin = createServiceClient()

    const { data, error } = await supabaseAdmin
      .from('app_unidades')
      .select('id, chave, nome, ativo, ordem')
      .eq('ativo', true)
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('nome', { ascending: true })

    if (error) {
      console.error('[SUPERADMIN UNIDADES] Erro ao buscar unidades:', error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, unidades: data ?? [] })
  } catch (error) {
    console.error('[SUPERADMIN UNIDADES] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
