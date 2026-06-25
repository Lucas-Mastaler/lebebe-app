import { NextResponse } from 'next/server'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import { montarOpcoesProcurarDatasLocais } from '@/lib/procurar-datas/opcoes-locais'
import type { OpcoesProcurarDatasResponseSucesso } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'

export async function GET() {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][opcoes] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const { opcoes, tempoMap } = await montarOpcoesProcurarDatasLocais()

    console.log(`[PROCURAR_DATAS][opcoes] sucesso origem=local duracaoMs=${Date.now() - inicio}`)
    const resposta: OpcoesProcurarDatasResponseSucesso = { ok: true, opcoes, tempoMap }
    return NextResponse.json(resposta)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][opcoes] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
