import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import { buscarEnderecoNoGeoCache } from '@/lib/procurar-datas/endereco-cache'
import type { ValidarEnderecoRequest, ValidarEnderecoResponseSucesso, EnderecoValidado } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][validar-endereco] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as ValidarEnderecoRequest

    const cacheHit = await buscarEnderecoNoGeoCache(body)
    if (cacheHit) {
      console.log(
        `[PROCURAR_DATAS][validar-endereco] cache_hit provider=supabase fallback=none duracaoMs=${Date.now() - inicio}`
      )
      const resposta: ValidarEnderecoResponseSucesso = { ok: true, resultado: cacheHit }
      return NextResponse.json(resposta)
    }

    console.log('[PROCURAR_DATAS][validar-endereco] cache_miss provider=supabase fallback=appsscript')
    const resultado = await chamarAppsScriptProcurarDatas('LookupCompletoPorEndereco', [body], {
      rota: 'validar-endereco',
    }) as EnderecoValidado

    console.log(`[PROCURAR_DATAS][validar-endereco] sucesso provider=appsscript fallback=appsscript duracaoMs=${Date.now() - inicio}`)
    const resposta: ValidarEnderecoResponseSucesso = { ok: true, resultado }
    return NextResponse.json(resposta)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][validar-endereco] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
