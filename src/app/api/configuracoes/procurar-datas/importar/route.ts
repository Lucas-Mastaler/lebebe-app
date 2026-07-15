import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { executarImportacao } from '@/lib/procurar-datas/config-db'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────
// POST /api/configuracoes/procurar-datas/importar
//
// Importação manual da planilha → Supabase.
// Cada chamada gera 1 snapshot imutável.
//
// IMPORTANTE:
//   - Ação exclusivamente manual; acionada por usuario com acesso ao modulo configuracoes_procurar_datas
//   - Não existe cron nem sincronização automática
//   - Secrets NUNCA são salvos no banco (is_secret=true → valor=null)
//   - Motor de busca NÃO é afetado
//
// Acesso restrito ao modulo configuracoes_procurar_datas.
// ─────────────────────────────────────────────────────────

export async function POST() {
  try {
    const auth = await requireModuleAccess('configuracoes_procurar_datas')

    if (!auth.ok) {
      return auth.response
    }

    console.log(`[IMPORTAR CONFIG] Importação iniciada por: ${auth.email}`)

    // 1. Executar importação
    const resultado = await executarImportacao(auth.email)

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
