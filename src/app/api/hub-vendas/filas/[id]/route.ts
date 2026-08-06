import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { obterDetalheFilaHubVendas } from '@/lib/digisac/hub-vendas/gestao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/hub-vendas/filas/[id]
// Detalhes de uma fila específica.
// Acesso restrito ao módulo hub_vendas_gestao (somente superadmin).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireModuleAccess('hub_vendas_gestao')
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ ok: false, error: 'id_invalido' }, { status: 400 })
    }

    const detalhe = await obterDetalheFilaHubVendas(id)
    if (!detalhe) {
      return NextResponse.json({ ok: false, error: 'fila_nao_encontrada' }, { status: 404 })
    }

    return NextResponse.json(detalhe, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error: unknown) {
    console.error('[HUB VENDAS GESTAO] Erro ao obter detalhe:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ ok: false, error: 'erro_interno', message }, { status: 500 })
  }
}
