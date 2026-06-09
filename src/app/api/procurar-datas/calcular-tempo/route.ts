import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { ProcurarDatasServicoForm } from '@/lib/procurar-datas/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][calcular-tempo] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as ProcurarDatasServicoForm
    const tempoNecessario = await chamarAppsScriptProcurarDatas<string>('GetTempoNecessario', [body], {
      rota: 'calcular-tempo',
    })

    console.log(`[PROCURAR_DATAS][calcular-tempo] sucesso duracaoMs=${Date.now() - inicio}`)
    return NextResponse.json({ ok: true, tempoNecessario })
  } catch (error) {
    console.error(`[PROCURAR_DATAS][calcular-tempo] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
