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

export async function GET(request: NextRequest) {
  const erroAuth = validarCronSecret(request)
  if (erroAuth) return erroAuth

  try {
    const resultado = await prepararFilaRecuperacaoHubVendas({ limite: parseLimite(request) })
    return NextResponse.json(resultado)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_desconhecido'
    console.error(`[HUB VENDAS PREPARACAO] erro geral=${message}`)
    return NextResponse.json({ ok: false, error: 'erro_preparacao_fila' }, { status: 500 })
  }
}
