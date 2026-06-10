import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/configuracoes/procurar-datas/auditoria
//
// Retorna o histórico de edições manuais (acao = EDITADO_MANUALMENTE).
//
// Query params:
//   chave   — filtrar por chave específica (opcional, em UPPERCASE)
//   limite  — número de registros (padrão 50, máximo 200)
//
// Acesso restrito a superadmin.
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditoriaItem {
  id: string
  chave: string
  valor_anterior: string | null
  valor_novo: string | null
  acao: string
  origem: string
  alterado_por: string | null
  created_at: string
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 2. Verificar superadmin
    const { data: usuario } = await supabase
      .from('usuarios_permitidos')
      .select('role')
      .eq('email', user.email.toLowerCase())
      .single()

    if (usuario?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // 3. Parâmetros de query
    const url = new URL(request.url)
    const chaveParam = url.searchParams.get('chave')?.toUpperCase().trim() ?? null
    const limiteParam = parseInt(url.searchParams.get('limite') ?? '50', 10)
    const limite = Math.min(Math.max(1, isNaN(limiteParam) ? 50 : limiteParam), 200)

    // 4. Buscar auditoria (apenas edições manuais via tela)
    const db = createServiceClient()
    let query = db
      .from('procurar_datas_config_auditoria')
      .select('id, chave, valor_anterior, valor_novo, acao, origem, alterado_por, created_at')
      .eq('acao', 'EDITADO_MANUALMENTE')
      .order('created_at', { ascending: false })
      .limit(limite)

    if (chaveParam) {
      query = query.eq('chave', chaveParam)
    }

    const { data, error } = await query

    if (error) {
      console.error('[AUDITORIA] Erro ao buscar auditoria:', error.message)
      return NextResponse.json({ error: 'Erro ao buscar auditoria', message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      total: data?.length ?? 0,
      registros: (data ?? []) as AuditoriaItem[],
    })
  } catch (error: unknown) {
    console.error('[AUDITORIA] Erro crítico:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: 'Erro interno', message }, { status: 500 })
  }
}
