import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { ProgressoPesquisaResponseSucesso, ProgressoPesquisa } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const inicio = Date.now()
  const clientToken = request.nextUrl.searchParams.get('clientToken') || ''
  console.log(`[PROCURAR_DATAS][progresso] inicio clientToken=${clientToken || '-'}`)

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    if (!clientToken) {
      return NextResponse.json({ ok: false, error: 'clientToken obrigatorio' }, { status: 400 })
    }

    const progress = await chamarAppsScriptProcurarDatas('GetProgressUpdate', [clientToken], {
      rota: 'progresso',
      clientToken,
      timeoutMs: 20_000,
    }) as ProgressoPesquisa

    console.log(`[PROCURAR_DATAS][progresso] sucesso clientToken=${clientToken} duracaoMs=${Date.now() - inicio}`)
    const resposta: ProgressoPesquisaResponseSucesso = { ok: true, progress }
    return NextResponse.json(resposta)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][progresso] erro clientToken=${clientToken || '-'} duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
