import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { ProcurarDatasCandidate, ProcurarDatasPreAgendamentoMeta } from '@/lib/procurar-datas/types'
import type { PreAgendarResponseSucesso } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][pre-agendar] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as {
      cand?: ProcurarDatasCandidate
      meta?: ProcurarDatasPreAgendamentoMeta
    }

    if (!body.cand || !body.meta) {
      return NextResponse.json({ ok: false, error: 'cand e meta sao obrigatorios' }, { status: 400 })
    }

    const resultado = await chamarAppsScriptProcurarDatas('ApiPreAgendarDireto', [body.cand, body.meta], {
      rota: 'pre-agendar',
      timeoutMs: 60_000,
    }) as PreAgendarResponseSucesso

    console.log(`[PROCURAR_DATAS][pre-agendar] sucesso duracaoMs=${Date.now() - inicio}`)
    return NextResponse.json(resultado)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][pre-agendar] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
