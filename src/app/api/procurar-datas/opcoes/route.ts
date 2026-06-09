import { NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'

export const runtime = 'nodejs'

export async function GET() {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][opcoes] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const [opcoes, tempoMap] = await Promise.all([
      chamarAppsScriptProcurarDatas('GetFrontOptionLists', [], { rota: 'opcoes' }),
      chamarAppsScriptProcurarDatas('GetTempoMap', [], { rota: 'opcoes' }),
    ])

    console.log(`[PROCURAR_DATAS][opcoes] sucesso duracaoMs=${Date.now() - inicio}`)
    return NextResponse.json({ ok: true, opcoes, tempoMap })
  } catch (error) {
    console.error(`[PROCURAR_DATAS][opcoes] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
