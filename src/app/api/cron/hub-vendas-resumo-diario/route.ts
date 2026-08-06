import { NextRequest, NextResponse } from 'next/server'
import { enviarResumoDiarioHubVendas } from '@/lib/digisac/hub-vendas/resumo-diario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function validarCronSecret(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[HUB VENDAS RESUMO] CRON_SECRET nao configurado')
    return NextResponse.json({ ok: false, error: 'cron_secret_nao_configurado' }, { status: 500 })
  }

  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${cronSecret}`) {
    console.error('[HUB VENDAS RESUMO] Unauthorized: authorization=' + (authorization ? '[presente]' : '[ausente]'))
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  return null
}

export async function GET(request: NextRequest) {
  const erroAuth = validarCronSecret(request)
  if (erroAuth) return erroAuth

  const inicio = Date.now()
  try {
    const resultado = await enviarResumoDiarioHubVendas()
    console.log(
      `[HUB VENDAS CRON] resumo diario concluido ok=${resultado.ok} data=${resultado.ok ? resultado.dataLocal : 'n/a'} enviado=${resultado.ok ? resultado.enviado : false} deduplicado=${resultado.ok ? resultado.deduplicado : false} duracaoMs=${Date.now() - inicio}`
    )

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.erro }, { status: 500 })
    }

    return NextResponse.json(resultado)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_desconhecido'
    console.error(`[HUB VENDAS ALERTA] cron falhou rota=resumo-diario erro=${message} duracaoMs=${Date.now() - inicio}`)
    return NextResponse.json({ ok: false, error: 'erro_resumo_diario' }, { status: 500 })
  }
}
