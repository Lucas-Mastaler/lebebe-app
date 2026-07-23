import { calcularDeltaInsercaoRotaDiagnosticoV2 } from './calcular-delta-insercao-rota'
import { calcularDeltaInsercaoRotaComMatrizDiagnosticoV2 } from './calcular-delta-insercao-matriz'
import { haversineKm, type Coordenada } from './distancia'
import { parsearPontosAgendaDoDiaV2, type LinhaAgendaShAgV2 } from './parse-agenda-shag'
import {
  prepararMatrizOSRMDiagnosticoV2,
  criarCalculadorDistanciaPorCoordenadas,
  type BuscarMatrizOSRM,
  type PontoRotaOSRM,
} from './preparar-matriz-osrm-diagnostico'
import {
  resolverOrigemOperacionalV2,
  type ResolverOrigemOperacionalInput,
} from './resolver-origem-operacional'
import {
  otimizarRotaBaseLegado,
  type DiagnosticoOrdenacaoRotaBase,
} from './otimizar-rota-base-legado'
import {
  avaliarConsistenciaEspacialSlotV2,
  type ConsistenciaEspacialSlotV2,
} from './avaliar-consistencia-espacial-slot'
import type { MedidorPerformanceV2 } from './performance-diagnostico-v2'

export type CalcularKmAdicionalRealControladoInput = {
  dataISO: string
  equipe: string
  configOrigem: ResolverOrigemOperacionalInput['config']
  configFiltroEarlyLegado?: {
    kmMaxEntrePontosKm: number | null
    kmAdicionalMaxNaRotaPremiumM: number | null
  }
  destino: Coordenada & { descricao?: string }
  linhasAgenda: LinhaAgendaShAgV2[]
  disponibilidade?: {
    tempoUtilizadoMin?: number | null
    disponivelMin: number
    capacidadeTotalMin?: number | null
  } | null
  cacheCoordenadasPorEndereco?: Record<string, { lat: number; lng: number }>
  buscarMatrizOSRM: BuscarMatrizOSRM
  /** Se true, retorna candidatosInsercao e pontosRotaBase no deltaInsercao. */
  incluirDetalhesInsercao?: boolean
  medidorPerformance?: MedidorPerformanceV2
}

export type CalcularKmAdicionalRealControladoOutput = {
  ok: boolean
  modo: 'km-adicional-real-controlado-diagnostico'
  kmAdicionalNaRotaM: number | null
  origemKmAdicionalNaRotaM:
    | 'osrm-table-diagnostico'
    | 'haversine-fallback-legado-diagnostico'
    | 'filtrado-early-legado-diagnostico'
    | 'agenda-sem-coordenadas-producao'
    | 'slot-espacial-inconsistente'
    | null
  origemOperacional: ReturnType<typeof resolverOrigemOperacionalV2>
  parseAgenda: ReturnType<typeof parsearPontosAgendaDoDiaV2> | null
  consistenciaEspacial: ConsistenciaEspacialSlotV2 | null
  matrizOSRM: Awaited<ReturnType<typeof prepararMatrizOSRMDiagnosticoV2>> | null
  deltaInsercao: ReturnType<typeof calcularDeltaInsercaoRotaComMatrizDiagnosticoV2> | ReturnType<typeof calcularDeltaInsercaoRotaDiagnosticoV2> | null
  ordenacaoRotaBase: DiagnosticoOrdenacaoRotaBase | null
  filtroEarlyLegado: FiltroEarlyLegadoDiagnostico | null
  avisos: string[]
  erros: string[]
  descartados: unknown[]
}

export type FiltroEarlyLegadoDiagnostico = {
  aplicado: boolean
  descartado: boolean
  motivo: 'sem-pontos' | 'config-ausente' | 'haversine-reta' | 'ancora-osrm-premium' | 'passou'
  nearestStraightKm: number | null
  limiteHaversineKm: number | null
  ancoraDistanciaKm: number | null
  limiteAncoraPremiumKm: number | null
  ancoraEndereco: string | null
  ancoraTitulo: string | null
  ancoraCep: string | null
}

function coordenadaValida(c: unknown): c is Coordenada {
  if (!c || typeof c !== 'object') return false
  const p = c as Record<string, unknown>
  return (
    typeof p.lat === 'number' &&
    Number.isFinite(p.lat) &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lng)
  )
}

function haversineMetros(a: Coordenada, b: Coordenada): number {
  return Math.round(haversineKm(a, b) * 1000)
}

function criarCalculadorComFallback(
  calcularOSRM: (de: Coordenada, para: Coordenada) => number | null,
  avisos: string[],
  marcarFallbackUsado: () => void
): (de: Coordenada, para: Coordenada) => number {
  return (de, para) => {
    const distanciaOSRM = calcularOSRM(de, para)
    if (distanciaOSRM !== null && Number.isFinite(distanciaOSRM) && distanciaOSRM >= 0) {
      return distanciaOSRM
    }
    marcarFallbackUsado()
    avisos.push('Distancia OSRM ausente/invalida para um par. Usando fallback Haversine conforme legado.')
    return haversineMetros(de, para)
  }
}

function kmValido(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

function avaliarFiltroEarlyLegado(input: {
  pontosAgenda: Array<{ loc: Coordenada; addr?: string; eventTitle?: string; cep?: string | null }>
  destino: Coordenada
  calcularDistanciaM: (de: Coordenada, para: Coordenada) => number
  kmMaxEntrePontosKm: number | null | undefined
  kmAdicionalMaxNaRotaPremiumM: number | null | undefined
}): FiltroEarlyLegadoDiagnostico {
  if (input.pontosAgenda.length === 0) {
    return {
      aplicado: false,
      descartado: false,
      motivo: 'sem-pontos',
      nearestStraightKm: null,
      limiteHaversineKm: null,
      ancoraDistanciaKm: null,
      limiteAncoraPremiumKm: null,
      ancoraEndereco: null,
      ancoraTitulo: null,
      ancoraCep: null,
    }
  }

  if (!kmValido(input.kmMaxEntrePontosKm) || !kmValido(input.kmAdicionalMaxNaRotaPremiumM)) {
    return {
      aplicado: false,
      descartado: false,
      motivo: 'config-ausente',
      nearestStraightKm: null,
      limiteHaversineKm: null,
      ancoraDistanciaKm: null,
      limiteAncoraPremiumKm: null,
      ancoraEndereco: null,
      ancoraTitulo: null,
      ancoraCep: null,
    }
  }

  let nearestStraightKm = Infinity
  for (const ponto of input.pontosAgenda) {
    const distKm = haversineKm(ponto.loc, input.destino)
    if (distKm < nearestStraightKm) nearestStraightKm = distKm
  }

  const limiteHaversineKm = input.kmMaxEntrePontosKm * 1.5
  if (nearestStraightKm > limiteHaversineKm) {
    return {
      aplicado: true,
      descartado: true,
      motivo: 'haversine-reta',
      nearestStraightKm,
      limiteHaversineKm,
      ancoraDistanciaKm: null,
      limiteAncoraPremiumKm: input.kmMaxEntrePontosKm + input.kmAdicionalMaxNaRotaPremiumM / 1000,
      ancoraEndereco: null,
      ancoraTitulo: null,
      ancoraCep: null,
    }
  }

  let ancora = input.pontosAgenda[0]
  let ancoraDistanciaM = input.calcularDistanciaM(ancora.loc, input.destino)
  for (let i = 1; i < input.pontosAgenda.length; i++) {
    const ponto = input.pontosAgenda[i]
    const distM = input.calcularDistanciaM(ponto.loc, input.destino)
    if (distM < ancoraDistanciaM) {
      ancora = ponto
      ancoraDistanciaM = distM
    }
  }

  const ancoraDistanciaKm = ancoraDistanciaM / 1000
  const limiteAncoraPremiumKm = input.kmMaxEntrePontosKm + input.kmAdicionalMaxNaRotaPremiumM / 1000
  const descartado = Boolean(ancora.cep) && ancoraDistanciaKm > limiteAncoraPremiumKm

  return {
    aplicado: true,
    descartado,
    motivo: descartado ? 'ancora-osrm-premium' : 'passou',
    nearestStraightKm,
    limiteHaversineKm,
    ancoraDistanciaKm,
    limiteAncoraPremiumKm,
    ancoraEndereco: ancora.addr ?? null,
    ancoraTitulo: ancora.eventTitle ?? null,
    ancoraCep: ancora.cep ?? null,
  }
}

export async function calcularKmAdicionalRealControladoV2(
  input: CalcularKmAdicionalRealControladoInput
): Promise<CalcularKmAdicionalRealControladoOutput> {
  const perf = input.medidorPerformance
  const avisos: string[] = [
    'Calculo real controlado executado apenas em diagnostico. Nao altera producao, frontend ou ranking final.',
  ]
  const erros: string[] = []

  const origemOperacional = perf?.medir('slot-origem-operacional', () => resolverOrigemOperacionalV2({
    dataISO: input.dataISO,
    equipe: input.equipe,
    config: input.configOrigem,
  })) ?? resolverOrigemOperacionalV2({
    dataISO: input.dataISO,
    equipe: input.equipe,
    config: input.configOrigem,
  })

  if (!origemOperacional.ok) {
    return {
      ok: false,
      modo: 'km-adicional-real-controlado-diagnostico',
      kmAdicionalNaRotaM: null,
      origemKmAdicionalNaRotaM: null,
      origemOperacional,
      parseAgenda: null,
      consistenciaEspacial: null,
      matrizOSRM: null,
      deltaInsercao: null,
      ordenacaoRotaBase: null,
      filtroEarlyLegado: null,
      avisos,
      erros: [origemOperacional.erro],
      descartados: [],
    }
  }

  if (!coordenadaValida(input.destino)) {
    return {
      ok: false,
      modo: 'km-adicional-real-controlado-diagnostico',
      kmAdicionalNaRotaM: null,
      origemKmAdicionalNaRotaM: null,
      origemOperacional,
      parseAgenda: null,
      consistenciaEspacial: null,
      matrizOSRM: null,
      deltaInsercao: null,
      ordenacaoRotaBase: null,
      filtroEarlyLegado: null,
      avisos,
      erros: ['Destino invalido: coordenadas ausentes ou nao numericas.'],
      descartados: [],
    }
  }

  const equipeNormalizada = origemOperacional.contexto.equipe
  const parseAgenda = perf?.medir('slot-parse-agenda', () => parsearPontosAgendaDoDiaV2({
    linhasAgenda: input.linhasAgenda,
    dataAlvoISO: input.dataISO,
    equipeAlvo: equipeNormalizada,
    cacheCoordenadasPorEndereco: input.cacheCoordenadasPorEndereco,
  })) ?? parsearPontosAgendaDoDiaV2({
    linhasAgenda: input.linhasAgenda,
    dataAlvoISO: input.dataISO,
    equipeAlvo: equipeNormalizada,
    cacheCoordenadasPorEndereco: input.cacheCoordenadasPorEndereco,
  })
  perf?.registrarEtapa('slot-parse-agenda-itens', 0, input.linhasAgenda.length)

  const pontosAgenda = parseAgenda.pontos.map((p) => ({
    loc: p.coordenadas,
    addr: p.endereco,
    eventTitle: p.tituloEvento ?? undefined,
    cep: p.cep,
    team: p.equipe,
    id: `agenda_${p.indiceLinhaOriginal}`,
  }))

  const consistenciaEspacial = perf?.medir('slot-consistencia-espacial', () => avaliarConsistenciaEspacialSlotV2({
    disponibilidade: input.disponibilidade,
    resumoAgenda: parseAgenda.resumo,
  })) ?? avaliarConsistenciaEspacialSlotV2({
    disponibilidade: input.disponibilidade,
    resumoAgenda: parseAgenda.resumo,
  })

  if (consistenciaEspacial.bloqueado) {
    avisos.push(
      `Slot bloqueado por inconsistência espacial (${consistenciaEspacial.estado}): ${consistenciaEspacial.motivo}`
    )
    return {
      ok: true,
      modo: 'km-adicional-real-controlado-diagnostico',
      kmAdicionalNaRotaM: null,
      origemKmAdicionalNaRotaM:
        consistenciaEspacial.estado === 'agenda-sem-coordenadas'
          ? 'agenda-sem-coordenadas-producao'
          : 'slot-espacial-inconsistente',
      origemOperacional,
      parseAgenda,
      consistenciaEspacial,
      matrizOSRM: null,
      deltaInsercao: null,
      ordenacaoRotaBase: null,
      filtroEarlyLegado: null,
      avisos: [...avisos, ...parseAgenda.avisos],
      erros,
      descartados: [...parseAgenda.descartados],
    }
  }

  const origem = {
    ...origemOperacional.origem,
    descricao: origemOperacional.tipo,
    id: 'origem',
  }
  const destino = {
    ...input.destino,
    id: 'destino',
  }

  const pontosOSRM: PontoRotaOSRM[] = [
    { id: origem.id, lat: origem.lat, lng: origem.lng, descricao: origem.descricao },
    { id: destino.id, lat: destino.lat, lng: destino.lng, descricao: destino.descricao ?? 'destino' },
    ...pontosAgenda.map((p) => ({
      id: p.id,
      lat: p.loc.lat,
      lng: p.loc.lng,
      descricao: p.eventTitle ?? p.addr ?? p.id,
    })),
  ]

  let matrizOSRM: Awaited<ReturnType<typeof prepararMatrizOSRMDiagnosticoV2>> | null = null
  let deltaInsercao: CalcularKmAdicionalRealControladoOutput['deltaInsercao'] = null
  let origemKmAdicionalNaRotaM: CalcularKmAdicionalRealControladoOutput['origemKmAdicionalNaRotaM'] = null
  let ordenacaoRotaBase: DiagnosticoOrdenacaoRotaBase | null = null
  let filtroEarlyLegado: FiltroEarlyLegadoDiagnostico | null = null
  let fallbackHaversineUsado = false

  try {
    matrizOSRM = await prepararMatrizOSRMDiagnosticoV2({
      pontos: pontosOSRM,
      buscarMatrizOSRM: input.buscarMatrizOSRM,
      modo: 'osrm-mockavel-diagnostico',
    })

    if (matrizOSRM.ok) {
      const calcularPorMatriz = criarCalculadorDistanciaPorCoordenadas(
        matrizOSRM.matrizMetros,
        pontosOSRM
      )
      const calcularDistanciaM = criarCalculadorComFallback(calcularPorMatriz, avisos, () => {
        fallbackHaversineUsado = true
      })
      filtroEarlyLegado = perf?.medir('slot-filtro-early', () => avaliarFiltroEarlyLegado({
        pontosAgenda,
        destino,
        calcularDistanciaM,
        kmMaxEntrePontosKm: input.configFiltroEarlyLegado?.kmMaxEntrePontosKm,
        kmAdicionalMaxNaRotaPremiumM: input.configFiltroEarlyLegado?.kmAdicionalMaxNaRotaPremiumM,
      })) ?? avaliarFiltroEarlyLegado({
        pontosAgenda,
        destino,
        calcularDistanciaM,
        kmMaxEntrePontosKm: input.configFiltroEarlyLegado?.kmMaxEntrePontosKm,
        kmAdicionalMaxNaRotaPremiumM: input.configFiltroEarlyLegado?.kmAdicionalMaxNaRotaPremiumM,
      })
      if (filtroEarlyLegado.descartado) {
        avisos.push(
          `Slot descartado por filtro early legado (${filtroEarlyLegado.motivo}).`
        )
        return {
          ok: true,
          modo: 'km-adicional-real-controlado-diagnostico',
          kmAdicionalNaRotaM: null,
          origemKmAdicionalNaRotaM: 'filtrado-early-legado-diagnostico',
          origemOperacional,
          parseAgenda,
          consistenciaEspacial,
          matrizOSRM,
          deltaInsercao: null,
          ordenacaoRotaBase: null,
          filtroEarlyLegado,
          avisos: [...avisos, ...parseAgenda.avisos],
          erros,
          descartados: [...parseAgenda.descartados],
        }
      }
      const ordenacao = otimizarRotaBaseLegado({
        origem,
        pontos: pontosAgenda,
        calcularDistanciaM,
      })
      ordenacaoRotaBase = {
        ordemOriginal: ordenacao.ordemOriginal,
        ordemOtimizada: ordenacao.ordemOtimizada,
        criterioOrdenacao: ordenacao.criterioOrdenacao,
        twoOptExecutado: ordenacao.twoOptExecutado,
        twoOptAplicado: ordenacao.twoOptAplicado,
      }

      deltaInsercao = perf?.medir('slot-delta-insercao', () => calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem,
        destino,
        pontosAgenda: ordenacao.pontosOrdenados,
        calcularDistanciaM,
        modo: 'matriz-distancia-diagnostico',
        incluirDetalhes: input.incluirDetalhesInsercao,
      })) ?? calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem,
        destino,
        pontosAgenda: ordenacao.pontosOrdenados,
        calcularDistanciaM,
        modo: 'matriz-distancia-diagnostico',
        incluirDetalhes: input.incluirDetalhesInsercao,
      })

      if (deltaInsercao.ok) {
        origemKmAdicionalNaRotaM = fallbackHaversineUsado
          ? 'haversine-fallback-legado-diagnostico'
          : 'osrm-table-diagnostico'
      } else {
        avisos.push('Delta OSRM falhou. Usando fallback Haversine para o calculo completo conforme legado.')
      }
    } else {
      avisos.push('Matriz OSRM falhou. Usando fallback Haversine para o calculo completo conforme legado.')
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    avisos.push(`Erro OSRM controlado: ${msg}. Usando fallback Haversine conforme legado.`)
  }

  if (!deltaInsercao?.ok) {
    const ordenacao = otimizarRotaBaseLegado({
      origem,
      pontos: pontosAgenda,
      calcularDistanciaM: haversineMetros,
    })
    ordenacaoRotaBase = {
      ordemOriginal: ordenacao.ordemOriginal,
      ordemOtimizada: ordenacao.ordemOtimizada,
      criterioOrdenacao: ordenacao.criterioOrdenacao,
      twoOptExecutado: ordenacao.twoOptExecutado,
      twoOptAplicado: ordenacao.twoOptAplicado,
    }
    const fallback = perf?.medir('slot-delta-insercao', () => calcularDeltaInsercaoRotaDiagnosticoV2({
      origem,
      destino,
      pontosAgenda: ordenacao.pontosOrdenados,
      modo: 'haversine-diagnostico',
      incluirDetalhes: input.incluirDetalhesInsercao,
    })) ?? calcularDeltaInsercaoRotaDiagnosticoV2({
      origem,
      destino,
      pontosAgenda: ordenacao.pontosOrdenados,
      modo: 'haversine-diagnostico',
      incluirDetalhes: input.incluirDetalhesInsercao,
    })
    deltaInsercao = fallback
    origemKmAdicionalNaRotaM = fallback.ok ? 'haversine-fallback-legado-diagnostico' : null
  }

  if (!deltaInsercao.ok) {
    erros.push(...deltaInsercao.avisos)
  }

  return {
    ok: deltaInsercao.ok,
    modo: 'km-adicional-real-controlado-diagnostico',
    kmAdicionalNaRotaM: deltaInsercao.kmAdicionalNaRotaM,
    origemKmAdicionalNaRotaM,
    origemOperacional,
    parseAgenda,
    consistenciaEspacial,
    matrizOSRM,
    deltaInsercao,
    ordenacaoRotaBase,
    filtroEarlyLegado,
    avisos: [...avisos, ...parseAgenda.avisos, ...deltaInsercao.avisos],
    erros,
    descartados: [
      ...parseAgenda.descartados,
      ...('descartados' in deltaInsercao ? deltaInsercao.descartados : []),
    ],
  }
}
