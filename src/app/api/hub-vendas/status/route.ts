import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { obterStatusGestaoHubVendas } from '@/lib/digisac/hub-vendas/gestao'
import { obterIntervaloDatasLocaisUtc } from '@/lib/digisac/hub-vendas/tempo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/hub-vendas/status
// Retorna status geral da automação + estatísticas por loja.
// Acesso restrito ao módulo hub_vendas_gestao (somente superadmin).
export async function GET(request: Request) {
  try {
    const auth = await requireModuleAccess('hub_vendas_gestao')
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const somenteHistorico = searchParams.get('somenteHistorico') === 'true'
    if (Boolean(dataInicio) !== Boolean(dataFim)) {
      return NextResponse.json({ ok: false, error: 'periodo_incompleto', message: 'Informe as datas De e Até.' }, { status: 400 })
    }

    let periodo
    if (dataInicio && dataFim) {
      try {
        const intervalo = obterIntervaloDatasLocaisUtc(dataInicio, dataFim, 'America/Sao_Paulo')
        periodo = { inicioIso: intervalo.inicioUtc.toISOString(), fimIso: intervalo.fimUtc.toISOString() }
      } catch {
        return NextResponse.json({ ok: false, error: 'periodo_invalido', message: 'O período informado é inválido.' }, { status: 400 })
      }
    }

    const status = await obterStatusGestaoHubVendas(periodo, { incluirOperacional: !somenteHistorico })
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
