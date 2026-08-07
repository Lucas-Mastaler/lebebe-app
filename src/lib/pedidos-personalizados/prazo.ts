import type { StatusPedidoPersonalizado } from './tipos'

export type SituacaoPrazoPedido = 'NO PRAZO' | 'PRESTES A VENCER' | 'ATRASADO'

const STATUS_FINAIS = new Set<StatusPedidoPersonalizado>(['RECEBIDO', 'CANCELADO'])

function diaUtc(dataIso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso)
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function dataOperacionalBrasil(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora)
}

export function classificarSituacaoPrazo(
  dataEntrega: string | null,
  status: StatusPedidoPersonalizado,
  hojeIso = dataOperacionalBrasil()
): SituacaoPrazoPedido | null {
  if (!dataEntrega || STATUS_FINAIS.has(status)) return null
  const entrega = diaUtc(dataEntrega)
  const hoje = diaUtc(hojeIso)
  if (entrega === null || hoje === null) return null
  const dias = Math.round((entrega - hoje) / 86_400_000)
  if (dias < 0) return 'ATRASADO'
  if (dias <= 7) return 'PRESTES A VENCER'
  return 'NO PRAZO'
}

export function adicionarDiasIso(dataIso: string, dias: number) {
  const base = diaUtc(dataIso)
  if (base === null) throw new Error('DATA_ISO_INVALIDA')
  return new Date(base + dias * 86_400_000).toISOString().slice(0, 10)
}
