import { NextResponse } from 'next/server'
import { requireHubVendasManageAccess } from '@/lib/auth/module-access'
import { pausarAutomacaoHubVendas } from '@/lib/digisac/hub-vendas/gestao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/hub-vendas/pausar
// Pausa a automação Hub/Vendas (apenas configuração persistida, não remove cron).
// Alteração: somente gerenciamento.
export async function POST(request: Request) {
  try {
    const auth = await requireHubVendasManageAccess()
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'payload_invalido' }, { status: 400 })
    }

    const { motivo, confirmado } = body as { motivo?: unknown; confirmado?: unknown }

    if (confirmado !== true) {
      return NextResponse.json({ ok: false, error: 'confirmacao_obrigatoria' }, { status: 400 })
    }

    const motivoStr = typeof motivo === 'string' ? motivo : ''
    const resultado = await pausarAutomacaoHubVendas(motivoStr, auth.email)
    return NextResponse.json(resultado, { status: 200 })
  } catch (error: unknown) {
    console.error('[HUB VENDAS GESTAO] Erro ao pausar automação:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ ok: false, error: 'erro_interno', message }, { status: 500 })
  }
}
