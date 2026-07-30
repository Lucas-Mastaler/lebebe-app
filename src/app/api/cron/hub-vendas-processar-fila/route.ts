import { NextRequest, NextResponse } from 'next/server'
import { processarFilaRecuperacaoHubVendas } from '@/lib/digisac/hub-vendas/processar-fila'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIMITE_PADRAO = 1
const LIMITE_MAXIMO = 5
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validarCronSecret(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[HUB VENDAS ENVIO] CRON_SECRET nao configurado')
    return NextResponse.json({ ok: false, error: 'cron_secret_nao_configurado' }, { status: 500 })
  }

  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${cronSecret}`) {
    console.error('[HUB VENDAS ENVIO] Unauthorized: authorization=' + (authorization ? '[presente]' : '[ausente]'))
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

function parseFilaId(request: NextRequest): { filaId?: string; error?: string } {
  const filaId = request.nextUrl.searchParams.get('filaId')?.trim()
  if (!filaId) return {}
  if (!UUID_REGEX.test(filaId)) return { error: 'fila_id_invalido' }
  return { filaId }
}

export async function GET(request: NextRequest) {
  const erroAuth = validarCronSecret(request)
  if (erroAuth) return erroAuth

  try {
    const { filaId, error } = parseFilaId(request)
    if (error) return NextResponse.json({ ok: false, error }, { status: 400 })

    const modoTeste = parseBooleanParam(request, 'modoTeste')
    const modoSimulacao = parseBooleanParam(request, 'modoSimulacao')

    if ((filaId || modoSimulacao) && !modoTeste) {
      return NextResponse.json({ ok: false, error: 'modo_teste_obrigatorio' }, { status: 400 })
    }
    if (modoTeste && !filaId) {
      return NextResponse.json({ ok: false, error: 'fila_id_obrigatorio_modo_teste' }, { status: 400 })
    }

    const resultado = await processarFilaRecuperacaoHubVendas({
      limite: parseLimite(request),
      filaId,
      modoTeste,
      modoSimulacao,
    })

    return NextResponse.json(resultado)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_desconhecido'
    console.error(`[HUB VENDAS ENVIO] erro geral=${message}`)
    return NextResponse.json({ ok: false, error: 'erro_processamento_fila' }, { status: 500 })
  }
}
