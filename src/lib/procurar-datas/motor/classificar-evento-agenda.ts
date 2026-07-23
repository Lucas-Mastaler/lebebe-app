import { parseMinutos } from './tempo'

export type NaturezaEventoAgendaV2 =
  | 'servico-espacial'
  | 'operacional-nao-espacial'
  | 'restricao-sem-rota'
  | 'desconhecido'

export type ClassificacaoEventoAgendaV2 = {
  natureza: NaturezaEventoAgendaV2
  motivo: string
  duracaoMin: number | null
  consomeDisponibilidade: boolean
  requerEndereco: boolean
  entraNaRota: boolean
  permiteRotaSimplesSemOutrosPontos: boolean
}

function normalizarTextoComparacao(input: unknown): string {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function contemPalavraIsoladaCarregamento(titulo: unknown): boolean {
  const normalizado = normalizarTextoComparacao(titulo)
  return /(^|[^A-Z0-9])CARREGAMENTO([^A-Z0-9]|$)/.test(normalizado)
}

function parsearDuracaoOficialMin(input: unknown): number | null {
  if (input === null || input === undefined || String(input).trim() === '') return null

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null
    const minutos = input.getUTCHours() * 60 + input.getUTCMinutes()
    return minutos
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null
    return parseMinutos(input)
  }

  if (typeof input === 'string') {
    const texto = input.trim()
    if (!/^\d{1,2}:\d{2}$/.test(texto)) return null
    return parseMinutos(texto)
  }

  return null
}

export function classificarEventoAgendaV2(input: {
  titulo: unknown
  duracaoOficial: unknown
  temEndereco: boolean
}): ClassificacaoEventoAgendaV2 {
  const duracaoMin = parsearDuracaoOficialMin(input.duracaoOficial)

  if (input.temEndereco) {
    return {
      natureza: 'servico-espacial',
      motivo: 'endereco-presente',
      duracaoMin,
      consomeDisponibilidade: true,
      requerEndereco: true,
      entraNaRota: true,
      permiteRotaSimplesSemOutrosPontos: false,
    }
  }

  if (
    contemPalavraIsoladaCarregamento(input.titulo) &&
    duracaoMin !== null &&
    duracaoMin > 0 &&
    duracaoMin <= 60
  ) {
    return {
      natureza: 'operacional-nao-espacial',
      motivo: 'carregamento-reconhecido',
      duracaoMin,
      consomeDisponibilidade: true,
      requerEndereco: false,
      entraNaRota: false,
      permiteRotaSimplesSemOutrosPontos: true,
    }
  }

  return {
    natureza: 'desconhecido',
    motivo: contemPalavraIsoladaCarregamento(input.titulo)
      ? 'carregamento-com-duracao-oficial-invalida'
      : 'evento-sem-endereco-nao-classificado',
    duracaoMin,
    consomeDisponibilidade: duracaoMin !== null && duracaoMin > 0,
    requerEndereco: true,
    entraNaRota: false,
    permiteRotaSimplesSemOutrosPontos: false,
  }
}
