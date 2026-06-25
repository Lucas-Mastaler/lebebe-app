import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import { calcularValorInicialLocal } from '@/lib/procurar-datas/valor-inicial-local'
import type { ValorInicialRequest, ValorInicialResponseSucesso, ValorInicialResultado } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][valor-inicial] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as ValorInicialRequest
    const temCoordenadas =
      (Number.isFinite(body.destLat) && Number.isFinite(body.destLng)) ||
      (Number.isFinite(body.lat) && Number.isFinite(body.lng))

    if (temCoordenadas) {
      try {
        const resultado = await calcularValorInicialLocal(body)
        console.log(
          `[PROCURAR_DATAS][valor-inicial] sucesso origem=local fallback=${resultado.fallbackUsado ? 'local' : 'none'} duracaoMs=${Date.now() - inicio}`
        )
        const resposta: ValorInicialResponseSucesso = { ok: true, resultado }
        return NextResponse.json(resposta)
      } catch (error) {
        console.warn('[PROCURAR_DATAS][valor-inicial] local_falhou fallback=appsscript', error)
      }
    }

    const resultado = await chamarAppsScriptProcurarDatas<ValorInicialResultado>('calcularValorInicialModal', [body], {
      rota: 'valor-inicial',
      timeoutMs: 60_000,
    })

    console.log(`[PROCURAR_DATAS][valor-inicial] sucesso origem=appsscript fallback=appsscript duracaoMs=${Date.now() - inicio}`)
    const resposta: ValorInicialResponseSucesso = { ok: true, resultado }
    return NextResponse.json(resposta)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][valor-inicial] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
