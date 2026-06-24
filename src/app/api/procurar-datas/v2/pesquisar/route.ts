import { NextRequest, NextResponse } from 'next/server'
import { validarAcessoProcurarDatas, respostaErroProcurarDatas } from '@/lib/procurar-datas/api'
import { pesquisarDatasV2 } from '@/lib/procurar-datas/motor/pesquisar-datas-v2'
import type { PesquisarDatasRequest } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][v2/pesquisar] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as PesquisarDatasRequest
    const resultado = await pesquisarDatasV2(body)

    console.log(
      `[PROCURAR_DATAS][v2/pesquisar] fim ok=${resultado.ok} duracaoMs=${Date.now() - inicio}`
    )
    return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 })
  } catch (error) {
    console.error(`[PROCURAR_DATAS][v2/pesquisar] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
