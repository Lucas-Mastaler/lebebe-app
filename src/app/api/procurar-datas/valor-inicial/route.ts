import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { ProcurarDatasServicoForm } from '@/lib/procurar-datas/types'

export const runtime = 'nodejs'

type ValorInicialResponse = {
  ok?: boolean
  valor?: number | null
  valorFormatado?: string
  valorFmt?: string
  distanciaKm?: number | null
  fallbackUsado?: boolean
  msg?: string
}

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][valor-inicial] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as ProcurarDatasServicoForm
    const resultado = await chamarAppsScriptProcurarDatas<ValorInicialResponse>('calcularValorInicialModal', [body], {
      rota: 'valor-inicial',
      timeoutMs: 60_000,
    })

    console.log(`[PROCURAR_DATAS][valor-inicial] sucesso duracaoMs=${Date.now() - inicio}`)
    return NextResponse.json({ ok: true, resultado })
  } catch (error) {
    console.error(`[PROCURAR_DATAS][valor-inicial] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
