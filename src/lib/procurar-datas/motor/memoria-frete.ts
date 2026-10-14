import type { Coordenada } from './distancia'
import type { EtapaCalculoFrete } from './frete'
import type { FreteInput, FreteOutput } from './types'

export interface MemoriaFreteCandidatoV1 {
  dataISO: string
  equipe: string
  tipo: string
  entrada: FreteInput
  etapas: EtapaCalculoFrete[]
  resultado: FreteOutput
  freteApresentado?: string
}

/** Captura passiva do mesmo cálculo que gerou o preço, sem consulta posterior à configuração. */
export interface MemoriaFretePesquisaV1 {
  versao: 1
  formula: 'legado-frete-v1'
  origemGeografica: 'deposito'
  origem: Coordenada
  destino: Coordenada
  distKm: number
  distM: number
  fonteDistancia: 'osrm-route-deposito-destino'
  valorInicialInformado: number | null
  valorInicialAplicadoComoPiso: false
  encomendaInformada: boolean
  encomendaInfluenciaPreco: false
  candidatos: MemoriaFreteCandidatoV1[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isCoord = (value: unknown): boolean => isRecord(value) && isNumber(value.lat) && isNumber(value.lng)

/** Registros antigos ou versões desconhecidas continuam sem memória; nunca reconstruir com parâmetros atuais. */
export function lerMemoriaFretePesquisa(value: unknown): MemoriaFretePesquisaV1 | null {
  if (!isRecord(value) || value.versao !== 1 || value.formula !== 'legado-frete-v1' ||
    value.origemGeografica !== 'deposito' || value.fonteDistancia !== 'osrm-route-deposito-destino' ||
    !isCoord(value.origem) || !isCoord(value.destino) || !isNumber(value.distKm) || value.distKm < 0 ||
    !isNumber(value.distM) || value.distM < 0 || value.distM / 1000 !== value.distKm ||
    !(value.valorInicialInformado === null || isNumber(value.valorInicialInformado)) ||
    value.valorInicialAplicadoComoPiso !== false || typeof value.encomendaInformada !== 'boolean' ||
    value.encomendaInfluenciaPreco !== false || !Array.isArray(value.candidatos) || value.candidatos.length === 0) return null

  const parametros = ['kmMaxViagem', 'kmMaxValorFixo', 'kmMaxLongaCidade', 'kmMaxNaoViagem',
    'valorSemanaAte10km', 'valorSabadoAte10km', 'fatorMultiplicadorKmViagem', 'multiplicadorKmNaoViagem',
    'valorDiaApos25kmSemana', 'valorDiaApos25kmSabado', 'precoCondominioAdicional']
  for (const candidato of value.candidatos) {
    if (!isRecord(candidato) || typeof candidato.dataISO !== 'string' || typeof candidato.equipe !== 'string' ||
      typeof candidato.tipo !== 'string' || !isRecord(candidato.entrada) || !isRecord(candidato.resultado) ||
      !Array.isArray(candidato.etapas) || typeof candidato.freteApresentado !== 'string') return null
    const entrada = candidato.entrada
    const params = entrada.params
    if (!isNumber(entrada.distKm) || entrada.distKm !== value.distKm ||
      typeof entrada.isSabado !== 'boolean' || typeof entrada.isRural !== 'boolean' || typeof entrada.isCondominio !== 'boolean' ||
      typeof entrada.tipo !== 'string' || !['normal', 'especial', 'premium', 'hora-marcada'].includes(entrada.tipo) || !isRecord(params) || !parametros.every((key) => isNumber(params[key])) ||
      !['valorAdicionalEspecial', 'valorAdicionalPremium', 'horaMarcadaValorAdicional'].every((key) => isNumber(entrada[key]))) return null
    if (typeof candidato.resultado.ok !== 'boolean' || !isNumber(candidato.resultado.valorFrete) ||
      typeof candidato.resultado.valorFormatado !== 'string' || typeof candidato.resultado.faixaAplicada !== 'string' || !['fixo', 'viagem', 'longa', 'naoViagem', 'recusado'].includes(candidato.resultado.faixaAplicada) ||
      candidato.resultado.tipo !== entrada.tipo || candidato.tipo !== entrada.tipo ||
      !candidato.etapas.every((etapa) => isRecord(etapa) && typeof etapa.descricao === 'string' &&
        typeof etapa.operacao === 'string' && isNumber(etapa.valor))) return null
    if (candidato.resultado.ok && candidato.etapas.at(-1)?.valor !== candidato.resultado.valorFrete) return null
  }
  return value as unknown as MemoriaFretePesquisaV1
}
