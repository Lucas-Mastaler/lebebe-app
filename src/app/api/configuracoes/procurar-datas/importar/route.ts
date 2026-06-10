import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { executarImportacao } from '@/lib/procurar-datas/config-db'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────
// POST /api/configuracoes/procurar-datas/importar
//
// Importação manual da planilha → Supabase.
// Cada chamada gera 1 snapshot imutável.
//
// IMPORTANTE:
//   - Ação exclusivamente manual; acionada pelo superadmin
//   - Não existe cron nem sincronização automática
//   - Secrets NUNCA são salvos no banco (is_secret=true → valor=null)
//   - Motor de busca NÃO é afetado
//
// Acesso restrito a superadmin.
// ─────────────────────────────────────────────────────────

export async function POST() {
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
        { error: 'Acesso negado', message: 'Esta ação é restrita a superadmin.' },
        { status: 403 }
      )
    }

    console.log(`[IMPORTAR CONFIG] Importação iniciada por: ${user.email}`)

    // 3. Executar importação
    const resultado = await executarImportacao(user.email)

    if (!resultado.ok) {
      console.error('[IMPORTAR CONFIG] Erro na importação:', resultado.erro)
      return NextResponse.json(
        { error: 'Erro na importação', message: resultado.erro },
        { status: 502 }
      )
    }

    console.log(
      `[IMPORTAR CONFIG] Concluído: ${resultado.criados} criados, ` +
        `${resultado.alterados} alterados, ${resultado.inalterados} inalterados`
    )

    return NextResponse.json(resultado, { status: 200 })
  } catch (error: unknown) {
    console.error('[IMPORTAR CONFIG] Erro crítico:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: 'Erro interno', message }, { status: 500 })
  }
}
