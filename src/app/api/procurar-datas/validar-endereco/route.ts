import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { ValidarEnderecoRequest, ValidarEnderecoResponseSucesso, EnderecoValidado } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][validar-endereco] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as ValidarEnderecoRequest
    const resultado = await chamarAppsScriptProcurarDatas('LookupCompletoPorEndereco', [body], {
      rota: 'validar-endereco',
    }) as EnderecoValidado

    console.log(`[PROCURAR_DATAS][validar-endereco] sucesso duracaoMs=${Date.now() - inicio}`)
    const resposta: ValidarEnderecoResponseSucesso = { ok: true, resultado }
    return NextResponse.json(resposta)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][validar-endereco] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
