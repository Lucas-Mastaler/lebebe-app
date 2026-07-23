import { calcularKmAdicionalRealControladoV2 } from './calcular-km-adicional-real-controlado'
import type {
  CalcularKmAdicionalRealControladoInput,
  CalcularKmAdicionalRealControladoOutput,
} from './calcular-km-adicional-real-controlado'
import { normalizarEquipe } from './equipe'

export type SlotInputMapaKmAdicional = {
  dataISO: string
  equipe: string
  linhasAgenda: CalcularKmAdicionalRealControladoInput['linhasAgenda']
  disponibilidade?: CalcularKmAdicionalRealControladoInput['disponibilidade']
  cacheCoordenadasPorEndereco?: CalcularKmAdicionalRealControladoInput['cacheCoordenadasPorEndereco']
}

export type DetalheSlotMapaKmAdicional = {
  chave: string
  dataISO: string
  equipe: string
  equipeNormalizada: string
  kmAdicionalNaRotaM: number | null
  ok: boolean
  origemKmAdicionalNaRotaM: CalcularKmAdicionalRealControladoOutput['origemKmAdicionalNaRotaM']
  avisos: string[]
  erros: string[]
  descartados: unknown[]
  /** Resultado do parse dos pontos da agenda para diagnosticar aceites/descartes do slot. */
  parseAgenda?: CalcularKmAdicionalRealControladoOutput['parseAgenda']
  /** Decisão fail-closed que distingue dia vazio de agenda espacialmente incompleta. */
  consistenciaEspacial?: CalcularKmAdicionalRealControladoOutput['consistenciaEspacial']
  /** Matriz OSRM preparada para o slot, quando executada. */
  matrizOSRM?: CalcularKmAdicionalRealControladoOutput['matrizOSRM']
  /** Detalhes do delta de insercao (inclui candidatosInsercao e pontosRotaBase quando incluirDetalhesInsercao=true). */
  deltaInsercao?: CalcularKmAdicionalRealControladoOutput['deltaInsercao']
  /** Origem operacional usada (deposito ou casa da equipe). */
  origemOperacional?: CalcularKmAdicionalRealControladoOutput['origemOperacional']
  /** Ordem crua e ordem otimizada da rota base, equivalente ao rotaOtimizada do legado. */
  ordenacaoRotaBase?: CalcularKmAdicionalRealControladoOutput['ordenacaoRotaBase']
  /** Filtro early legado por Haversine/ancora, quando aplicavel. */
  filtroEarlyLegado?: CalcularKmAdicionalRealControladoOutput['filtroEarlyLegado']
}

export type CalcularMapaKmAdicionalPorSlotInput = {
  slots: SlotInputMapaKmAdicional[]
  destino: CalcularKmAdicionalRealControladoInput['destino']
  configOrigem: CalcularKmAdicionalRealControladoInput['configOrigem']
  configFiltroEarlyLegado?: CalcularKmAdicionalRealControladoInput['configFiltroEarlyLegado']
  buscarMatrizOSRM: CalcularKmAdicionalRealControladoInput['buscarMatrizOSRM']
  /** Se true, retorna candidatosInsercao e pontosRotaBase no detalhe de cada slot. */
  incluirDetalhesInsercao?: boolean
}

export type CalcularMapaKmAdicionalPorSlotOutput = {
  ok: boolean
  modo: 'mapa-km-adicional-por-slot-diagnostico'
  mapa: Record<string, number | null>
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
  contadores: {
    slotsRecebidos: number
    slotsProcessados: number
    slotsComKm: number
    slotsComFallbackHaversine: number
    slotsComErro: number
    slotsDescartados: number
    slotsBloqueadosInconsistenciaEspacial: number
  }
  avisos: string[]
  erros: string[]
}

function chaveSlot(dataISO: string, equipeNormalizada: string): string {
  return `${dataISO}::${equipeNormalizada}`
}

export async function calcularMapaKmAdicionalPorSlotControladoV2(
  input: CalcularMapaKmAdicionalPorSlotInput
): Promise<CalcularMapaKmAdicionalPorSlotOutput> {
  const avisosSaida: string[] = [
    'Mapa de kmAdicionalNaRotaM por slot calculado apenas em diagnostico. Nao altera producao, frontend ou ranking final.',
  ]
  const errosSaida: string[] = []

  if (!Array.isArray(input.slots) || input.slots.length === 0) {
    avisosSaida.push('Nenhum slot recebido. Mapa vazio retornado.')
    return {
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: {},
      detalhesPorSlot: [],
      contadores: {
        slotsRecebidos: 0,
        slotsProcessados: 0,
        slotsComKm: 0,
        slotsComFallbackHaversine: 0,
        slotsComErro: 0,
        slotsDescartados: 0,
        slotsBloqueadosInconsistenciaEspacial: 0,
      },
      avisos: avisosSaida,
      erros: errosSaida,
    }
  }

  const mapa: Record<string, number | null> = {}
  const detalhesPorSlot: DetalheSlotMapaKmAdicional[] = []

  let slotsProcessados = 0
  let slotsComKm = 0
  let slotsComFallbackHaversine = 0
  let slotsComErro = 0
  let slotsDescartados = 0
  let slotsBloqueadosInconsistenciaEspacial = 0

  for (const slot of input.slots) {
    const dataISO = typeof slot.dataISO === 'string' ? slot.dataISO.trim() : ''
    const equipeRaw = typeof slot.equipe === 'string' ? slot.equipe.trim() : ''
    const equipeNormalizada = normalizarEquipe(equipeRaw) ?? ''

    if (!dataISO || !equipeNormalizada) {
      slotsDescartados++
      errosSaida.push(
        `Slot descartado: dataISO="${dataISO}" equipe="${equipeRaw}" — dataISO ou equipe invalidos.`
      )
      continue
    }

    const chave = chaveSlot(dataISO, equipeNormalizada)

    slotsProcessados++

    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO,
      equipe: equipeRaw,
      configOrigem: input.configOrigem,
      configFiltroEarlyLegado: input.configFiltroEarlyLegado,
      destino: input.destino,
      linhasAgenda: slot.linhasAgenda ?? [],
      disponibilidade: slot.disponibilidade,
      cacheCoordenadasPorEndereco: slot.cacheCoordenadasPorEndereco ?? {},
      buscarMatrizOSRM: input.buscarMatrizOSRM,
      incluirDetalhesInsercao: input.incluirDetalhesInsercao,
    })

    mapa[chave] = resultado.kmAdicionalNaRotaM

    if (resultado.ok && resultado.kmAdicionalNaRotaM !== null) {
      slotsComKm++
    } else if (resultado.origemKmAdicionalNaRotaM === 'filtrado-early-legado-diagnostico') {
      slotsDescartados++
    } else if (resultado.consistenciaEspacial?.bloqueado) {
      // Bloqueio esperado de segurança: não é falha técnica do cálculo.
    } else {
      slotsComErro++
    }

    if (resultado.origemKmAdicionalNaRotaM === 'haversine-fallback-legado-diagnostico') {
      slotsComFallbackHaversine++
    }
    if (resultado.consistenciaEspacial?.bloqueado) {
      slotsBloqueadosInconsistenciaEspacial++
    }

    detalhesPorSlot.push({
      chave,
      dataISO,
      equipe: equipeRaw,
      equipeNormalizada,
      kmAdicionalNaRotaM: resultado.kmAdicionalNaRotaM,
      ok: resultado.ok,
      origemKmAdicionalNaRotaM: resultado.origemKmAdicionalNaRotaM,
      avisos: resultado.avisos,
      erros: resultado.erros,
      descartados: resultado.descartados,
      parseAgenda: resultado.parseAgenda,
      consistenciaEspacial: resultado.consistenciaEspacial,
      matrizOSRM: resultado.matrizOSRM,
      deltaInsercao: resultado.deltaInsercao,
      origemOperacional: resultado.origemOperacional,
      ordenacaoRotaBase: resultado.ordenacaoRotaBase,
      filtroEarlyLegado: resultado.filtroEarlyLegado,
    })
  }

  const okGlobal = slotsDescartados === 0 && errosSaida.length === 0

  return {
    ok: okGlobal,
    modo: 'mapa-km-adicional-por-slot-diagnostico',
    mapa,
    detalhesPorSlot,
    contadores: {
      slotsRecebidos: input.slots.length,
      slotsProcessados,
      slotsComKm,
      slotsComFallbackHaversine,
      slotsComErro,
      slotsDescartados,
      slotsBloqueadosInconsistenciaEspacial,
    },
    avisos: avisosSaida,
    erros: errosSaida,
  }
}
