import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import {
  cancelarFilaAgendadaHubVendas,
  reprocessarFilaErroHubVendas,
  liberarAnaliseManualHubVendas,
} from '@/lib/digisac/hub-vendas/gestao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AcaoManual = 'cancelar_agendada' | 'reprocessar_erro' | 'liberar_analise_manual'

const ACOES_VALIDAS = new Set<AcaoManual>([
  'cancelar_agendada',
  'reprocessar_erro',
  'liberar_analise_manual',
])

// POST /api/hub-vendas/filas/[id]/acao
// Executa ação manual segura em uma fila específica.
// Acesso restrito ao módulo hub_vendas_gestao (somente superadmin).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireModuleAccess('hub_vendas_gestao')
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ ok: false, error: 'id_invalido' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'payload_invalido' }, { status: 400 })
    }

    const { acao, motivo, confirmado } = body as { acao?: unknown; motivo?: unknown; confirmado?: unknown }

    if (confirmado !== true) {
      return NextResponse.json({ ok: false, error: 'confirmacao_obrigatoria' }, { status: 400 })
    }

    if (typeof acao !== 'string' || !ACOES_VALIDAS.has(acao as AcaoManual)) {
      return NextResponse.json({ ok: false, error: 'acao_invalida' }, { status: 400 })
    }

    const motivoStr = typeof motivo === 'string' ? motivo : ''

    switch (acao as AcaoManual) {
      case 'cancelar_agendada': {
        const resultado = await cancelarFilaAgendadaHubVendas(id, motivoStr, auth.email)
        return NextResponse.json(resultado, { status: 200 })
      }
      case 'reprocessar_erro': {
        const resultado = await reprocessarFilaErroHubVendas(id, auth.email)
        return NextResponse.json(resultado, { status: 200 })
      }
      case 'liberar_analise_manual': {
        const resultado = await liberarAnaliseManualHubVendas(id, motivoStr, auth.email)
        return NextResponse.json(resultado, { status: 200 })
      }
      default:
        return NextResponse.json({ ok: false, error: 'acao_invalida' }, { status: 400 })
    }
  } catch (error: unknown) {
    console.error('[HUB VENDAS GESTAO] Erro ao executar ação manual:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    // Transição inválida = 409 Conflict
    const status = message.includes('Transição inválida') ? 409 : 500
    return NextResponse.json({ ok: false, error: status === 409 ? 'transicao_invalida' : 'erro_interno', message }, { status })
  }
}
