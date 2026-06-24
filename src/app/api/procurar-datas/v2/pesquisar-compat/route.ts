import { NextRequest, NextResponse } from 'next/server'
import { validarAcessoProcurarDatas, respostaErroProcurarDatas } from '@/lib/procurar-datas/api'
import { buscarConfiguracoesProcurarDatas } from '@/lib/procurar-datas/config-service'
import type { PesquisarDatasRequest } from '@/lib/procurar-datas/contratos'
import {
  orquestrarPesquisaV2ComPayloadLegado,
  type ConfigOrquestradorPayloadLegado,
} from '@/lib/procurar-datas/motor/orquestrar-pesquisa-v2-com-payload-legado'
import { criarBuscarRotaOSRMRouteDiagnosticoV2 } from '@/lib/procurar-datas/motor/osrm-route-client-diagnostico'
import { pesquisarDatasV2 } from '@/lib/procurar-datas/motor/pesquisar-datas-v2'

export const runtime = 'nodejs'
export const maxDuration = 60

function normalizarOsrmBaseUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '') || 'https://osrm.lebebe.cloud'
}

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][v2/pesquisar-compat] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as PesquisarDatasRequest
    let configCache: (ConfigOrquestradorPayloadLegado & { osrmBaseUrl: string }) | null = null

    async function carregarConfig() {
      if (configCache) return configCache

      const configResult = await buscarConfiguracoesProcurarDatas()
      if (!configResult.ok) {
        throw new Error(`Config procurar-datas nao carregada: ${configResult.erro}`)
      }

      configCache = configResult.config
      return configCache
    }

    const resultado = await orquestrarPesquisaV2ComPayloadLegado(body, {
      pesquisarDatas: pesquisarDatasV2,
      buscarConfig: carregarConfig,
      buscarRota: async (de, para) => {
        const config = await carregarConfig()
        const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
          baseUrl: normalizarOsrmBaseUrl(config.osrmBaseUrl),
          timeoutMs: 10_000,
        })
        return buscarRota(de, para)
      },
      agoraMs: () => Date.now(),
    })

    const status = resultado.ok ? 200 : 400
    console.log(
      `[PROCURAR_DATAS][v2/pesquisar-compat] fim ok=${resultado.ok} candidates=${resultado.payload.candidates.length} duracaoMs=${Date.now() - inicio}`
    )

    return NextResponse.json(
      {
        ok: resultado.ok,
        modo: 'v2-pesquisar-compat',
        aviso: 'Rota paralela/manual para validar PayloadCompacto legado via v2. Nao altera frontend, Apps Script ou producao.',
        payload: resultado.payload,
        avisos: resultado.avisos,
        diagnosticoMinimo: resultado.diagnosticoMinimo,
        diagnosticoPayloadLegado: resultado.diagnosticoPayloadLegado,
        metadadosValidacao: {
          duracaoMs: Date.now() - inicio,
          candidates: resultado.payload.candidates.length,
          fretesMontados: resultado.diagnosticoPayloadLegado.fretesMontados,
        },
        saidaV2: resultado.saidaV2,
      },
      { status }
    )
  } catch (error) {
    console.error(`[PROCURAR_DATAS][v2/pesquisar-compat] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
