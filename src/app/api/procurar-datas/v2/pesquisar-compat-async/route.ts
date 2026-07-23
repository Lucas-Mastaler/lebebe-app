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
import {
  gerarRunId,
  registrarAuditoriaSearchV2,
} from '@/lib/procurar-datas/v2/auditoria-search'
import { registrarAuditoriaPesquisa } from '@/lib/procurar-datas/v2/auditoria-pesquisa'

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

function flagDiagnosticoPerformanceQuery(request: NextRequest): boolean {
  const query = request.nextUrl.searchParams.get('diagnosticoPerformanceV2')
  return query === 'true' || query === '1'
}

function modoLogsPerformance(
  request: NextRequest,
  body: { modoLogsPerformanceV2?: unknown; diagnosticoModoLogsV2?: unknown }
): 'atual' | 'sem-slots' | 'agregado' {
  const valor = request.nextUrl.searchParams.get('modoLogsPerformanceV2') ??
    request.nextUrl.searchParams.get('diagnosticoModoLogsV2') ??
    body.modoLogsPerformanceV2 ??
    body.diagnosticoModoLogsV2
  return valor === 'sem-slots' || valor === 'agregado' ? valor : 'atual'
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
  const medidorPerformanceQuery = criarMedidorPerformanceV2(flagDiagnosticoPerformanceQuery(request))
  console.log('[PROCURAR_DATAS][v2/pesquisar-compat-async] inicio')

  try {
    const acesso = await (medidorPerformanceQuery?.medirAsync('validacao-auth', () =>
      validarAcessoProcurarDatas()
    ) ?? validarAcessoProcurarDatas())
    if (acesso.response) return acesso.response

    const body = (await (medidorPerformanceQuery?.medirAsync('parse-request', () =>
      request.json()
    ) ?? request.json())) as PesquisarDatasRequest & {
      clientToken?: string
      diagnosticoPerformanceV2?: boolean
      incluirDiagnosticoPerformanceV2?: boolean
      modoLogsPerformanceV2?: unknown
      diagnosticoModoLogsV2?: unknown
      diagnosticoResultadoTelaV2SantoAmaro?: boolean
      usarDiagnosticoResultadoTelaV2SantoAmaro?: boolean
      diagnosticoDeltaSantoAmaro16Jul?: boolean
      usarDiagnosticoDeltaSantoAmaro16Jul?: boolean
    }
    const medidorPerformance =
      medidorPerformanceQuery ?? criarMedidorPerformanceV2(flagDiagnosticoPerformance(request, body))
    const modoLogsPerformanceV2 = modoLogsPerformance(request, body)
    const incluirDiagnosticoResultadoTelaV2SantoAmaro =
      flagDiagnosticoResultadoTelaV2SantoAmaro(request, body)
    const incluirDiagnosticoDeltaSantoAmaro16Jul =
      flagDiagnosticoDeltaSantoAmaro16Jul(request, body)

    const clientToken: string =
      typeof body.clientToken === 'string' && body.clientToken.trim().length > 0
        ? body.clientToken.trim()
        : gerarClientToken()

    const startedAt = new Date(inicioMs).toISOString()
    const runId = gerarRunId()

    const progressoQueued = criarProgressoInicial(clientToken)
    await (medidorPerformance?.medirAsync('redis-queued', () =>
      salvarProgressoCompat(clientToken, progressoQueued)
    ) ?? salvarProgressoCompat(clientToken, progressoQueued))

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
          modoLogsPerformance: modoLogsPerformanceV2,
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
        modoLogsPerformance: modoLogsPerformanceV2,
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
      registrarAuditoriaSearchV2({
        runId,
        clientToken,
        userEmail: acesso.auth.email || '',
        cep: body.cep ?? null,
        enderecoCompleto: body.enderecoCompleto ?? null,
        tempoNecessario: body.tempoNecessario ?? null,
        isRural: !!body.isRural,
        isCondominio: !!body.isCondominio,
        startedAt,
        finishedAtMs: Date.now(),
        inicioMs,
        status: 'error',
        errorMessage: mensagem,
      }).catch(() => {})

      // Auditoria operacional
      registrarAuditoriaPesquisa({
        runId,
        clientToken,
        userId: acesso.auth.userId || null,
        userEmail: acesso.auth.email || '',
        cep: body.cep || null,
        numero: body.numero || null,
        logradouro: body.logradouro || null,
        bairro: body.bairro || null,
        cidade: body.cidade || null,
        uf: body.uf || null,
        enderecoCompleto: body.enderecoCompleto || null,
        latitude: body.lat || null,
        longitude: body.lng || null,
        parametros: {
          dataInicial: body.dataInicial,
          encomenda: body.isEncomenda,
          areaRural: body.isRural,
          condominio: body.isCondominio,
          bercoCama: body.tipoBerco,
          comoda: body.comoda,
          roupeiro: body.roupeiro,
          poltrona: body.poltrona,
          painel: body.painel,
          tempoNecessario: body.tempoNecessario,
          valorInicialMinimo: typeof body.valorInicialMinimo === 'number' ? body.valorInicialMinimo : undefined,
        },
        status: 'error',
        errorMessage: mensagem,
        duracaoMs: Date.now() - inicioMs,
        startedAt,
        finishedAt: new Date(Date.now()).toISOString(),
      }).catch((err) => {
        console.error('[PROCURAR_DATAS][v2/pesquisar-compat-async] erro ao gravar auditoria operacional', err)
      })
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
      registrarAuditoriaSearchV2({
        runId,
        clientToken,
        userEmail: acesso.auth.email || '',
        cep: body.cep ?? null,
        enderecoCompleto: body.enderecoCompleto ?? null,
        tempoNecessario: body.tempoNecessario ?? null,
        isRural: !!body.isRural,
        isCondominio: !!body.isCondominio,
        startedAt,
        finishedAtMs: Date.now(),
        inicioMs,
        status: 'error',
        errorMessage: mensagemResultado,
      }).catch(() => {})

      // Auditoria operacional
      registrarAuditoriaPesquisa({
        runId,
        clientToken,
        userId: acesso.auth.userId || null,
        userEmail: acesso.auth.email || '',
        cep: body.cep || null,
        numero: body.numero || null,
        logradouro: body.logradouro || null,
        bairro: body.bairro || null,
        cidade: body.cidade || null,
        uf: body.uf || null,
        enderecoCompleto: body.enderecoCompleto || null,
        latitude: body.lat || null,
        longitude: body.lng || null,
        parametros: {
          dataInicial: body.dataInicial,
          encomenda: body.isEncomenda,
          areaRural: body.isRural,
          condominio: body.isCondominio,
          bercoCama: body.tipoBerco,
          comoda: body.comoda,
          roupeiro: body.roupeiro,
          poltrona: body.poltrona,
          painel: body.painel,
          tempoNecessario: body.tempoNecessario,
          valorInicialMinimo: typeof body.valorInicialMinimo === 'number' ? body.valorInicialMinimo : undefined,
        },
        status: 'error',
        errorMessage: mensagemResultado,
        duracaoMs: Date.now() - inicioMs,
        startedAt,
        finishedAt: new Date(Date.now()).toISOString(),
      }).catch((err) => {
        console.error('[PROCURAR_DATAS][v2/pesquisar-compat-async] erro ao gravar auditoria operacional', err)
      })
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

    medidorPerformance?.registrarEtapa('rota-ate-orquestrador', Date.now() - inicioMs)
    const diagnosticoPerformanceV2Parcial = medidorPerformance?.finalizar()
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
      diagnosticoPerformanceV2Parcial,
      diagnosticoResultadoTelaV2SantoAmaro,
      diagnosticoDeltaSantoAmaro16Jul
    )

    await (medidorPerformance?.medirAsync('redis-done', () =>
      salvarProgressoCompat(clientToken, progressoDone)
    ) ?? salvarProgressoCompat(clientToken, progressoDone))

    const finishedAtMs = Date.now()
    console.log(
      `[PROCURAR_DATAS][v2/pesquisar-compat-async] fim ok=${resultado.ok} candidates=${resultado.payload.candidates.length} duracaoMs=${finishedAtMs - inicioMs}`
    )

    const contadoresMapaKm = resultado.saidaV2.diagnosticoMinimo.contadoresMapaKm
    const emitirLogConsistenciaRota = () => {
      console.info('[PROCURAR_DATAS][v2/consistencia-espacial]', {
        runId,
        estadoResultado: resultado.saidaV2.diagnosticoMinimo.estadoResultado ?? null,
        consistenciaEspacial: resultado.saidaV2.diagnosticoMinimo.consistenciaEspacial ?? null,
        coberturaFontes: resultado.saidaV2.diagnosticoMinimo.coberturaFontes ?? null,
        slotsBloqueados: modoLogsPerformanceV2 === 'sem-slots'
          ? []
          : resultado.saidaV2.snapshotTecnicoSlotsBloqueados?.map((slot) => ({
              slotKey: slot.slotKey,
              estado: slot.consistenciaEspacial.estado,
              motivo: slot.consistenciaEspacial.motivo,
            })) ?? [],
      })
    }
    if (medidorPerformance) {
      medidorPerformance.medir('logs-consistencia-rota', emitirLogConsistenciaRota)
    } else {
      emitirLogConsistenciaRota()
    }
    await (medidorPerformance?.medirAsync('auditoria-search-supabase', () => registrarAuditoriaSearchV2({
      runId,
      clientToken,
      userEmail: acesso.auth.email || '',
      cep: body.cep ?? null,
      enderecoCompleto: body.enderecoCompleto ?? null,
      tempoNecessario: body.tempoNecessario ?? null,
      isRural: !!body.isRural,
      isCondominio: !!body.isCondominio,
      startedAt,
      finishedAtMs,
      inicioMs,
      status: 'success',
      candidates: resultado.payload.candidates,
      searchTimeSeconds: resultado.payload.searchTime,
      totalSlotsProcessed: contadoresMapaKm?.slotsProcessados,
      totalSlotsAvailable: contadoresMapaKm?.slotsComKm,
    }).catch(() => {})) ?? registrarAuditoriaSearchV2({
      runId,
      clientToken,
      userEmail: acesso.auth.email || '',
      cep: body.cep ?? null,
      enderecoCompleto: body.enderecoCompleto ?? null,
      tempoNecessario: body.tempoNecessario ?? null,
      isRural: !!body.isRural,
      isCondominio: !!body.isCondominio,
      startedAt,
      finishedAtMs,
      inicioMs,
      status: 'success',
      candidates: resultado.payload.candidates,
      searchTimeSeconds: resultado.payload.searchTime,
      totalSlotsProcessed: contadoresMapaKm?.slotsProcessados,
      totalSlotsAvailable: contadoresMapaKm?.slotsComKm,
    }).catch(() => {}))

    // Auditoria operacional
    const auditoriaPesquisaResultado = await (medidorPerformance?.medirAsync('auditoria-pesquisa-supabase', () =>
      registrarAuditoriaPesquisa({
      runId,
      clientToken,
      userId: acesso.auth.userId || null,
      userEmail: acesso.auth.email || '',
      cep: body.cep || null,
      numero: body.numero,
      logradouro: body.logradouro,
      bairro: body.bairro,
      cidade: body.cidade,
      uf: body.uf,
      enderecoCompleto: body.enderecoCompleto,
      latitude: body.lat,
      longitude: body.lng,
      parametros: {
        dataInicial: body.dataInicial,
        encomenda: body.isEncomenda,
        areaRural: body.isRural,
        condominio: body.isCondominio,
        bercoCama: body.tipoBerco,
        comoda: body.comoda,
        roupeiro: body.roupeiro,
        poltrona: body.poltrona,
        painel: body.painel,
        tempoNecessario: body.tempoNecessario,
        valorInicialMinimo: typeof body.valorInicialMinimo === 'number' ? body.valorInicialMinimo : undefined,
      },
      snapshotTecnico: {
        candidatosFinais: resultado.saidaV2.snapshotTecnicoCandidatosFinais ?? [],
        slotsBloqueados: resultado.saidaV2.snapshotTecnicoSlotsBloqueados ?? [],
        contadoresMapaKm: contadoresMapaKm ?? null,
        estadoResultado: resultado.saidaV2.diagnosticoMinimo.estadoResultado ?? null,
        consistenciaEspacial: resultado.saidaV2.diagnosticoMinimo.consistenciaEspacial ?? null,
        coberturaFontes: resultado.saidaV2.diagnosticoMinimo.coberturaFontes ?? null,
        fonteAgenda: resultado.saidaV2.diagnosticoMinimo.fonteAgenda ?? null,
        fonteDisponibilidade: resultado.saidaV2.diagnosticoMinimo.fonteDisponibilidade ?? null,
      },
      resultados: resultado.payload.candidates,
      status: 'success',
      duracaoMs: finishedAtMs - inicioMs,
      startedAt,
      finishedAt: new Date(finishedAtMs).toISOString(),
    })
    ) ?? registrarAuditoriaPesquisa({
      runId,
      clientToken,
      userId: acesso.auth.userId || null,
      userEmail: acesso.auth.email || '',
      cep: body.cep || null,
      numero: body.numero,
      logradouro: body.logradouro,
      bairro: body.bairro,
      cidade: body.cidade,
      uf: body.uf,
      enderecoCompleto: body.enderecoCompleto,
      latitude: body.lat,
      longitude: body.lng,
      parametros: {
        dataInicial: body.dataInicial,
        encomenda: body.isEncomenda,
        areaRural: body.isRural,
        condominio: body.isCondominio,
        bercoCama: body.tipoBerco,
        comoda: body.comoda,
        roupeiro: body.roupeiro,
        poltrona: body.poltrona,
        painel: body.painel,
        tempoNecessario: body.tempoNecessario,
        valorInicialMinimo: typeof body.valorInicialMinimo === 'number' ? body.valorInicialMinimo : undefined,
      },
      snapshotTecnico: {
        candidatosFinais: resultado.saidaV2.snapshotTecnicoCandidatosFinais ?? [],
        slotsBloqueados: resultado.saidaV2.snapshotTecnicoSlotsBloqueados ?? [],
        contadoresMapaKm: contadoresMapaKm ?? null,
        estadoResultado: resultado.saidaV2.diagnosticoMinimo.estadoResultado ?? null,
        consistenciaEspacial: resultado.saidaV2.diagnosticoMinimo.consistenciaEspacial ?? null,
        coberturaFontes: resultado.saidaV2.diagnosticoMinimo.coberturaFontes ?? null,
        fonteAgenda: resultado.saidaV2.diagnosticoMinimo.fonteAgenda ?? null,
        fonteDisponibilidade: resultado.saidaV2.diagnosticoMinimo.fonteDisponibilidade ?? null,
      },
      resultados: resultado.payload.candidates,
      status: 'success',
      duracaoMs: finishedAtMs - inicioMs,
      startedAt,
      finishedAt: new Date(finishedAtMs).toISOString(),
    })).catch((err) => {
      console.error('[PROCURAR_DATAS][v2/pesquisar-compat-async] erro ao gravar auditoria operacional', err)
      return { id: '', sucesso: false, erro: err instanceof Error ? err.message : 'Erro desconhecido' }
    })

    medidorPerformance?.registrarEtapa('rota-pesquisar-compat-async', Date.now() - inicioMs)
    const diagnosticoPerformanceV2 = medidorPerformance?.finalizar()

    const responseBody = {
        ok: true,
        clientToken,
        runId,
        status: 'done' as const,
        modo: 'v2-pesquisar-compat-async',
        ...(auditoriaPesquisaResultado.sucesso ? { pesquisaAuditoriaId: auditoriaPesquisaResultado.id } : {}),
        ...(diagnosticoPerformanceV2 ? { diagnosticoPerformanceV2 } : {}),
        ...(diagnosticoResultadoTelaV2SantoAmaro
          ? { diagnosticoResultadoTelaV2SantoAmaro }
          : {}),
        ...(diagnosticoDeltaSantoAmaro16Jul
          ? { diagnosticoDeltaSantoAmaro16Jul }
          : {}),
      }
    return medidorPerformance?.medir('serializacao-response', () => NextResponse.json(
      responseBody,
      { status: 200 }
    )) ?? NextResponse.json(
      responseBody,
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
