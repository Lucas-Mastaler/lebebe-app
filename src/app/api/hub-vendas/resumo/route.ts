import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { obterStatusResumoDiarioTela } from '@/lib/digisac/hub-vendas/resumo-diario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/hub-vendas/resumo
// Retorna status do último resumo diário enviado para a tela administrativa.
// Acesso restrito ao módulo hub_vendas_gestao (somente superadmin).
export async function GET() {
  try {
    const auth = await requireModuleAccess('hub_vendas_gestao')
    if (!auth.ok) return auth.response

    const resumo = await obterStatusResumoDiarioTela()
    return NextResponse.json({ ok: true, resumo })
  } catch (error: unknown) {
    console.error('[HUB VENDAS GESTAO] Erro ao obter status resumo:', error)
    return NextResponse.json({ ok: false, error: 'erro_interno' }, { status: 500 })
  }
}
