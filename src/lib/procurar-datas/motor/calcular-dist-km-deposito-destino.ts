import type { ConfigNormalizada } from '../config-service'
import type { Coordenada } from './distancia'
import type { ResultadoRotaOSRM } from './osrm-route-client-diagnostico'

export type BuscarRotaDepositoDestino = (
  de: Coordenada,
  para: Coordenada
) => Promise<ResultadoRotaOSRM>

export type ConfigDepositoDestino = Pick<ConfigNormalizada, 'latDeposito' | 'lngDeposito'>

export interface CalcularDistKmDepositoDestinoInput {
  config: ConfigDepositoDestino
  destino: Coordenada
  buscarRota: BuscarRotaDepositoDestino
}

export interface DistKmDepositoDestinoResultado {
  ok: boolean
  distKm: number | null
  distM: number | null
  origem: Coordenada | null
  destino: Coordenada | null
  origemDistancia: 'osrm-route-deposito-destino' | null
  avisos: string[]
  erros: string[]
}

function coordenadaValida(coord: Coordenada): boolean {
  return Number.isFinite(coord.lat) && Number.isFinite(coord.lng)
}

export async function calcularDistKmDepositoDestino(
  input: CalcularDistKmDepositoDestinoInput
): Promise<DistKmDepositoDestinoResultado> {
  const origem: Coordenada = {
    lat: input.config.latDeposito,
    lng: input.config.lngDeposito,
  }

  const base: DistKmDepositoDestinoResultado = {
    ok: false,
    distKm: null,
    distM: null,
    origem: null,
    destino: null,
    origemDistancia: null,
    avisos: [],
    erros: [],
  }

  if (!coordenadaValida(origem)) {
    return {
      ...base,
      erros: [
        `Coordenadas do deposito invalidas (latDeposito=${input.config.latDeposito}, lngDeposito=${input.config.lngDeposito}).`,
      ],
    }
  }

  if (!coordenadaValida(input.destino)) {
    return {
      ...base,
      origem,
      erros: [
        `Coordenadas do destino invalidas (lat=${input.destino.lat}, lng=${input.destino.lng}).`,
      ],
    }
  }

  const rota = await input.buscarRota(origem, input.destino)
  if (!rota.ok || rota.distanciaM == null || !Number.isFinite(rota.distanciaM) || rota.distanciaM < 0) {
    return {
      ...base,
      origem,
      destino: input.destino,
      erros: [rota.erro ?? 'Distancia OSRM deposito -> destino indisponivel.'],
    }
  }

  const distM = Math.round(rota.distanciaM)

  return {
    ok: true,
    distKm: distM / 1000,
    distM,
    origem,
    destino: input.destino,
    origemDistancia: 'osrm-route-deposito-destino',
    avisos: [],
    erros: [],
  }
}
