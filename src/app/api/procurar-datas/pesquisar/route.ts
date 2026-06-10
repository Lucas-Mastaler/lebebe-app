import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { ProcurarDatasServicoForm } from '@/lib/procurar-datas/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  let clientToken = ''
  console.log('[PROCURAR_DATAS][pesquisar] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as ProcurarDatasServicoForm
    clientToken = body.clientToken || ''

    const resultado = await chamarAppsScriptProcurarDatas<{ ok?: boolean; clientToken?: string; status?: string; error?: string }>('ApiIniciarPesquisaDatasApp', [body], {
      rota: 'pesquisar',
      clientToken,
      timeoutMs: 30_000,
    })

    if (!resultado?.ok) {
      throw new Error(resultado?.error || 'Nao foi possivel iniciar a pesquisa.')
    }

    console.log(`[PROCURAR_DATAS][pesquisar] sucesso clientToken=${clientToken || '-'} duracaoMs=${Date.now() - inicio}`)
    return NextResponse.json({
      ok: true,
      clientToken: resultado.clientToken || clientToken,
      status: resultado.status || 'started',
    })
  } catch (error) {
    console.error(`[PROCURAR_DATAS][pesquisar] erro clientToken=${clientToken || '-'} duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
