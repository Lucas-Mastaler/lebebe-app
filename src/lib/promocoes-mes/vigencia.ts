import { dataOperacionalBrasil } from '@/lib/pedidos-personalizados/prazo'

export type SituacaoPromocao = 'VIGENTE' | 'FUTURA' | 'ENCERRADA'

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

export function dataIsoValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !DATA_ISO.test(valor)) return false
  const [ano, mes, dia] = valor.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}

/** Início e fim inclusivos; datas ISO (YYYY-MM-DD) comparam lexicograficamente. */
export function classificarVigencia(inicio: string, fim: string, hoje: string): SituacaoPromocao {
  if (hoje < inicio) return 'FUTURA'
  if (hoje > fim) return 'ENCERRADA'
  return 'VIGENTE'
}

export function hojeOperacional(agora = new Date()) {
  return dataOperacionalBrasil(agora)
}
