import type { PesquisarDatasRequest } from '../contratos'
import type { CandidatoPreliminarV2 } from './candidato'
import type { DetalheSlotMapaKmAdicional } from './calcular-mapa-km-adicional-por-slot'
import type { RecortarCandidatosLegadoEquivalenteOutput } from './recortar-candidatos-legado-equivalente'
import { normalizarEquipe } from './equipe'
import type { ConfigNormalizada } from '../config-service'

const DATA_ALVO = '2026-07-16'
const EQUIPE_ALVO = 'EQUIPE 1'
const DELTA_LEGADO_ESPERADO_M = 10460

export interface MontarDiagnosticoDeltaSantoAmaro16JulInput {
  request: PesquisarDatasRequest
  config: ConfigNormalizada
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
  candidatosAntesRecorte: CandidatoPreliminarV2[]
  recorte: RecortarCandidatosLegadoEquivalenteOutput
  comparativoOsrmRouteTable?: ComparativoOsrmRouteTableDelta16Jul | null
}

export type ComparativoOsrmRouteTableDelta16Jul = {
  executado: boolean
  ok: boolean
  motivoNaoExecutado: string | null
  baseUrl: string
  insercao: {
    indiceInsercao: number
    anterior: PontoDiagnosticoDelta | null
    novo: PontoDiagnosticoDelta
    proximo: PontoDiagnosticoDelta | null
  } | null
  table: {
    anteriorNovoM: number | null
    novoProximoM: number | null
    anteriorProximoM: number | null
    deltaM: number | null
  } | null
  route: {
    anteriorNovoM: number | null
    novoProximoM: number | null
    anteriorProximoM: number | null
    deltaM: number | null
  } | null
  comparacao: {
    deltaLegadoEsperadoM: number
    diferencaTableVsRouteM: number | null
    diferencaRouteVsLegadoM: number | null
    diferencaTableVsLegadoM: number | null
    causaProvavel: string
  } | null
  origemLegadoInformada?: {
    lat: number
    lng: number
    fonte: string
    insercaoInicioRoute: {
      origemLegadoNovoM: number | null
      novoAgenda89M: number | null
      origemLegadoAgenda89M: number | null
      deltaM: number | null
      diferencaVsRouteV2M: number | null
      diferencaVsLegadoEsperadoM: number | null
    } | null
  }
  agenda90?: {
    ponto: PontoDiagnosticoDelta | null
    routeAgenda90DestinoM: number | null
    routeDestinoAgenda90M: number | null
    diferencaAgenda90DestinoVsLegadoEsperadoM: number | null
    observacao: string
  }
  erros: string[]
}

type PontoDiagnosticoDelta = {
  id: string
  label: string
  lat: number
  lng: number
  endereco: string | null
}

function resumirPontoRotaBase(ponto: { indice: number; tipo: string; label: string; lat: number; lng: number; endereco?: string }) {
  return {
    indice: ponto.indice,
    tipo: ponto.tipo,
    id: ponto.label,
    label: ponto.label,
    lat: ponto.lat,
    lng: ponto.lng,
    endereco: ponto.endereco ?? null,
  }
}

function resumirCandidatoInsercao(c: {
  indiceInsercao: number
  antes: string | null
  depois: string | null
  custoOriginalM: number
  custoComDestinoM: number
  deltaM: number
}) {
  return {
    indiceInsercao: c.indiceInsercao,
    antes: c.antes,
    depois: c.depois,
    custoOriginalM: c.custoOriginalM,
    custoComDestinoM: c.custoComDestinoM,
    deltaM: c.deltaM,
  }
}

function pontoPorLabel(
  pontos: Array<{ indice: number; tipo: string; label: string; lat: number; lng: number; endereco?: string }> | null,
  label: string | null
): PontoDiagnosticoDelta | null {
  if (!label || !pontos) return null
  const ponto = pontos.find((p) => p.label === label) ?? null
  if (!ponto) return null
  return {
    id: ponto.label,
    label: ponto.label,
    lat: ponto.lat,
    lng: ponto.lng,
    endereco: ponto.endereco ?? null,
  }
}

function destinoDiagnostico(request: PesquisarDatasRequest): PontoDiagnosticoDelta {
  return {
    id: 'destino',
    label: 'destino',
    lat: request.destLat ?? NaN,
    lng: request.destLng ?? NaN,
    endereco: (request as { destDisplay?: string }).destDisplay ?? request.enderecoCompleto ?? null,
  }
}

function gerarHipoteses(input: {
  deltaV2M: number | null
  deltaLegadoM: number
  diferencaM: number | null
  detalheSlot: DetalheSlotMapaKmAdicional | null
  candidato: CandidatoPreliminarV2 | null
  comparativoOsrmRouteTable?: ComparativoOsrmRouteTableDelta16Jul | null
}): string[] {
  const hipoteses: string[] = []
  if (input.deltaV2M === null) {
    hipoteses.push('v2 nao calculou delta para 16/07 — verificar filtro early, origem ou pontos da agenda.')
    return hipoteses
  }

  if (input.diferencaM === null) return hipoteses

  hipoteses.push(`Diferenca de ${input.diferencaM}m entre legado informado (${input.deltaLegadoM}m) e v2 (${input.deltaV2M}m).`)

  const origem = input.detalheSlot?.origemOperacional?.tipo
  if (origem && origem !== 'deposito') {
    hipoteses.push(`Origem operacional v2 e "${origem}". Legado pode usar deposito ou casa da equipe de forma diferente para este dia. Ver CEP-APIBACK.gs:resolverOrigemParaData() e CEP-CONFIG.gs:HOME_SAT_E1/HOME_SAT_E2.`)
  }

  const ordemOtimizada = input.detalheSlot?.ordenacaoRotaBase?.ordemOtimizada
  const ordemOriginal = input.detalheSlot?.ordenacaoRotaBase?.ordemOriginal
  if (ordemOtimizada && ordemOriginal && JSON.stringify(ordemOtimizada) !== JSON.stringify(ordemOriginal)) {
    hipoteses.push('Ordenacao de rota base foi otimizada no v2. Se o legado nao aplicar two-opt, os trechos OSRM podem divergir.')
  }

  if (input.detalheSlot?.origemKmAdicionalNaRotaM === 'haversine-fallback-legado-diagnostico') {
    hipoteses.push('v2 usou fallback Haversine para delta. Haversine subestima ~19% em media; legado pode ter usado OSRM route/table para o mesmo slot.')
  }

  if (input.detalheSlot?.origemKmAdicionalNaRotaM === 'osrm-table-diagnostico') {
    hipoteses.push('v2 usou OSRM table para delta. Legado pode usar OSRM route completo ou outro endpoint; comparar trechos de/para cada ponto.')
  }

  const comparativo = input.comparativoOsrmRouteTable?.comparacao
  if (comparativo) {
    hipoteses.push(comparativo.causaProvavel)
  }

  const melhor = input.detalheSlot?.deltaInsercao?.melhorInsercao
  if (melhor && melhor.antes === 'origem') {
    hipoteses.push('Melhor insercao v2 e no inicio da rota (origem -> destino -> primeiro ponto). Legado pode encontrar melhor insercao em outra posicao se a ordem da agenda for diferente.')
  }

  const candidatos = input.detalheSlot?.deltaInsercao?.candidatosInsercao
  if (candidatos && candidatos.length > 1) {
    const segundo = [...candidatos].sort((a, b) => a.deltaM - b.deltaM)[1]
    if (segundo && input.deltaV2M - segundo.deltaM < 500) {
      hipoteses.push(`Segunda melhor insercao v2 (${segundo.deltaM}m) esta a menos de 500m da vencedora. Pequena diferenca de ordem/pontos pode inverter o resultado no legado.`)
    }
  }

  const agenda89 = input.detalheSlot?.deltaInsercao?.pontosRotaBase?.find((p) => p.label.includes('agenda_89') || p.label.includes('89'))
  if (!agenda89) {
    hipoteses.push('Ponto agenda_89 nao encontrado na rota base v2. O legado pode ter um ponto diferente nesta posicao ou a agenda real pode divergir.')
  }

  if (input.detalheSlot?.filtroEarlyLegado?.descartado) {
    hipoteses.push('Filtro early legado descartou o slot no v2. Se o legado nao descartou, a diferenca comeca aqui.')
  }

  return hipoteses
}

export function montarDiagnosticoDeltaSantoAmaro16Jul(
  input: MontarDiagnosticoDeltaSantoAmaro16JulInput
): Record<string, unknown> {
  const equipeNormalizada = normalizarEquipe(EQUIPE_ALVO) ?? EQUIPE_ALVO

  const detalheSlot =
    input.detalhesPorSlot.find(
      (d) => d.dataISO === DATA_ALVO && normalizarEquipe(d.equipe) === equipeNormalizada
    ) ?? null

  const candidatosData = input.candidatosAntesRecorte.filter(
    (c) => c.dataISO === DATA_ALVO && normalizarEquipe(c.equipe) === equipeNormalizada
  )
  const candidatoElegivel = candidatosData.find((c) => c.elegivel) ?? null
  const candidatoPrincipal = candidatoElegivel ?? candidatosData[0] ?? null
  const candidatoFinal =
    input.recorte.candidatosFinais.find(
      (c) => c.dataISO === DATA_ALVO && normalizarEquipe(c.equipe) === equipeNormalizada
    ) ?? null
  const exclusoes = input.recorte.exclusoes.filter(
    (e) => e.dataISO === DATA_ALVO && normalizarEquipe(e.equipe) === equipeNormalizada
  )

  const deltaV2M = detalheSlot?.kmAdicionalNaRotaM ?? null
  const diferencaM = deltaV2M === null ? null : DELTA_LEGADO_ESPERADO_M - deltaV2M

  const melhorInsercao = detalheSlot?.deltaInsercao?.melhorInsercao ?? null
  const candidatosInsercao = detalheSlot?.deltaInsercao?.candidatosInsercao ?? null
  const pontosRotaBase = detalheSlot?.deltaInsercao?.pontosRotaBase ?? null
  const destino = destinoDiagnostico(input.request)
  const pontoAgenda89 = pontosRotaBase?.find((p) => p.label.includes('agenda_89')) ?? null

  const tempoNecessarioMin = input.candidatosAntesRecorte.find((c) => c.operacional.tempoNecessarioMin !== null)
    ?.operacional.tempoNecessarioMin ?? null

  const configUsada = {
    kmMaxEntrePontosKm: input.config.kmMaxEntrePontosKm,
    kmAdicionalMaxNaRotaM: input.config.kmAdicionalMaxNaRotaM,
    kmAdicionalMaxNaRotaEspecialM: input.config.kmAdicionalMaxNaRotaEspecialM,
    kmAdicionalMaxNaRotaPremiumM: input.config.kmAdicionalMaxNaRotaPremiumM,
    kmMaximoNaSemanaM: input.config.kmMaximoNaSemanaM,
    kmMaximoNoSabadoM: input.config.kmMaximoNoSabadoM,
    origemConfig: 'banco/Supabase (fonte oficial)',
  }

  const limites = candidatoPrincipal?.limites ?? null

  return {
    executado: true,
    ok: true,
    modo: 'diagnostico-delta-santo-amaro-16-jul',
    escopo: 'Diagnostico enxuto focado apenas na diferenca de delta do 16/07. Nao altera regras, ranking, frontend ou legado.',
    identificacao: {
      data: DATA_ALVO,
      equipe: EQUIPE_ALVO,
      destino: {
        lat: input.request.destLat ?? null,
        lng: input.request.destLng ?? null,
        cep: input.request.cep ?? null,
        endereco: (input.request as { destDisplay?: string }).destDisplay ?? null,
      },
      tempoNecessarioMin,
    },
    configUsada,
    limitesClassificacao: limites
      ? {
          limiteBaseM: limites.limiteBaseM ?? null,
          limiteEspecialM: limites.limiteEspecialM ?? null,
          limitePremiumM: limites.limitePremiumM ?? null,
        }
      : null,
    rotaBaseV2: {
      origemOperacional: detalheSlot?.origemOperacional ?? null,
      pontos: pontosRotaBase ? pontosRotaBase.map(resumirPontoRotaBase) : null,
      ordemOriginal: detalheSlot?.ordenacaoRotaBase?.ordemOriginal ?? null,
      ordemOtimizada: detalheSlot?.ordenacaoRotaBase?.ordemOtimizada ?? null,
      criterioOrdenacao: detalheSlot?.ordenacaoRotaBase?.criterioOrdenacao ?? null,
    },
    melhorInsercaoV2: melhorInsercao
      ? {
          indiceInsercao: melhorInsercao.indiceInsercao,
          antes: melhorInsercao.antes,
          depois: melhorInsercao.depois,
          anteriorDetalhado: pontoPorLabel(pontosRotaBase, melhorInsercao.antes),
          destinoDetalhado: destino,
          proximoDetalhado: pontoPorLabel(pontosRotaBase, melhorInsercao.depois),
          custoOriginalM: melhorInsercao.custoOriginalM,
          custoComDestinoM: melhorInsercao.custoComDestinoM,
          deltaM: melhorInsercao.deltaM,
          trechoAnteriorNovoM: (detalheSlot?.deltaInsercao as { candidatosInsercao?: { indiceInsercao: number; trechoAnteriorNovoM: number }[] })?.candidatosInsercao?.find((c) => c.indiceInsercao === melhorInsercao.indiceInsercao)?.trechoAnteriorNovoM ?? null,
          trechoNovoProximoM: (detalheSlot?.deltaInsercao as { candidatosInsercao?: { indiceInsercao: number; trechoNovoProximoM: number }[] })?.candidatosInsercao?.find((c) => c.indiceInsercao === melhorInsercao.indiceInsercao)?.trechoNovoProximoM ?? null,
          trechoAnteriorProximoM: (detalheSlot?.deltaInsercao as { candidatosInsercao?: { indiceInsercao: number; trechoAnteriorProximoM: number }[] })?.candidatosInsercao?.find((c) => c.indiceInsercao === melhorInsercao.indiceInsercao)?.trechoAnteriorProximoM ?? null,
        }
      : null,
    candidatosInsercao: candidatosInsercao ? candidatosInsercao.map(resumirCandidatoInsercao) : null,
    agenda89: pontoAgenda89 ? resumirPontoRotaBase(pontoAgenda89) : null,
    filtroEarlyLegado: detalheSlot?.filtroEarlyLegado ?? null,
    comparativoLegado: {
      deltaLegadoEsperadoM: DELTA_LEGADO_ESPERADO_M,
      deltaV2M,
      diferencaM,
      percentualDiferenca: deltaV2M === null ? null : Number((((DELTA_LEGADO_ESPERADO_M - deltaV2M) / deltaV2M) * 100).toFixed(1)),
    },
    comparativoOsrmRouteTable: input.comparativoOsrmRouteTable ?? null,
    classificacaoV2: candidatoPrincipal
      ? {
          tipo: candidatoPrincipal.tipo,
          elegivel: candidatoPrincipal.elegivel,
          kmAdicionalNaRotaM: candidatoPrincipal.distancia.kmAdicionalNaRotaM,
          origemKmAdicional: candidatoPrincipal.distancia.origemKmAdicional ?? null,
        }
      : null,
    recorte: {
      entrouNoFinal: candidatoFinal !== null,
      rankNoFinal: candidatoFinal
        ? input.recorte.candidatosFinais.findIndex((c) => c.id === candidatoFinal.id) + 1
        : null,
      exclusoes: exclusoes.map((e) => ({ motivo: e.motivo, tipo: e.tipo })),
    },
    hipoteses: gerarHipoteses({
      deltaV2M,
      deltaLegadoM: DELTA_LEGADO_ESPERADO_M,
      diferencaM,
      detalheSlot,
      candidato: candidatoPrincipal,
      comparativoOsrmRouteTable: input.comparativoOsrmRouteTable,
    }),
    consultarLegado: [
      'CEP-APIBACK.gs: getSlots() -> linha que le agenda e monta pontos do dia para 2026-07-16.',
      'CEP-APIBACK.gs: coletarPontosDoDia() -> confirmar se pontos da agenda (incluindo agenda_89) batem com v2.',
      'CEP-APIBACK.gs: loop principal onde calcula bestKm/delta para 16/07.',
      'CEP-APIBACK.gs: selecionarConjuntoApp3ComExtras_() -> como 16/07 entra como premium.',
      'CEP-CONFIG.gs: getDrivingKm/getDrivingKmBatch -> comparar trechos OSRM usados no delta.',
      'CEP-CONFIG.gs: resolverOrigemParaData() -> confirmar origem (deposito/casa) para 16/07.',
    ],
    mini24Jul: resumir24Jul(input),
  }
}

function resumir24Jul(input: MontarDiagnosticoDeltaSantoAmaro16JulInput) {
  const equipeNormalizada = normalizarEquipe(EQUIPE_ALVO) ?? EQUIPE_ALVO
  const candidatosData = input.candidatosAntesRecorte.filter(
    (c) => c.dataISO === '2026-07-24' && normalizarEquipe(c.equipe) === equipeNormalizada
  )
  const candidatoElegivel = candidatosData.find((c) => c.elegivel && c.tipo === 'especial') ?? null
  const exclusoes = input.recorte.exclusoes.filter(
    (e) => e.dataISO === '2026-07-24' && normalizarEquipe(e.equipe) === equipeNormalizada
  )
  return {
    data: '2026-07-24',
    tipoEsperadoLegado: 'especial',
    geradoNoV2: candidatoElegivel !== null,
    tipoV2: candidatoElegivel?.tipo ?? null,
    deltaV2M: candidatoElegivel?.distancia.kmAdicionalNaRotaM ?? null,
    motivoNaoEntrou: exclusoes.length > 0 ? exclusoes.map((e) => e.motivo) : null,
    dependeDe16JulSerPremium: true,
  }
}
