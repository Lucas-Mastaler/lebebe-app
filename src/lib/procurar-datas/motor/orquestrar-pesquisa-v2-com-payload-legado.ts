import type { PesquisarDatasRequest } from '../contratos'
import type { Coordenada } from './distancia'
import {
  adaptarSaidaV2ParaPayloadLegado,
  type PayloadCompactoCompatLegado,
} from './adaptar-saida-v2-para-legado'
import {
  calcularDistKmDepositoDestino,
  type BuscarRotaDepositoDestino,
  type DistKmDepositoDestinoResultado,
} from './calcular-dist-km-deposito-destino'
import { normalizarEntradaPesquisaV2 } from './entrada'
import { montarFretesLegadoPorDistKm } from './montar-fretes-legado-por-dist-km'
import type { PesquisarDatasV2Output } from './pesquisar-datas-v2'
import type { FreteParams } from './types'
import type { MedidorPerformanceV2 } from './performance-diagnostico-v2'

export type ConfigOrquestradorPayloadLegado = {
  latDeposito: number
  lngDeposito: number
  kmMaxViagem: number
  kmMaxValorFixo: number
  kmMaxLongaCidade: number
  kmMaxNaoViagem: number
  valorSemanaAte10km: number
  valorSabadoAte10km: number
  fatorMultiplicadorKmViagem: number
  multiplicadorKmNaoViagem: number
  valorDiaApos25kmSemana: number
  valorDiaApos25kmSabado: number
  precoCondominioAdicional: number
  valorAdicionalRotaEspecial: number
  valorAdicionalRotaPremium: number
  horaMarcadaValorAdicional: number
}

export interface OrquestrarPesquisaV2ComPayloadLegadoDeps {
  pesquisarDatas: (
    request: PesquisarDatasRequest,
    options?: {
      medidorPerformance?: MedidorPerformanceV2
      diagnosticoResultadoTelaV2SantoAmaro?: boolean
      diagnosticoDeltaSantoAmaro16Jul?: boolean
      diagnosticoDeltaMajorHardy31Jul?: boolean
    }
  ) => Promise<PesquisarDatasV2Output>
  buscarConfig: () => Promise<ConfigOrquestradorPayloadLegado>
  buscarRota: BuscarRotaDepositoDestino
  agoraMs?: () => number
  medidorPerformance?: MedidorPerformanceV2
  diagnosticoResultadoTelaV2SantoAmaro?: boolean
  diagnosticoDeltaSantoAmaro16Jul?: boolean
  diagnosticoDeltaMajorHardy31Jul?: boolean
}

export interface DiagnosticoPayloadLegadoV2 {
  distKmDepositoDestino: DistKmDepositoDestinoResultado | null
  fretesMontados: number
  freteOrigem: 'dist-km-deposito-destino' | 'ausente'
}

export interface OrquestrarPesquisaV2ComPayloadLegadoOutput {
  ok: boolean
  payload: PayloadCompactoCompatLegado
  avisos: string[]
  diagnosticoMinimo?: PesquisarDatasV2Output['diagnosticoMinimo']
  diagnosticoPayloadLegado: DiagnosticoPayloadLegadoV2
  saidaV2: PesquisarDatasV2Output
}

function extrairFreteParams(config: ConfigOrquestradorPayloadLegado): FreteParams {
  return {
    kmMaxViagem: config.kmMaxViagem,
    kmMaxValorFixo: config.kmMaxValorFixo,
    kmMaxLongaCidade: config.kmMaxLongaCidade,
    kmMaxNaoViagem: config.kmMaxNaoViagem,
    valorSemanaAte10km: config.valorSemanaAte10km,
    valorSabadoAte10km: config.valorSabadoAte10km,
    fatorMultiplicadorKmViagem: config.fatorMultiplicadorKmViagem,
    multiplicadorKmNaoViagem: config.multiplicadorKmNaoViagem,
    valorDiaApos25kmSemana: config.valorDiaApos25kmSemana,
    valorDiaApos25kmSabado: config.valorDiaApos25kmSabado,
    precoCondominioAdicional: config.precoCondominioAdicional,
  }
}

function calcularSearchTime(inicioMs: number, fimMs: number): string {
  const segundos = Math.max(0, fimMs - inicioMs) / 1000
  return segundos.toFixed(1)
}

function criarSaidaV2ErroControlado(erros: string[]): PesquisarDatasV2Output {
  return {
    ok: false,
    modo: 'v2-pesquisar-paralelo',
    resultadoFinal: {
      candidatosFinais: [],
      resumo: {
        totalRecebidos: 0,
        totalElegiveis: 0,
        totalRecortados: 0,
        normaisRecortados: 0,
        especiaisRecortados: 0,
        premiumsRecortados: 0,
        horaMarcadaRecortados: 0,
        maxNormaisAplicado: 3,
      },
      diasUsados: [],
    },
    diagnosticoMinimo: {
      osrmBaseUrlUsado: '',
      osrmFallbackUsado: false,
      quantidadeSlotsComPontos: 0,
      quantidadeSlotsSemPontos: 0,
      slotsComKm: 0,
      slotsComFallbackHaversine: 0,
      cacheAgenda: {
        hashesConsultados: 0,
        hitsSupabase: 0,
        enderecosSemHash: 0,
      },
      avisos: [],
    },
    erros,
  }
}

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function orquestrarPesquisaV2ComPayloadLegado(
  request: PesquisarDatasRequest,
  deps: OrquestrarPesquisaV2ComPayloadLegadoDeps
): Promise<OrquestrarPesquisaV2ComPayloadLegadoOutput> {
  const agoraMs = deps.agoraMs ?? (() => Date.now())
  const perf = deps.medidorPerformance
  const inicioMs = agoraMs()
  const avisos: string[] = []

  let saidaV2: PesquisarDatasV2Output
  try {
    saidaV2 = await (perf?.medirAsync('pesquisar-datas-v2', () =>
      deps.pesquisarDatas(request, {
        medidorPerformance: perf,
        diagnosticoResultadoTelaV2SantoAmaro: deps.diagnosticoResultadoTelaV2SantoAmaro,
        diagnosticoDeltaSantoAmaro16Jul: deps.diagnosticoDeltaSantoAmaro16Jul,
        diagnosticoDeltaMajorHardy31Jul: deps.diagnosticoDeltaMajorHardy31Jul,
      })
    ) ?? deps.pesquisarDatas(request, {
      diagnosticoResultadoTelaV2SantoAmaro: deps.diagnosticoResultadoTelaV2SantoAmaro,
      diagnosticoDeltaSantoAmaro16Jul: deps.diagnosticoDeltaSantoAmaro16Jul,
      diagnosticoDeltaMajorHardy31Jul: deps.diagnosticoDeltaMajorHardy31Jul,
    }))
  } catch (e) {
    const erro = `pesquisarDatas falhou: ${mensagemErro(e)}`
    avisos.push(erro)
    saidaV2 = criarSaidaV2ErroControlado([erro])
  }

  const candidatos = saidaV2.resultadoFinal?.candidatosFinais ?? []
  let distKmResultado: DistKmDepositoDestinoResultado | null = null
  let fretes = undefined as ReturnType<typeof montarFretesLegadoPorDistKm>['fretes'] | undefined

  if (saidaV2.ok && candidatos.length > 0) {
    const entrada = normalizarEntradaPesquisaV2(request)
    if (!entrada.coordenadasDestino) {
      avisos.push('Coordenadas do destino ausentes; distKm deposito -> destino e fretes legados nao foram calculados.')
    } else {
      try {
        const config = await deps.buscarConfig()
        distKmResultado = await (perf?.medirAsync('frete-dist-km-deposito-destino', () =>
          calcularDistKmDepositoDestino({
            config: {
              latDeposito: config.latDeposito,
              lngDeposito: config.lngDeposito,
            },
            destino: entrada.coordenadasDestino as Coordenada,
            buscarRota: deps.buscarRota,
          })
        ) ?? calcularDistKmDepositoDestino({
          config: {
            latDeposito: config.latDeposito,
            lngDeposito: config.lngDeposito,
          },
          destino: entrada.coordenadasDestino as Coordenada,
          buscarRota: deps.buscarRota,
        }))

        avisos.push(...distKmResultado.avisos)
        if (distKmResultado.ok && distKmResultado.distKm != null) {
          const fretesResult = montarFretesLegadoPorDistKm({
            candidatos,
            distKm: distKmResultado.distKm,
            isRural: request.isRural === true,
            isCondominio: request.isCondominio === true,
            params: extrairFreteParams(config),
            valorAdicionalEspecial: config.valorAdicionalRotaEspecial,
            valorAdicionalPremium: config.valorAdicionalRotaPremium,
            horaMarcadaValorAdicional: config.horaMarcadaValorAdicional,
          })
          fretes = fretesResult.fretes
          avisos.push(...fretesResult.avisos)
        } else {
          avisos.push(
            `distKm deposito -> destino indisponivel; fretes legados nao foram montados: ${distKmResultado.erros.join('; ')}`
          )
        }
      } catch (e) {
        avisos.push(`config/distKm/frete falhou: ${mensagemErro(e)}`)
      }
    }
  } else {
    avisos.push('Busca v2 sem candidatos finais; distKm deposito -> destino e fretes legados nao foram calculados.')
  }

  const adaptado = perf?.medir('adaptador-payload-legado', () =>
    adaptarSaidaV2ParaPayloadLegado({
      saidaV2,
      requestOriginal: request,
      fretes,
      metadados: {
        searchTime: calcularSearchTime(inicioMs, agoraMs()),
      },
      dataReferenciaISO: request.dataInicial,
    })
  ) ?? adaptarSaidaV2ParaPayloadLegado({
    saidaV2,
    requestOriginal: request,
    fretes,
    metadados: {
      searchTime: calcularSearchTime(inicioMs, agoraMs()),
    },
    dataReferenciaISO: request.dataInicial,
  })

  const fretesMontados = fretes?.length ?? 0

  return {
    ok: adaptado.ok,
    payload: adaptado.payload,
    avisos: [
      ...avisos,
      ...(saidaV2.erros ?? []).map((erro) => `saidaV2 erro: ${erro}`),
      ...adaptado.avisos,
    ],
    diagnosticoMinimo: saidaV2.diagnosticoMinimo,
    diagnosticoPayloadLegado: {
      distKmDepositoDestino: distKmResultado,
      fretesMontados,
      freteOrigem: fretesMontados > 0 ? 'dist-km-deposito-destino' : 'ausente',
    },
    saidaV2,
  }
}
