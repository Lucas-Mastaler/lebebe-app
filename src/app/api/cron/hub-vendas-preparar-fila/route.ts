import { NextRequest, NextResponse } from 'next/server'
import { prepararFilaRecuperacaoHubVendas } from '@/lib/digisac/hub-vendas/preparar-fila'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function validarCronSecret(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[HUB VENDAS PREPARACAO] CRON_SECRET nao configurado')
    return NextResponse.json({ ok: false, error: 'cron_secret_nao_configurado' }, { status: 500 })
  }

  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${cronSecret}`) {
    console.error('[HUB VENDAS PREPARACAO] Unauthorized: authorization=' + (authorization ? '[presente]' : '[ausente]'))
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  return null
}

function parseLimite(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get('limite')
  const valor = raw ? Number(raw) : 50
  if (!Number.isInteger(valor) || valor < 1) return 50
  return Math.min(valor, 200)
}

function parseBooleanParam(request: NextRequest, nome: string): boolean {
  return request.nextUrl.searchParams.get(nome) === 'true'
}

function parseLeadId(request: NextRequest): { leadId?: string; error?: string } {
  const leadId = request.nextUrl.searchParams.get('leadId')?.trim()
  if (!leadId) return {}

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(leadId)) return { error: 'lead_id_invalido' }
  return { leadId }
}

export async function GET(request: NextRequest) {
  const erroAuth = validarCronSecret(request)
  if (erroAuth) return erroAuth

  try {
    const { leadId, error } = parseLeadId(request)
    if (error) return NextResponse.json({ ok: false, error }, { status: 400 })

    const modoTeste = parseBooleanParam(request, 'modoTeste')
    const modoSimulacao = parseBooleanParam(request, 'modoSimulacao')
    if ((leadId || modoSimulacao) && !modoTeste) {
      return NextResponse.json({ ok: false, error: 'modo_teste_obrigatorio' }, { status: 400 })
    }
    if (modoTeste && !leadId) {
      return NextResponse.json({ ok: false, error: 'lead_id_obrigatorio_modo_teste' }, { status: 400 })
    }

    const resultado = await prepararFilaRecuperacaoHubVendas({
      limite: parseLimite(request),
      leadId,
      modoTeste,
      modoSimulacao,
    })
    return NextResponse.json(resultado)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_desconhecido'
    console.error(`[HUB VENDAS PREPARACAO] erro geral=${message}`)
    return NextResponse.json({ ok: false, error: 'erro_preparacao_fila' }, { status: 500 })
  }
}
