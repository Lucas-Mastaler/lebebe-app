import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { obterResumoAlertasTela } from '@/lib/digisac/hub-vendas/alertas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/hub-vendas/alertas
// Retorna resumo de alertas das últimas 24h para a tela administrativa.
// Acesso restrito ao módulo hub_vendas_gestao (somente superadmin).
export async function GET() {
  try {
    const auth = await requireModuleAccess('hub_vendas_gestao')
    if (!auth.ok) return auth.response

    const alertas = await obterResumoAlertasTela()
    return NextResponse.json({ ok: true, alertas })
  } catch (error: unknown) {
    console.error('[HUB VENDAS GESTAO] Erro ao obter alertas:', error)
    return NextResponse.json({ ok: false, error: 'erro_interno' }, { status: 500 })
  }
}
