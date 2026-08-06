import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { listarFilasHubVendas, type FiltrosListagemFilas } from '@/lib/digisac/hub-vendas/gestao'
import type { HubVendasLoja } from '@/lib/digisac/hub-vendas/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOJAS_VALIDAS = new Set<string>(['portao', 'bigorrilho', 'hauer_marechal'])

// GET /api/hub-vendas/filas
// Listagem paginada de filas com filtros.
// Acesso restrito ao módulo hub_vendas_gestao (somente superadmin).
export async function GET(request: Request) {
  try {
    const auth = await requireModuleAccess('hub_vendas_gestao')
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)

    const pagina = searchParams.get('pagina') ? parseInt(searchParams.get('pagina')!, 10) : 1
    const porPagina = searchParams.get('porPagina') ? parseInt(searchParams.get('porPagina')!, 10) : 20
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const lojaParam = searchParams.get('loja')
    const status = searchParams.get('status')
    const cliente = searchParams.get('cliente')
    const telefoneParcial = searchParams.get('telefoneParcial')
    const filaId = searchParams.get('filaId')
    const leadId = searchParams.get('leadId')
    const somenteErros = searchParams.get('somenteErros') === 'true'
    const somenteAnaliseManual = searchParams.get('somenteAnaliseManual') === 'true'
    const somenteResultadoIncerto = searchParams.get('somenteResultadoIncerto') === 'true'

    const loja = lojaParam && LOJAS_VALIDAS.has(lojaParam) ? (lojaParam as HubVendasLoja) : null

    const filtros: FiltrosListagemFilas = {
      pagina: isNaN(pagina) ? 1 : pagina,
      porPagina: isNaN(porPagina) ? 20 : porPagina,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      loja: loja ?? undefined,
      status: status || undefined,
      cliente: cliente || undefined,
      telefoneParcial: telefoneParcial || undefined,
      filaId: filaId || undefined,
      leadId: leadId || undefined,
      somenteErros: somenteErros || undefined,
      somenteAnaliseManual: somenteAnaliseManual || undefined,
      somenteResultadoIncerto: somenteResultadoIncerto || undefined,
    }

    const resultado = await listarFilasHubVendas(filtros)
    return NextResponse.json(resultado, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error: unknown) {
    console.error('[HUB VENDAS GESTAO] Erro ao listar filas:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ ok: false, error: 'erro_interno', message }, { status: 500 })
  }
}
