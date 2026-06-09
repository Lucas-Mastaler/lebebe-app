import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { ProcurarDatasEnderecoForm } from '@/lib/procurar-datas/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][validar-endereco] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as ProcurarDatasEnderecoForm
    const resultado = await chamarAppsScriptProcurarDatas('LookupCompletoPorEndereco', [body], {
      rota: 'validar-endereco',
    })

    console.log(`[PROCURAR_DATAS][validar-endereco] sucesso duracaoMs=${Date.now() - inicio}`)
    return NextResponse.json({ ok: true, resultado })
  } catch (error) {
    console.error(`[PROCURAR_DATAS][validar-endereco] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
