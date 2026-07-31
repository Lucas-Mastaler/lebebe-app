import { NextRequest, NextResponse } from 'next/server'
import { obterStatusHubVendas } from '@/lib/digisac/hub-vendas/status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function validarCronSecret(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[HUB VENDAS STATUS] CRON_SECRET nao configurado')
    return NextResponse.json({ ok: false, error: 'cron_secret_nao_configurado' }, { status: 500 })
  }

  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${cronSecret}`) {
    console.error('[HUB VENDAS STATUS] Unauthorized: authorization=' + (authorization ? '[presente]' : '[ausente]'))
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  return null
}

export async function GET(request: NextRequest) {
  const erroAuth = validarCronSecret(request)
  if (erroAuth) return erroAuth

  try {
    return NextResponse.json(await obterStatusHubVendas())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_desconhecido'
    console.error(`[HUB VENDAS STATUS] erro=${message}`)
    return NextResponse.json({ ok: false, error: 'erro_status_hub_vendas' }, { status: 500 })
  }
}
