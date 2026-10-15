import { NextResponse } from 'next/server'
import { requireHubVendasViewAccess } from '@/lib/auth/module-access'
import { obterStatusResumoDiarioTela } from '@/lib/digisac/hub-vendas/resumo-diario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/hub-vendas/resumo
// Retorna status do último resumo diário enviado para a tela administrativa.
// Leitura: visualização ou gerenciamento.
export async function GET() {
  try {
    const auth = await requireHubVendasViewAccess()
    if (!auth.ok) return auth.response

    const resumo = await obterStatusResumoDiarioTela()
    return NextResponse.json({ ok: true, resumo })
  } catch (error: unknown) {
    console.error('[HUB VENDAS GESTAO] Erro ao obter status resumo:', error)
    return NextResponse.json({ ok: false, error: 'erro_interno' }, { status: 500 })
  }
}
