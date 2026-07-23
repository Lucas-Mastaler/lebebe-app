import { buscarConfiguracoesProcurarDatas } from '../config-service'
import type { PesquisarDatasRequest } from '../contratos'
import { normalizarEntradaPesquisaV2 } from './entrada'
import { gerarJanelaDatasPesquisaV2 } from './janela-datas'
import { buscarDisponibilidadeRealDiagnosticaComDados } from './disponibilidade-real-helper'
import { buscarAgendaRealDiagnosticaComDados } from './agenda-real-helper'
import { resolverCacheCoordenadasAgendaDiagnostico } from './cache-coordenadas-agenda-diagnostico'
import { resolverCoordenadasAgendaProducao } from './resolver-coordenadas-agenda-producao'
import {
  calcularMapaKmAdicionalPorSlotControladoV2,
  type DetalheSlotMapaKmAdicional,
  type SlotInputMapaKmAdicional,
} from './calcular-mapa-km-adicional-por-slot'
import { criarBuscarMatrizOSRMTableDiagnosticoV2 } from './osrm-table-client-diagnostico'
import { criarBuscarRotaOSRMRouteDiagnosticoV2 } from './osrm-route-client-diagnostico'
import { gerarCandidatosComDisponibilidadeRealV2 } from './gerar-candidatos-disponibilidade-real'
import { recortarCandidatosLegadoEquivalente } from './recortar-candidatos-legado-equivalente'
import { normalizarEquipe } from './equipe'
import type { CandidatoPreliminarV2 } from './candidato'
import type { DisponibilidadeEquipeDataV2 } from './disponibilidade'
import type { MedidorPerformanceV2 } from './performance-diagnostico-v2'
import { montarDiagnosticoResultadoTelaV2SantoAmaro } from './diagnostico-resultado-tela-v2-santo-amaro'
import {
  montarDiagnosticoDeltaSantoAmaro16Jul,
  type ComparativoOsrmRouteTableDelta16Jul,
} from './diagnostico-delta-santo-amaro-16-jul'
import {
  montarDiagnosticoResultadoTelaV2MajorHardy,
} from './diagnostico-resultado-tela-v2-major-hardy'

const OSRM_BASE_URL_DEFAULT_V2 = 'https://osrm.lebebe.cloud'
const OSRM_BASE_URL_FALLBACK_PUBLICO = 'https://router.project-osrm.org'
const MAX_NORMAIS_V2 = 3
const DATA_DELTA_SANTO_AMARO = '2026-07-16'
const EQUIPE_DELTA_SANTO_AMARO = 'EQUIPE 1'
const DELTA_LEGADO_ESPERADO_SANTO_AMARO_M = 10460
const ORIGEM_LEGADO_LOG_SANTO_AMARO_16_JUL = {
  lat: -25.493498,
  lng: -49.276551,
  fonte: 'log-legado-16-07-origem',
}

export type CandidatoFinalPesquisarDatasV2 = {
  dataISO: string
  equipe: string
  tipo: string
  rank: number
  elegivel: boolean
  horaMarcada: boolean
  kmAdicionalNaRotaM: number | null
  origemKmAdicional: 'slot' | 'global-fallback' | null
}

/**
 * Snapshot tecnico por candidato final, capturado ANTES do adapter legado.
 * Serve para auditoria: permite provar, para cada slot salvo, os dados reais
 * que a producao usou na classificacao (tempo, km, origem do km, filtro early,
 * slotTemPontos, motivos). Aditivo — nao altera o resultado exibido.
 */
export type SnapshotTecnicoCandidatoFinalV2 = {
  slotKey: string
  dataISO: string
  equipe: string
  elegivel: boolean
  tipoOriginal: string
  motivos: string[]
  slotAvailMin: number | null
  serviceMin: number | null
  kmAdicionalNaRotaM: number | null
  origemKmAdicionalNaRotaM: DetalheSlotMapaKmAdicional['origemKmAdicionalNaRotaM'] | null
  filtroEarly: DetalheSlotMapaKmAdicional['filtroEarlyLegado'] | null
  slotTemPontos: boolean | null
  consistenciaEspacial: DetalheSlotMapaKmAdicional['consistenciaEspacial'] | null
}

export type SnapshotTecnicoSlotBloqueadoV2 = {
  slotKey: string
  dataISO: string
  equipe: string
  kmAdicionalNaRotaM: null
  origemKmAdicionalNaRotaM: DetalheSlotMapaKmAdicional['origemKmAdicionalNaRotaM']
  consistenciaEspacial: NonNullable<DetalheSlotMapaKmAdicional['consistenciaEspacial']>
}

export type ContadoresMapaKmV2 = {
  slotsRecebidos: number
  slotsProcessados: number
  slotsComKm: number
  slotsComFallbackHaversine: number
  slotsComErro: number
  slotsDescartados: number
  slotsBloqueadosInconsistenciaEspacial: number
}

export type PesquisarDatasV2Output = {
  ok: boolean
  modo: 'v2-pesquisar-paralelo'
  aviso?: string
  entradaNormalizada?: {
    dataInicialISO: string | null
    tempoNecessarioMin: number | null
    temCoordenadasDestino: boolean
    isRural: boolean
    isCondominio: boolean
    avisos: string[]
  }
  resultadoFinal: {
    candidatosFinais: CandidatoFinalPesquisarDatasV2[]
    resumo: {
      totalRecebidos: number
      totalElegiveis: number
      totalRecortados: number
      normaisRecortados: number
      especiaisRecortados: number
      premiumsRecortados: number
      horaMarcadaRecortados: number
      maxNormaisAplicado: 3
    }
    diasUsados: string[]
  }
  diagnosticoMinimo: {
    estadoResultado?: 'ok' | 'sem-datas-disponiveis' | 'agenda-inconsistente' | 'calculo-espacial-incompleto'
    osrmBaseUrlUsado: string
    osrmFallbackUsado: boolean
    quantidadeSlotsComPontos: number
    quantidadeSlotsSemPontos: number
    slotsComKm: number
    slotsComFallbackHaversine: number
    cacheAgenda: {
      hashesConsultados: number
      hitsSupabase: number
      enderecosSemHash: number
    }
    resolucaoCoordenadasAgenda?: {
      enderecosComEnderecoSemCoordenada: number
      resolvidosPorCache: number
      resolvidosPorFallback: number
      aindaSemCoordenada: number
      geocodificacoesExternasTentadas: number
    }
    contadoresMapaKm?: ContadoresMapaKmV2
    consistenciaEspacial?: {
      slotsBloqueados: number
      diasRealmenteVazios: number
      slotsComPontosValidos: number
      ocupadosSemPontos: number
      agendasSemEndereco: number
      agendasSemCoordenadas: number
      capacidadesIndeterminadas: number
    }
    fonteAgenda?: string
    fonteDisponibilidade?: string
    coberturaFontes?: {
      agenda: { linhas: number; dataMaisAntiga: string | null; dataMaisRecente: string | null }
      disponibilidade: { linhas: number; dataMaisAntiga: string | null; dataMaisRecente: string | null }
    }
    avisos: string[]
  }
  snapshotTecnicoCandidatosFinais?: SnapshotTecnicoCandidatoFinalV2[]
  snapshotTecnicoSlotsBloqueados?: SnapshotTecnicoSlotBloqueadoV2[]
  diagnosticoResultadoTelaV2SantoAmaro?: ReturnType<typeof montarDiagnosticoResultadoTelaV2SantoAmaro>
  diagnosticoDeltaSantoAmaro16Jul?: ReturnType<typeof montarDiagnosticoDeltaSantoAmaro16Jul>
  diagnosticoDeltaMajorHardy31Jul?: ReturnType<typeof montarDiagnosticoResultadoTelaV2MajorHardy>
  erros?: string[]
}

export type PesquisarDatasV2Options = {
  medidorPerformance?: MedidorPerformanceV2
  diagnosticoResultadoTelaV2SantoAmaro?: boolean
  diagnosticoDeltaSantoAmaro16Jul?: boolean
  diagnosticoDeltaMajorHardy31Jul?: boolean
}

type OsrmResolvido = {
  url: string
  fallbackUsado: boolean
}

function respostaErro(
  erros: string[],
  avisos: string[],
  entradaNormalizada?: PesquisarDatasV2Output['entradaNormalizada']
): PesquisarDatasV2Output {
  return {
    ok: false,
    modo: 'v2-pesquisar-paralelo',
    aviso: 'Rota v2 paralela. Nao altera producao, frontend ou Apps Script.',
    entradaNormalizada,
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
        maxNormaisAplicado: MAX_NORMAIS_V2,
      },
      diasUsados: [],
    },
    diagnosticoMinimo: {
      osrmBaseUrlUsado: OSRM_BASE_URL_DEFAULT_V2,
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
      avisos,
    },
    erros,
  }
}

function resolverOsrmBaseUrlV2(configUrl: string | null | undefined): OsrmResolvido {
  const url = configUrl?.trim().replace(/\/+$/, '') || OSRM_BASE_URL_DEFAULT_V2
  const fallbackUsado = url === OSRM_BASE_URL_FALLBACK_PUBLICO
  return {
    url: fallbackUsado ? OSRM_BASE_URL_DEFAULT_V2 : url,
    fallbackUsado: false,
  }
}

function montarEntradaMinima(
  entrada: ReturnType<typeof normalizarEntradaPesquisaV2>
): PesquisarDatasV2Output['entradaNormalizada'] {
  return {
    dataInicialISO: entrada.dataInicialISO,
    tempoNecessarioMin: entrada.tempoNecessarioMin,
    temCoordenadasDestino: entrada.temCoordenadasDestino,
    isRural: entrada.isRural,
    isCondominio: entrada.isCondominio,
    avisos: entrada.avisos,
  }
}

function montarSlotsAgendaReal(input: {
  janelaDatas: Array<{ dataISO: string }>
  linhasAgenda: SlotInputMapaKmAdicional['linhasAgenda']
  disponibilidades: DisponibilidadeEquipeDataV2[]
  cacheCoordenadasPorEndereco: Record<string, { lat: number; lng: number }>
  equipe1Ativa: boolean
  equipe2Ativa: boolean
}): SlotInputMapaKmAdicional[] {
  const equipes: string[] = []
  if (input.equipe1Ativa) equipes.push('EQUIPE 1')
  if (input.equipe2Ativa) equipes.push('EQUIPE 2')

  const slots: SlotInputMapaKmAdicional[] = []
  const disponibilidadePorSlot = new Map<string, DisponibilidadeEquipeDataV2>(
    input.disponibilidades.flatMap((disponibilidade) => {
      const equipe = normalizarEquipe(disponibilidade.equipe)
      return equipe
        ? [[`${disponibilidade.dataISO}::${equipe}`, disponibilidade] as const]
        : []
    })
  )
  for (const dataDia of input.janelaDatas) {
    for (const equipe of equipes) {
      const disponibilidade = disponibilidadePorSlot.get(`${dataDia.dataISO}::${equipe}`)
      slots.push({
        dataISO: dataDia.dataISO,
        equipe,
        linhasAgenda: input.linhasAgenda,
        disponibilidade: disponibilidade
          ? {
              tempoUtilizadoMin: disponibilidade.tempoUtilizadoMin,
              disponivelMin: disponibilidade.disponivelMin,
              capacidadeTotalMin: disponibilidade.capacidadeTotalMin,
            }
          : null,
        cacheCoordenadasPorEndereco: input.cacheCoordenadasPorEndereco,
      })
    }
  }
  return slots
}

function derivarSlotTemPontos(
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const detalhe of detalhesPorSlot) {
    const pontosValidos = detalhe.parseAgenda?.resumo.pontosValidos
    const semCoordenadas = detalhe.parseAgenda?.resumo.semCoordenadas
    if (typeof pontosValidos === 'number' && Number.isFinite(pontosValidos)) {
      out[detalhe.chave] = pontosValidos > 0 || Boolean(semCoordenadas && semCoordenadas > 0)
    }
  }
  return out
}

function contarSlots(slotTemPontosPorSlotKey: Record<string, boolean>): {
  quantidadeSlotsComPontos: number
  quantidadeSlotsSemPontos: number
} {
  const valores = Object.values(slotTemPontosPorSlotKey)
  return {
    quantidadeSlotsComPontos: valores.filter(Boolean).length,
    quantidadeSlotsSemPontos: valores.filter((v) => !v).length,
  }
}

function mapearCandidatoFinal(candidato: CandidatoPreliminarV2, index: number): CandidatoFinalPesquisarDatasV2 {
  return {
    rank: index + 1,
    dataISO: candidato.dataISO,
    equipe: candidato.equipe,
    tipo: candidato.tipo,
    elegivel: candidato.elegivel,
    horaMarcada: candidato.elegivelHoraMarcada === true,
    kmAdicionalNaRotaM: candidato.distancia.kmAdicionalNaRotaM,
    origemKmAdicional: candidato.distancia.origemKmAdicional ?? null,
  }
}

/**
 * Monta o snapshot tecnico dos candidatos finais ANTES do adapter legado,
 * correlacionando cada candidato preliminar com o detalhe do slot (origem do km
 * e filtro early). Nao altera o resultado; apenas expoe dados para auditoria.
 */
function montarSnapshotTecnicoCandidatosFinais(
  candidatosFinais: CandidatoPreliminarV2[],
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
): SnapshotTecnicoCandidatoFinalV2[] {
  const detalhePorChave = new Map(detalhesPorSlot.map((detalhe) => [detalhe.chave, detalhe]))
  return candidatosFinais.map((candidato) => {
    const equipeNormalizada = normalizarEquipe(candidato.equipe) ?? candidato.equipe
    const slotKey = `${candidato.dataISO}::${equipeNormalizada}`
    const detalhe = detalhePorChave.get(slotKey)
    return {
      slotKey,
      dataISO: candidato.dataISO,
      equipe: candidato.equipe,
      elegivel: candidato.elegivel,
      tipoOriginal: candidato.tipo,
      motivos: candidato.motivos,
      slotAvailMin: candidato.operacional.slotAvailMin ?? candidato.operacional.disponivelMin ?? null,
      serviceMin: candidato.operacional.serviceMin ?? candidato.operacional.tempoNecessarioMin ?? null,
      kmAdicionalNaRotaM: candidato.distancia.kmAdicionalNaRotaM,
      origemKmAdicionalNaRotaM: detalhe?.origemKmAdicionalNaRotaM ?? null,
      filtroEarly: detalhe?.filtroEarlyLegado ?? null,
      slotTemPontos: candidato.slotTemPontos ?? null,
      consistenciaEspacial: detalhe?.consistenciaEspacial ?? null,
    }
  })
}

function montarSnapshotTecnicoSlotsBloqueados(
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
): SnapshotTecnicoSlotBloqueadoV2[] {
  return detalhesPorSlot.flatMap((detalhe) =>
    detalhe.consistenciaEspacial?.bloqueado
      ? [{
          slotKey: detalhe.chave,
          dataISO: detalhe.dataISO,
          equipe: detalhe.equipeNormalizada,
          kmAdicionalNaRotaM: null,
          origemKmAdicionalNaRotaM: detalhe.origemKmAdicionalNaRotaM,
          consistenciaEspacial: detalhe.consistenciaEspacial,
        }]
      : []
  )
}

function resumirConsistenciaEspacial(
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
): NonNullable<PesquisarDatasV2Output['diagnosticoMinimo']['consistenciaEspacial']> {
  const estados = detalhesPorSlot
    .map((detalhe) => detalhe.consistenciaEspacial)
    .filter((item) => item !== null && item !== undefined)
  const contar = (estado: NonNullable<(typeof estados)[number]>['estado']) =>
    estados.filter((item) => item?.estado === estado).length
  return {
    slotsBloqueados: estados.filter((item) => item?.bloqueado).length,
    diasRealmenteVazios: contar('dia-realmente-vazio'),
    slotsComPontosValidos: contar('com-pontos-validos'),
    ocupadosSemPontos: contar('ocupado-sem-pontos'),
    agendasSemEndereco: contar('agenda-sem-endereco'),
    agendasSemCoordenadas: contar('agenda-sem-coordenadas'),
    capacidadesIndeterminadas: contar('capacidade-indeterminada'),
  }
}

function dataISOCobertura(valor: unknown): string | null {
  const texto = String(valor ?? '').trim()
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null
}

function resumirCoberturaFontes(
  linhasAgenda: SlotInputMapaKmAdicional['linhasAgenda'],
  disponibilidades: DisponibilidadeEquipeDataV2[]
): NonNullable<PesquisarDatasV2Output['diagnosticoMinimo']['coberturaFontes']> {
  const resumir = (datas: Array<string | null>, linhas: number) => {
    const validas = datas.filter((data): data is string => data !== null).sort()
    return {
      linhas,
      dataMaisAntiga: validas[0] ?? null,
      dataMaisRecente: validas.at(-1) ?? null,
    }
  }
  return {
    agenda: resumir(linhasAgenda.map((linha) => dataISOCobertura(linha[0])), linhasAgenda.length),
    disponibilidade: resumir(
      disponibilidades.map((item) => dataISOCobertura(item.dataISO)),
      disponibilidades.length
    ),
  }
}

function pontoDiagnosticoDelta(
  ponto: { label: string; lat: number; lng: number; endereco?: string } | undefined,
  fallbackId: string
) {
  if (!ponto) return null
  return {
    id: ponto.label || fallbackId,
    label: ponto.label || fallbackId,
    lat: ponto.lat,
    lng: ponto.lng,
    endereco: ponto.endereco ?? null,
  }
}

async function compararOsrmRouteTableDeltaSantoAmaro16Jul(input: {
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
  destino: { lat: number; lng: number; descricao?: string }
  osrmBaseUrl: string
}): Promise<ComparativoOsrmRouteTableDelta16Jul> {
  const detalheSlot = input.detalhesPorSlot.find(
    (d) => d.dataISO === DATA_DELTA_SANTO_AMARO && d.equipeNormalizada === EQUIPE_DELTA_SANTO_AMARO
  )
  const melhor = detalheSlot?.deltaInsercao?.melhorInsercao
  const pontos = detalheSlot?.deltaInsercao?.pontosRotaBase
  if (!detalheSlot || !melhor || !pontos) {
    return {
      executado: false,
      ok: false,
      motivoNaoExecutado: 'Detalhes da melhor insercao ou pontos da rota base ausentes.',
      baseUrl: input.osrmBaseUrl,
      insercao: null,
      table: null,
      route: null,
      comparacao: null,
      erros: [],
    }
  }

  const anterior = pontoDiagnosticoDelta(
    pontos.find((p) => p.label === melhor.antes),
    'anterior'
  )
  const proximo = pontoDiagnosticoDelta(
    pontos.find((p) => p.label === melhor.depois),
    'proximo'
  )
  const agenda90 = pontoDiagnosticoDelta(
    pontos.find((p) => p.label.includes('agenda_90')) ?? pontos.filter((p) => p.tipo === 'agenda')[1],
    'agenda_90'
  )
  const novo = {
    id: 'destino',
    label: 'destino',
    lat: input.destino.lat,
    lng: input.destino.lng,
    endereco: input.destino.descricao ?? null,
  }

  if (!anterior) {
    return {
      executado: false,
      ok: false,
      motivoNaoExecutado: 'Ponto anterior da melhor insercao nao encontrado na rota base.',
      baseUrl: input.osrmBaseUrl,
      insercao: {
        indiceInsercao: melhor.indiceInsercao,
        anterior,
        novo,
        proximo,
      },
      table: null,
      route: null,
      comparacao: null,
      erros: [],
    }
  }

  if (!proximo) {
    return {
      executado: false,
      ok: false,
      motivoNaoExecutado: 'Melhor insercao no fim da rota: nao ha proximo ponto para comparar prev->novo->next.',
      baseUrl: input.osrmBaseUrl,
      insercao: {
        indiceInsercao: melhor.indiceInsercao,
        anterior,
        novo,
        proximo,
      },
      table: {
        anteriorNovoM: (melhor as { trechoAnteriorNovoM?: number }).trechoAnteriorNovoM ?? null,
        novoProximoM: (melhor as { trechoNovoProximoM?: number }).trechoNovoProximoM ?? null,
        anteriorProximoM: (melhor as { trechoAnteriorProximoM?: number }).trechoAnteriorProximoM ?? null,
        deltaM: melhor.deltaM,
      },
      route: null,
      comparacao: null,
      erros: [],
    }
  }

  const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
    baseUrl: input.osrmBaseUrl,
    timeoutMs: 5000,
  })
  const [anteriorNovo, novoProximo, anteriorProximo] = await Promise.all([
    buscarRota(anterior, novo),
    buscarRota(novo, proximo),
    buscarRota(anterior, proximo),
  ])
  const [
    origemLegadoNovo,
    origemLegadoProximo,
    agenda90Destino,
    destinoAgenda90,
  ] = await Promise.all([
    buscarRota(ORIGEM_LEGADO_LOG_SANTO_AMARO_16_JUL, novo),
    buscarRota(ORIGEM_LEGADO_LOG_SANTO_AMARO_16_JUL, proximo),
    agenda90 ? buscarRota(agenda90, novo) : Promise.resolve({ ok: false, distanciaM: null, erro: 'agenda_90 ausente' }),
    agenda90 ? buscarRota(novo, agenda90) : Promise.resolve({ ok: false, distanciaM: null, erro: 'agenda_90 ausente' }),
  ])

  const erros = [
    anteriorNovo.ok ? null : `route anterior->novo: ${anteriorNovo.erro ?? 'distancia nula'}`,
    novoProximo.ok ? null : `route novo->proximo: ${novoProximo.erro ?? 'distancia nula'}`,
    anteriorProximo.ok ? null : `route anterior->proximo: ${anteriorProximo.erro ?? 'distancia nula'}`,
    origemLegadoNovo.ok ? null : `route origem-legado->novo: ${origemLegadoNovo.erro ?? 'distancia nula'}`,
    origemLegadoProximo.ok ? null : `route origem-legado->agenda89: ${origemLegadoProximo.erro ?? 'distancia nula'}`,
    agenda90Destino.ok ? null : `route agenda90->novo: ${agenda90Destino.erro ?? 'distancia nula'}`,
    destinoAgenda90.ok ? null : `route novo->agenda90: ${destinoAgenda90.erro ?? 'distancia nula'}`,
  ].filter((erro): erro is string => Boolean(erro))

  const routeDeltaM =
    anteriorNovo.distanciaM !== null && novoProximo.distanciaM !== null && anteriorProximo.distanciaM !== null
      ? Math.round(anteriorNovo.distanciaM + novoProximo.distanciaM - anteriorProximo.distanciaM)
      : null
  const legadoOrigemDeltaM =
    origemLegadoNovo.distanciaM !== null &&
    novoProximo.distanciaM !== null &&
    origemLegadoProximo.distanciaM !== null
      ? Math.round(origemLegadoNovo.distanciaM + novoProximo.distanciaM - origemLegadoProximo.distanciaM)
      : null
  const tableDeltaM = melhor.deltaM
  const diferencaTableVsRouteM = routeDeltaM === null ? null : tableDeltaM - routeDeltaM
  const diferencaRouteVsLegadoM = routeDeltaM === null ? null : DELTA_LEGADO_ESPERADO_SANTO_AMARO_M - routeDeltaM
  const diferencaTableVsLegadoM = DELTA_LEGADO_ESPERADO_SANTO_AMARO_M - tableDeltaM
  const causaProvavel =
    routeDeltaM !== null && Math.abs(diferencaRouteVsLegadoM ?? 0) < Math.abs(diferencaTableVsLegadoM)
      ? 'OSRM /table vs /route provavelmente explica parte relevante da diferenca do delta 16/07.'
      : 'OSRM /table vs /route nao explica sozinho a diferenca do delta 16/07; verificar coordenadas, origem, ordem ou pontos da agenda.'

  return {
    executado: true,
    ok: erros.length === 0 && routeDeltaM !== null,
    motivoNaoExecutado: null,
    baseUrl: input.osrmBaseUrl,
    insercao: {
      indiceInsercao: melhor.indiceInsercao,
      anterior,
      novo,
      proximo,
    },
    table: {
      anteriorNovoM: (melhor as { trechoAnteriorNovoM?: number }).trechoAnteriorNovoM ?? null,
      novoProximoM: (melhor as { trechoNovoProximoM?: number }).trechoNovoProximoM ?? null,
      anteriorProximoM: (melhor as { trechoAnteriorProximoM?: number }).trechoAnteriorProximoM ?? null,
      deltaM: tableDeltaM,
    },
    route: {
      anteriorNovoM: anteriorNovo.distanciaM,
      novoProximoM: novoProximo.distanciaM,
      anteriorProximoM: anteriorProximo.distanciaM,
      deltaM: routeDeltaM,
    },
    comparacao: {
      deltaLegadoEsperadoM: DELTA_LEGADO_ESPERADO_SANTO_AMARO_M,
      diferencaTableVsRouteM,
      diferencaRouteVsLegadoM,
      diferencaTableVsLegadoM,
      causaProvavel,
    },
    origemLegadoInformada: {
      ...ORIGEM_LEGADO_LOG_SANTO_AMARO_16_JUL,
      insercaoInicioRoute: {
        origemLegadoNovoM: origemLegadoNovo.distanciaM,
        novoAgenda89M: novoProximo.distanciaM,
        origemLegadoAgenda89M: origemLegadoProximo.distanciaM,
        deltaM: legadoOrigemDeltaM,
        diferencaVsRouteV2M:
          legadoOrigemDeltaM === null || routeDeltaM === null ? null : legadoOrigemDeltaM - routeDeltaM,
        diferencaVsLegadoEsperadoM:
          legadoOrigemDeltaM === null ? null : DELTA_LEGADO_ESPERADO_SANTO_AMARO_M - legadoOrigemDeltaM,
      },
    },
    agenda90: {
      ponto: agenda90,
      routeAgenda90DestinoM: agenda90Destino.distanciaM,
      routeDestinoAgenda90M: destinoAgenda90.distanciaM,
      diferencaAgenda90DestinoVsLegadoEsperadoM:
        agenda90Destino.distanciaM === null
          ? null
          : DELTA_LEGADO_ESPERADO_SANTO_AMARO_M - agenda90Destino.distanciaM,
      observacao:
        'No legado, a insercao no fim da rota usa prev->novo. Para agenda_90/Rua Nicanor, isso corresponde ao trecho agenda_90->destino, que deve ser comparado ao NEARCHK 10465m dos logs.',
    },
    erros,
  }
}

export async function pesquisarDatasV2(
  body: PesquisarDatasRequest,
  options: PesquisarDatasV2Options = {}
): Promise<PesquisarDatasV2Output> {
  const perf = options.medidorPerformance
  const avisos: string[] = [
    'Rota v2 paralela. Nao altera producao, frontend ou Apps Script.',
  ]

  const entrada = normalizarEntradaPesquisaV2(body)
  const entradaMinima = montarEntradaMinima(entrada)

  if (!entrada.dataInicialISO) {
    return respostaErro(['dataInicial ausente ou invalida.'], avisos, entradaMinima)
  }
  if (!entrada.temCoordenadasDestino || !entrada.coordenadasDestino) {
    return respostaErro(['destLat/destLng ausentes ou invalidos.'], avisos, entradaMinima)
  }
  if (entrada.tempoNecessarioMin === null) {
    return respostaErro(['tempoNecessario ausente ou invalido.'], avisos, entradaMinima)
  }
  const dataInicialISO = entrada.dataInicialISO
  const coordenadasDestino = entrada.coordenadasDestino

  const configResult = await (perf?.medirAsync('config', () => buscarConfiguracoesProcurarDatas()) ?? buscarConfiguracoesProcurarDatas())
  if (!configResult.ok) {
    return respostaErro([`Config operacional nao carregada: ${configResult.erro}`], avisos, entradaMinima)
  }

  const janela = perf?.medir('janela-datas', () =>
    gerarJanelaDatasPesquisaV2({
      dataInicialISO: entrada.dataInicialISO,
      diasPesquisaAgenda: configResult.config.diasPesquisaAgenda,
    })
  ) ?? gerarJanelaDatasPesquisaV2({
    dataInicialISO: entrada.dataInicialISO,
    diasPesquisaAgenda: configResult.config.diasPesquisaAgenda,
  })
  avisos.push(...janela.avisos)
  if (!janela.ok) {
    return respostaErro(['Janela de datas nao foi gerada com sucesso.'], avisos, entradaMinima)
  }

  const [disponibilidadeReal, agendaReal] = await (perf?.medirAsync('agenda-disponibilidade', () =>
    Promise.all([
      buscarDisponibilidadeRealDiagnosticaComDados(dataInicialISO, 2000, 20, 'entrada'),
      buscarAgendaRealDiagnosticaComDados(2000),
    ])
  ) ?? Promise.all([
    buscarDisponibilidadeRealDiagnosticaComDados(dataInicialISO, 2000, 20, 'entrada'),
    buscarAgendaRealDiagnosticaComDados(2000),
  ]))

  if (!disponibilidadeReal.diagnostico.ok) {
    const erro = 'erro' in disponibilidadeReal.diagnostico
      ? disponibilidadeReal.diagnostico.erro
      : 'Disponibilidade real nao executada.'
    return respostaErro([`Disponibilidade real indisponivel: ${erro}`], avisos, entradaMinima)
  }
  if (!agendaReal.diagnostico.ok) {
    const erro = 'erro' in agendaReal.diagnostico
      ? agendaReal.diagnostico.erro
      : 'Agenda real nao executada.'
    return respostaErro([`Agenda real indisponivel: ${erro}`], avisos, entradaMinima)
  }
  if (
    ('leitura' in disponibilidadeReal.diagnostico &&
      disponibilidadeReal.diagnostico.leitura.truncada) ||
    ('leitura' in agendaReal.diagnostico && agendaReal.diagnostico.leitura.truncada)
  ) {
    return respostaErro(
      ['Leitura de agenda/disponibilidade truncada; pesquisa bloqueada para evitar resultado espacialmente incompleto.'],
      avisos,
      entradaMinima
    )
  }

  const cacheAgenda = await (perf?.medirAsync('geocodificacao-cache', () =>
    resolverCacheCoordenadasAgendaDiagnostico({
      linhasAgenda: agendaReal.linhasAgenda,
      supabaseTable: configResult.config.supabaseTable,
    })
  ) ?? resolverCacheCoordenadasAgendaDiagnostico({
    linhasAgenda: agendaReal.linhasAgenda,
    supabaseTable: configResult.config.supabaseTable,
  }))
  perf?.registrarCache({
    hashesConsultados: cacheAgenda.hashesConsultados,
    hitsSupabase: cacheAgenda.hitsSupabase,
    enderecosSemHash: cacheAgenda.enderecosSemHash,
  })
  avisos.push(...cacheAgenda.avisos)

  const equipesAtivas: string[] = []
  if (configResult.config.equipe1Ativa) equipesAtivas.push('EQUIPE 1')
  if (configResult.config.equipe2Ativa) equipesAtivas.push('EQUIPE 2')

  const resolucaoCoordenadasAgenda = await (perf?.medirAsync('geocodificacao-agenda-producao', () =>
    resolverCoordenadasAgendaProducao({
      linhasAgenda: agendaReal.linhasAgenda,
      datasAlvoISO: janela.datas.map((d) => d.dataISO),
      equipesAlvo: equipesAtivas,
      cacheCoordenadasPorEndereco: cacheAgenda.cacheCoordenadasPorEndereco,
      maxGeocodificacoesExternas: 5,
    })
  ) ?? resolverCoordenadasAgendaProducao({
    linhasAgenda: agendaReal.linhasAgenda,
    datasAlvoISO: janela.datas.map((d) => d.dataISO),
    equipesAlvo: equipesAtivas,
    cacheCoordenadasPorEndereco: cacheAgenda.cacheCoordenadasPorEndereco,
    maxGeocodificacoesExternas: 5,
  }))
  avisos.push(...resolucaoCoordenadasAgenda.avisos)

  const osrmResolvido = resolverOsrmBaseUrlV2(configResult.config.osrmBaseUrl)
  const buscarMatrizOSRMBase = criarBuscarMatrizOSRMTableDiagnosticoV2({
    baseUrl: osrmResolvido.url,
    timeoutMs: 5000,
  })
  const buscarMatrizOSRM = perf
    ? (coordenadas: Parameters<typeof buscarMatrizOSRMBase>[0]) =>
        perf.medirOsrm('matriz-table', () => buscarMatrizOSRMBase(coordenadas))
    : buscarMatrizOSRMBase

  const slots = montarSlotsAgendaReal({
    janelaDatas: janela.datas,
    linhasAgenda: agendaReal.linhasAgenda,
    disponibilidades: disponibilidadeReal.disponibilidades,
    cacheCoordenadasPorEndereco: resolucaoCoordenadasAgenda.cacheCoordenadasPorEndereco,
    equipe1Ativa: configResult.config.equipe1Ativa,
    equipe2Ativa: configResult.config.equipe2Ativa,
  })

  const mapaPorSlot = await (perf?.medirAsync('mapa-km-adicional-slots', () =>
    calcularMapaKmAdicionalPorSlotControladoV2({
      slots,
      destino: {
        lat: coordenadasDestino.lat,
        lng: coordenadasDestino.lng,
        descricao: entrada.enderecoCompleto ?? (body as { destDisplay?: string }).destDisplay,
      },
      configOrigem: {
        latDeposito: configResult.config.latDeposito,
        lngDeposito: configResult.config.lngDeposito,
        latCasaE1: configResult.config.latCasaE1,
        lngCasaE1: configResult.config.lngCasaE1,
        latCasaE2: configResult.config.latCasaE2,
        lngCasaE2: configResult.config.lngCasaE2,
      },
      configFiltroEarlyLegado: {
        kmMaxEntrePontosKm: configResult.config.kmMaxEntrePontosKm,
        kmAdicionalMaxNaRotaPremiumM: configResult.config.kmAdicionalMaxNaRotaPremiumM,
      },
      buscarMatrizOSRM,
      incluirDetalhesInsercao:
        options.diagnosticoResultadoTelaV2SantoAmaro === true ||
        options.diagnosticoDeltaSantoAmaro16Jul === true ||
        options.diagnosticoDeltaMajorHardy31Jul === true,
    })
  ) ?? calcularMapaKmAdicionalPorSlotControladoV2({
    slots,
    destino: {
      lat: coordenadasDestino.lat,
      lng: coordenadasDestino.lng,
      descricao: entrada.enderecoCompleto ?? (body as { destDisplay?: string }).destDisplay,
    },
    configOrigem: {
      latDeposito: configResult.config.latDeposito,
      lngDeposito: configResult.config.lngDeposito,
      latCasaE1: configResult.config.latCasaE1,
      lngCasaE1: configResult.config.lngCasaE1,
      latCasaE2: configResult.config.latCasaE2,
      lngCasaE2: configResult.config.lngCasaE2,
    },
    configFiltroEarlyLegado: {
      kmMaxEntrePontosKm: configResult.config.kmMaxEntrePontosKm,
      kmAdicionalMaxNaRotaPremiumM: configResult.config.kmAdicionalMaxNaRotaPremiumM,
    },
    buscarMatrizOSRM,
    incluirDetalhesInsercao:
      options.diagnosticoResultadoTelaV2SantoAmaro === true ||
      options.diagnosticoDeltaSantoAmaro16Jul === true ||
      options.diagnosticoDeltaMajorHardy31Jul === true,
  }))
  avisos.push(...mapaPorSlot.avisos)

  const slotTemPontosPorSlotKey = derivarSlotTemPontos(mapaPorSlot.detalhesPorSlot)
  const contagemSlots = contarSlots(slotTemPontosPorSlotKey)
  const resumoConsistenciaEspacial = resumirConsistenciaEspacial(mapaPorSlot.detalhesPorSlot)
  const coberturaFontes = resumirCoberturaFontes(
    agendaReal.linhasAgenda,
    disponibilidadeReal.disponibilidades
  )
  console.info('[procurar-datas:v2:fontes]', {
    coberturaFontes,
    janelaInicio: janela.datas[0]?.dataISO ?? null,
    janelaFim: janela.datas.at(-1)?.dataISO ?? null,
    ...resumoConsistenciaEspacial,
  })
  for (const detalhe of mapaPorSlot.detalhesPorSlot) {
    if (!detalhe.consistenciaEspacial?.bloqueado) continue
    console.warn('[procurar-datas:v2:slot-bloqueado]', {
      slotKey: detalhe.chave,
      ...detalhe.consistenciaEspacial,
    })
  }
  perf?.registrarSlots({
    slotsAvaliados: mapaPorSlot.contadores.slotsProcessados,
    slotsComPontos: contagemSlots.quantidadeSlotsComPontos,
    slotsSemPontos: contagemSlots.quantidadeSlotsSemPontos,
    slotsComKm: mapaPorSlot.contadores.slotsComKm,
    slotsComFallbackHaversine: mapaPorSlot.contadores.slotsComFallbackHaversine,
  })

  const candidatos = perf?.medir('geracao-candidatos', () =>
    gerarCandidatosComDisponibilidadeRealV2({
      janelaDatas: janela.datas,
      disponibilidades: disponibilidadeReal.disponibilidades,
      tempoNecessarioMin: entrada.tempoNecessarioMin,
      distanciaKm: null,
      kmAdicionalNaRotaM: null,
      valorFrete: null,
      tipoFrete: null,
      isCondominio: entrada.isCondominio,
      isRural: entrada.isRural,
      slotTemPontosPorDataEquipe: slotTemPontosPorSlotKey,
      mapaKmAdicionalPorSlot: mapaPorSlot.mapa,
      configOperacional: {
        kmAdicionalMaxNaRotaM: configResult.config.kmAdicionalMaxNaRotaM,
        kmAdicionalMaxNaRotaEspecialM: configResult.config.kmAdicionalMaxNaRotaEspecialM,
        kmAdicionalMaxNaRotaPremiumM: configResult.config.kmAdicionalMaxNaRotaPremiumM,
        kmMaximoNaSemanaM: configResult.config.kmMaximoNaSemanaM,
        kmMaximoNoSabadoM: configResult.config.kmMaximoNoSabadoM,
        horaMarcadaHorasAMais: configResult.config.horaMarcadaHorasAMais,
      },
    })
  ) ?? gerarCandidatosComDisponibilidadeRealV2({
    janelaDatas: janela.datas,
    disponibilidades: disponibilidadeReal.disponibilidades,
    tempoNecessarioMin: entrada.tempoNecessarioMin,
    distanciaKm: null,
    kmAdicionalNaRotaM: null,
    valorFrete: null,
    tipoFrete: null,
    isCondominio: entrada.isCondominio,
    isRural: entrada.isRural,
    slotTemPontosPorDataEquipe: slotTemPontosPorSlotKey,
    mapaKmAdicionalPorSlot: mapaPorSlot.mapa,
    configOperacional: {
      kmAdicionalMaxNaRotaM: configResult.config.kmAdicionalMaxNaRotaM,
      kmAdicionalMaxNaRotaEspecialM: configResult.config.kmAdicionalMaxNaRotaEspecialM,
      kmAdicionalMaxNaRotaPremiumM: configResult.config.kmAdicionalMaxNaRotaPremiumM,
      kmMaximoNaSemanaM: configResult.config.kmMaximoNaSemanaM,
      kmMaximoNoSabadoM: configResult.config.kmMaximoNoSabadoM,
      horaMarcadaHorasAMais: configResult.config.horaMarcadaHorasAMais,
    },
  })
  perf?.registrarCandidatosAntesRecorte(candidatos.candidatos)
  avisos.push(...candidatos.avisos)

  const recorte = perf?.medir('recorte', () =>
    recortarCandidatosLegadoEquivalente({
      candidatos: candidatos.candidatosOrdenados,
      maxNormais: MAX_NORMAIS_V2,
    })
  ) ?? recortarCandidatosLegadoEquivalente({
    candidatos: candidatos.candidatosOrdenados,
    maxNormais: MAX_NORMAIS_V2,
  })
  perf?.registrarRecorte({
    candidatosFinais: recorte.candidatosFinais,
    exclusoes: recorte.exclusoes,
    extrasRemovidosPorDataPosterior: recorte.resumo.extrasRemovidosPorDataPosterior,
  })
  perf?.registrarJanelaProcessadaInteira(mapaPorSlot.contadores.slotsProcessados === slots.length)
  avisos.push(...recorte.avisos)

  const diagnosticoResultadoTelaV2SantoAmaro = options.diagnosticoResultadoTelaV2SantoAmaro
    ? montarDiagnosticoResultadoTelaV2SantoAmaro({
        request: body,
        disponibilidadePorJanela: candidatos.disponibilidadePorJanela,
        detalhesPorSlot: mapaPorSlot.detalhesPorSlot,
        candidatosAntesRecorte: candidatos.candidatosOrdenados,
        recorte,
      })
    : undefined

  const comparativoOsrmRouteTableDelta16Jul = options.diagnosticoDeltaSantoAmaro16Jul
    ? await compararOsrmRouteTableDeltaSantoAmaro16Jul({
        detalhesPorSlot: mapaPorSlot.detalhesPorSlot,
        destino: {
          lat: coordenadasDestino.lat,
          lng: coordenadasDestino.lng,
          descricao: entrada.enderecoCompleto ?? (body as { destDisplay?: string }).destDisplay,
        },
        osrmBaseUrl: osrmResolvido.url,
      })
    : null

  const diagnosticoDeltaSantoAmaro16Jul = options.diagnosticoDeltaSantoAmaro16Jul
    ? montarDiagnosticoDeltaSantoAmaro16Jul({
        request: body,
        config: configResult.config,
        detalhesPorSlot: mapaPorSlot.detalhesPorSlot,
        candidatosAntesRecorte: candidatos.candidatosOrdenados,
        recorte,
        comparativoOsrmRouteTable: comparativoOsrmRouteTableDelta16Jul,
      })
    : undefined

  const diagnosticoDeltaMajorHardy31Jul = options.diagnosticoDeltaMajorHardy31Jul
    ? montarDiagnosticoResultadoTelaV2MajorHardy({
        request: body,
        disponibilidadePorJanela: candidatos.disponibilidadePorJanela,
        detalhesPorSlot: mapaPorSlot.detalhesPorSlot,
        candidatosAntesRecorte: candidatos.candidatosOrdenados,
        recorte,
      })
    : undefined

  // Filtrar avisos de ruído intermediário que não afetam o resultado final
  // A rota v2 paralela usa mapaKmAdicionalPorSlot para km real, então distanciaKm e kmAdicionalNaRotaM globais são null por design
  const avisosFiltrados = avisos.filter(
    (aviso) =>
      !aviso.includes('distanciaKm não fornecida') &&
      !aviso.includes('kmAdicionalNaRotaM não fornecida')
  )
  const estadoResultado: NonNullable<
    PesquisarDatasV2Output['diagnosticoMinimo']['estadoResultado']
  > = recorte.candidatosFinais.length > 0
    ? 'ok'
    : resumoConsistenciaEspacial.slotsBloqueados > 0
      ? 'agenda-inconsistente'
      : mapaPorSlot.contadores.slotsComErro > 0
        ? 'calculo-espacial-incompleto'
        : 'sem-datas-disponiveis'

  return {
    ok: candidatos.ok && recorte.ok,
    modo: 'v2-pesquisar-paralelo',
    aviso: 'Rota v2 paralela. Nao altera producao, frontend ou Apps Script.',
    entradaNormalizada: entradaMinima,
    resultadoFinal: {
      candidatosFinais: recorte.candidatosFinais.map(mapearCandidatoFinal),
      resumo: {
        totalRecebidos: recorte.resumo.totalRecebidos,
        totalElegiveis: recorte.resumo.totalElegiveis,
        totalRecortados: recorte.resumo.totalRecortados,
        normaisRecortados: recorte.resumo.normaisRecortados,
        especiaisRecortados: recorte.resumo.especiaisRecortados,
        premiumsRecortados: recorte.resumo.premiumsRecortados,
        horaMarcadaRecortados: recorte.resumo.horaMarcadaRecortados,
        maxNormaisAplicado: MAX_NORMAIS_V2,
      },
      diasUsados: recorte.diasUsados,
    },
    diagnosticoMinimo: {
      estadoResultado,
      osrmBaseUrlUsado: osrmResolvido.url,
      osrmFallbackUsado: osrmResolvido.fallbackUsado,
      quantidadeSlotsComPontos: contagemSlots.quantidadeSlotsComPontos,
      quantidadeSlotsSemPontos: contagemSlots.quantidadeSlotsSemPontos,
      slotsComKm: mapaPorSlot.contadores.slotsComKm,
      slotsComFallbackHaversine: mapaPorSlot.contadores.slotsComFallbackHaversine,
      cacheAgenda: {
        hashesConsultados: cacheAgenda.hashesConsultados,
        hitsSupabase: cacheAgenda.hitsSupabase,
        enderecosSemHash: cacheAgenda.enderecosSemHash,
      },
      resolucaoCoordenadasAgenda: {
        enderecosComEnderecoSemCoordenada: resolucaoCoordenadasAgenda.enderecosComEnderecoSemCoordenada,
        resolvidosPorCache: resolucaoCoordenadasAgenda.resolvidosPorCache,
        resolvidosPorFallback: resolucaoCoordenadasAgenda.resolvidosPorFallback,
        aindaSemCoordenada: resolucaoCoordenadasAgenda.aindaSemCoordenada,
        geocodificacoesExternasTentadas: resolucaoCoordenadasAgenda.geocodificacoesExternasTentadas,
      },
      contadoresMapaKm: { ...mapaPorSlot.contadores },
      consistenciaEspacial: resumoConsistenciaEspacial,
      fonteAgenda: 'google-sheets',
      fonteDisponibilidade: 'google-sheets',
      coberturaFontes,
      avisos: avisosFiltrados,
    },
    snapshotTecnicoCandidatosFinais: montarSnapshotTecnicoCandidatosFinais(
      recorte.candidatosFinais,
      mapaPorSlot.detalhesPorSlot
    ),
    snapshotTecnicoSlotsBloqueados: montarSnapshotTecnicoSlotsBloqueados(
      mapaPorSlot.detalhesPorSlot
    ),
    ...(diagnosticoResultadoTelaV2SantoAmaro
      ? { diagnosticoResultadoTelaV2SantoAmaro }
      : {}),
    ...(diagnosticoDeltaSantoAmaro16Jul
      ? { diagnosticoDeltaSantoAmaro16Jul }
      : {}),
    ...(diagnosticoDeltaMajorHardy31Jul
      ? { diagnosticoDeltaMajorHardy31Jul }
      : {}),
    erros: [...mapaPorSlot.erros],
  }
}
