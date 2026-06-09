import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { ProcurarDatasServicoForm } from '@/lib/procurar-datas/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  let clientToken = ''
  console.log('[PROCURAR_DATAS][pesquisar] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as ProcurarDatasServicoForm
    clientToken = body.clientToken || ''

    const resultado = await chamarAppsScriptProcurarDatas('ApiPesquisarDatasApp', [body], {
      rota: 'pesquisar',
      clientToken,
      timeoutMs: 180_000,
    })

    console.log(`[PROCURAR_DATAS][pesquisar] sucesso clientToken=${clientToken || '-'} duracaoMs=${Date.now() - inicio}`)
    return NextResponse.json(resultado)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][pesquisar] erro clientToken=${clientToken || '-'} duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
