import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { ValorInicialRequest, ValorInicialResponseSucesso, ValorInicialResultado } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][valor-inicial] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as ValorInicialRequest
    const resultado = await chamarAppsScriptProcurarDatas<ValorInicialResultado>('calcularValorInicialModal', [body], {
      rota: 'valor-inicial',
      timeoutMs: 60_000,
    })

    console.log(`[PROCURAR_DATAS][valor-inicial] sucesso duracaoMs=${Date.now() - inicio}`)
    const resposta: ValorInicialResponseSucesso = { ok: true, resultado }
    return NextResponse.json(resposta)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][valor-inicial] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
