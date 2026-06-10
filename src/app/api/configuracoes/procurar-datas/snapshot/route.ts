import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buscarUltimoSnapshot } from '@/lib/procurar-datas/config-db'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────
// GET /api/configuracoes/procurar-datas/snapshot
//
// Retorna o último snapshot de importação salvo no Supabase.
// Se não houver nenhum, retorna { banco_vazio: true }.
//
// Acesso restrito a superadmin.
// ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // 2. Verificar superadmin
    const { data: usuario, error: dbError } = await supabase
      .from('usuarios_permitidos')
      .select('role')
      .eq('email', user.email.toLowerCase())
      .single()

    if (dbError || !usuario || usuario.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // 3. Buscar último snapshot
    const snapshot = await buscarUltimoSnapshot()

    if (!snapshot) {
      return NextResponse.json({ ok: true, banco_vazio: true, snapshot: null })
    }

    return NextResponse.json({ ok: true, banco_vazio: false, snapshot })
  } catch (error: unknown) {
    console.error('[SNAPSHOT] Erro crítico:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: 'Erro interno', message }, { status: 500 })
  }
}
