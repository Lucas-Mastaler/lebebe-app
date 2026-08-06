import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { obterStatusGestaoHubVendas } from '@/lib/digisac/hub-vendas/gestao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/hub-vendas/status
// Retorna status geral da automação + estatísticas por loja.
// Acesso restrito ao módulo hub_vendas_gestao (somente superadmin).
export async function GET() {
  try {
    const auth = await requireModuleAccess('hub_vendas_gestao')
    if (!auth.ok) return auth.response

    const status = await obterStatusGestaoHubVendas()
    return NextResponse.json(status, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error: unknown) {
    console.error('[HUB VENDAS GESTAO] Erro ao obter status:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ ok: false, error: 'erro_interno', message }, { status: 500 })
  }
}
