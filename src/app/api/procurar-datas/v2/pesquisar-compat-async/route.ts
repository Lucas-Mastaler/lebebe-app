/**
 * POST /api/procurar-datas/v2/pesquisar-compat-async
 *
 * Rota paralela v2 de polling compatível SIMULADO.
 *
 * Fluxo:
 * 1. Valida acesso (validarAcessoProcurarDatas).
 * 2. Usa clientToken do request ou gera um token seguro.
 * 3. Salva estado queued/running no Redis.
 * 4. Executa o orquestrador completo (pesquisarDatasV2 + OSRM + fretes).
 * 5. Separa payload.candidates em normais e extras.
 * 6. Salva estado done no Redis com payload final.
 * 7. Retorna { ok, clientToken, status, modo }.
 *
 * IMPORTANTE: polling compatível SIMULADO — não emite candidatos parciais.
 * O POST aguarda o orquestrador completo antes de responder.
 * Publicação incremental de candidatos fica para fase futura.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { validarAcessoProcurarDatas, respostaErroProcurarDatas } from '@/lib/procurar-datas/api'
import { buscarConfiguracoesProcurarDatas } from '@/lib/procurar-datas/config-service'
import type { PesquisarDatasRequest } from '@/lib/procurar-datas/contratos'
import {
  orquestrarPesquisaV2ComPayloadLegado,
  type ConfigOrquestradorPayloadLegado,
} from '@/lib/procurar-datas/motor/orquestrar-pesquisa-v2-com-payload-legado'
import { criarBuscarRotaOSRMRouteDiagnosticoV2 } from '@/lib/procurar-datas/motor/osrm-route-client-diagnostico'
import { criarMedidorPerformanceV2 } from '@/lib/procurar-datas/motor/performance-diagnostico-v2'
import { pesquisarDatasV2 } from '@/lib/procurar-datas/motor/pesquisar-datas-v2'
import {
  salvarProgressoCompat,
  montarProgressoDone,
  montarProgressoError,
  criarProgressoInicial,
} from '@/lib/procurar-datas/v2/progresso-compat-store'

export const runtime = 'nodejs'
export const maxDuration = 60

function normalizarOsrmBaseUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '') || 'https://osrm.lebebe.cloud'
}

function gerarClientToken(): string {
  return randomUUID()
}

function flagDiagnosticoPerformance(
  request: NextRequest,
  body: { diagnosticoPerformanceV2?: boolean; incluirDiagnosticoPerformanceV2?: boolean }
): boolean {
  const query = request.nextUrl.searchParams.get('diagnosticoPerformanceV2')
  return (
    query === 'true' ||
    query === '1' ||
    body.diagnosticoPerformanceV2 === true ||
    body.incluirDiagnosticoPerformanceV2 === true
  )
}

function flagDiagnosticoResultadoTelaV2SantoAmaro(
  request: NextRequest,
  body: {
    diagnosticoResultadoTelaV2SantoAmaro?: boolean
    usarDiagnosticoResultadoTelaV2SantoAmaro?: boolean
  }
): boolean {
  const query = request.nextUrl.searchParams.get('diagnosticoResultadoTelaV2SantoAmaro')
  return (
    query === 'true' ||
    query === '1' ||
    body.diagnosticoResultadoTelaV2SantoAmaro === true ||
    body.usarDiagnosticoResultadoTelaV2SantoAmaro === true
  )
}

function flagDiagnosticoDeltaSantoAmaro16Jul(
  request: NextRequest,
  body: {
    diagnosticoDeltaSantoAmaro16Jul?: boolean
    usarDiagnosticoDeltaSantoAmaro16Jul?: boolean
  }
): boolean {
  const query = request.nextUrl.searchParams.get('diagnosticoDeltaSantoAmaro16Jul')
  return (
    query === 'true' ||
    query === '1' ||
    body.diagnosticoDeltaSantoAmaro16Jul === true ||
    body.usarDiagnosticoDeltaSantoAmaro16Jul === true
  )
}

export async function POST(request: NextRequest) {
  const inicioMs = Date.now()
  console.log('[PROCURAR_DATAS][v2/pesquisar-compat-async] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as PesquisarDatasRequest & {
      clientToken?: string
      diagnosticoPerformanceV2?: boolean
      incluirDiagnosticoPerformanceV2?: boolean
      diagnosticoResultadoTelaV2SantoAmaro?: boolean
      usarDiagnosticoResultadoTelaV2SantoAmaro?: boolean
      diagnosticoDeltaSantoAmaro16Jul?: boolean
      usarDiagnosticoDeltaSantoAmaro16Jul?: boolean
    }
    const medidorPerformance = criarMedidorPerformanceV2(flagDiagnosticoPerformance(request, body))
    const incluirDiagnosticoResultadoTelaV2SantoAmaro =
      flagDiagnosticoResultadoTelaV2SantoAmaro(request, body)
    const incluirDiagnosticoDeltaSantoAmaro16Jul =
      flagDiagnosticoDeltaSantoAmaro16Jul(request, body)

    const clientToken: string =
      typeof body.clientToken === 'string' && body.clientToken.trim().length > 0
        ? body.clientToken.trim()
        : gerarClientToken()

    const startedAt = new Date(inicioMs).toISOString()

    const progressoQueued = criarProgressoInicial(clientToken)
    await salvarProgressoCompat(clientToken, progressoQueued)

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

    let resultado: Awaited<ReturnType<typeof orquestrarPesquisaV2ComPayloadLegado>>

    try {
      resultado = await (medidorPerformance?.medirAsync('orquestrador', () =>
        orquestrarPesquisaV2ComPayloadLegado(body, {
          pesquisarDatas: pesquisarDatasV2,
          buscarConfig: carregarConfig,
          buscarRota: async (de, para) => {
            const config = await carregarConfig()
            const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
              baseUrl: normalizarOsrmBaseUrl(config.osrmBaseUrl),
              timeoutMs: 10_000,
            })
            return medidorPerformance.medirOsrm('deposito-destino', () => buscarRota(de, para), (r) =>
              r.ok ? 'sucesso' : String(r.erro ?? '').toLowerCase().includes('timeout') ? 'timeout' : 'erro'
            )
          },
          agoraMs: () => Date.now(),
          medidorPerformance,
          diagnosticoResultadoTelaV2SantoAmaro: incluirDiagnosticoResultadoTelaV2SantoAmaro,
          diagnosticoDeltaSantoAmaro16Jul: incluirDiagnosticoDeltaSantoAmaro16Jul,
        })
      ) ?? orquestrarPesquisaV2ComPayloadLegado(body, {
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
        diagnosticoResultadoTelaV2SantoAmaro: incluirDiagnosticoResultadoTelaV2SantoAmaro,
        diagnosticoDeltaSantoAmaro16Jul: incluirDiagnosticoDeltaSantoAmaro16Jul,
      }))
    } catch (errOrq) {
      const mensagem =
        errOrq instanceof Error ? errOrq.message : String(errOrq || 'Erro no orquestrador')
      console.error(
        `[PROCURAR_DATAS][v2/pesquisar-compat-async] erro orquestrador duracaoMs=${Date.now() - inicioMs}`,
        errOrq
      )
      const progressoError = montarProgressoError(clientToken, mensagem, startedAt, inicioMs)
      await salvarProgressoCompat(clientToken, progressoError)
      return NextResponse.json(
        {
          ok: false,
          clientToken,
          status: 'error' as const,
          modo: 'v2-pesquisar-compat-async',
          error: mensagem,
        },
        { status: 500 }
      )
    }

    if (!resultado.ok) {
      const mensagemResultado =
        resultado.avisos.length > 0
          ? resultado.avisos.join('; ')
          : 'orquestrador retornou ok=false sem candidatos'
      console.warn(
        `[PROCURAR_DATAS][v2/pesquisar-compat-async] ok=false duracaoMs=${Date.now() - inicioMs}`
      )
      const progressoError = montarProgressoError(clientToken, mensagemResultado, startedAt, inicioMs)
      await salvarProgressoCompat(clientToken, progressoError)
      return NextResponse.json(
        {
          ok: false,
          clientToken,
          status: 'error' as const,
          modo: 'v2-pesquisar-compat-async',
          error: mensagemResultado,
        },
        { status: 500 }
      )
    }

    medidorPerformance?.registrarEtapa('rota-pesquisar-compat-async', Date.now() - inicioMs)
    const diagnosticoPerformanceV2 = medidorPerformance?.finalizar()
    const diagnosticoResultadoTelaV2SantoAmaro =
      resultado.saidaV2.diagnosticoResultadoTelaV2SantoAmaro
    const diagnosticoDeltaSantoAmaro16Jul =
      resultado.saidaV2.diagnosticoDeltaSantoAmaro16Jul

    const progressoDone = montarProgressoDone(
      clientToken,
      resultado.payload.candidates,
      resultado.payload,
      startedAt,
      inicioMs,
      diagnosticoPerformanceV2,
      diagnosticoResultadoTelaV2SantoAmaro,
      diagnosticoDeltaSantoAmaro16Jul
    )

    await salvarProgressoCompat(clientToken, progressoDone)

    console.log(
      `[PROCURAR_DATAS][v2/pesquisar-compat-async] fim ok=${resultado.ok} candidates=${resultado.payload.candidates.length} duracaoMs=${Date.now() - inicioMs}`
    )

    return NextResponse.json(
      {
        ok: true,
        clientToken,
        status: 'done' as const,
        modo: 'v2-pesquisar-compat-async',
        ...(diagnosticoPerformanceV2 ? { diagnosticoPerformanceV2 } : {}),
        ...(diagnosticoResultadoTelaV2SantoAmaro
          ? { diagnosticoResultadoTelaV2SantoAmaro }
          : {}),
        ...(diagnosticoDeltaSantoAmaro16Jul
          ? { diagnosticoDeltaSantoAmaro16Jul }
          : {}),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error(
      `[PROCURAR_DATAS][v2/pesquisar-compat-async] erro inesperado duracaoMs=${Date.now() - inicioMs}`,
      error
    )
    return respostaErroProcurarDatas(error)
  }
}
