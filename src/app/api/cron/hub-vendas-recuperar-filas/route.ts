import { NextRequest, NextResponse } from 'next/server'
import { recuperarFilasAbandonadasHubVendas } from '@/lib/digisac/hub-vendas/manutencao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIMITE_PADRAO = 10
const LIMITE_MAXIMO = 50

function validarCronSecret(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[HUB VENDAS RECUPERACAO] CRON_SECRET nao configurado')
    return NextResponse.json({ ok: false, error: 'cron_secret_nao_configurado' }, { status: 500 })
  }

  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${cronSecret}`) {
    console.error('[HUB VENDAS RECUPERACAO] Unauthorized: authorization=' + (authorization ? '[presente]' : '[ausente]'))
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  return null
}

function parseBooleanParam(request: NextRequest, nome: string): boolean {
  return request.nextUrl.searchParams.get(nome) === 'true'
}

function parseLimite(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get('limite')
  const valor = raw ? Number(raw) : LIMITE_PADRAO
  if (!Number.isInteger(valor) || valor < 1) return LIMITE_PADRAO
  return Math.min(valor, LIMITE_MAXIMO)
}

export async function GET(request: NextRequest) {
  const erroAuth = validarCronSecret(request)
  if (erroAuth) return erroAuth

  const inicio = Date.now()
  try {
    const resultado = await recuperarFilasAbandonadasHubVendas({
      limite: parseLimite(request),
      modoSimulacao: parseBooleanParam(request, 'modoSimulacao'),
    })
    console.log(
      `[HUB VENDAS CRON] recuperacao concluida total=${resultado.totalAnalisado} liberadas=${resultado.totalReservasLiberadas} incertos=${resultado.totalResultadoIncerto} duracaoMs=${Date.now() - inicio}`
    )
    return NextResponse.json(resultado)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_desconhecido'
    console.error(`[HUB VENDAS ALERTA] cron falhou rota=recuperar-filas erro=${message} duracaoMs=${Date.now() - inicio}`)
    return NextResponse.json({ ok: false, error: 'erro_recuperacao_filas' }, { status: 500 })
  }
}
