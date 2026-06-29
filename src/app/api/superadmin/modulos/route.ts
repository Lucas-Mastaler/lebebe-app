import { createServiceClient } from '@/lib/supabase/service'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'
import type { AppModulo } from '@/types/supabase'

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

    const { data, error } = await supabaseAdmin
      .from('app_modulos')
      .select('id, chave, nome, descricao, rota_base, categoria, publico, somente_superadmin, ativo, ordem')
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('nome', { ascending: true })

    if (error) {
      console.error('[SUPERADMIN MODULOS] Erro ao buscar módulos:', error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    const modulos: Pick<AppModulo, 'id' | 'chave' | 'nome' | 'descricao' | 'rota_base' | 'categoria' | 'publico' | 'somente_superadmin' | 'ativo' | 'ordem'>[] = data ?? []

    return NextResponse.json({
      ok: true,
      modulos,
    })

  } catch (error) {
    console.error('[SUPERADMIN MODULOS] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
