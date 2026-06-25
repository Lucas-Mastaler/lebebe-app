export type TempoServicoInput = {
  berco?: string | null
  comoda?: string | null
  roupeiro?: string | null
  poltrona?: string | null
  painel?: string | null
}

const BASE = {
  BERCO_DIVERSOS: 40,
  BERCO_2DIVERSOS: 75,
  BERCO_NIDO: 40,
  BERCO_FORMARE: 90,
  BERCO_MAXX: 75,
  BERCO_CAMA: 40,
  BERCO_CAMA_C_AUXILIAR: 60,
  BERCO_DIVERSOS_CAMA: 75,
  BERCO_NIDO_CAMA: 75,
  BERCO_FORMARE_CAMA: 105,
  BERCO_MAXX_CAMA: 90,
  COMODA_1: 50,
  COMODA_2: 105,
  ROUPEIRO_23: 100,
  ROUPEIRO_4: 120,
  ROUPEIRO_TUTTO_4PTS: 150,
  ROUPEIRO_PROVENCE_FLOW: 135,
  ROUPEIRO_DESLIZANTE_TUTTO: 135,
  POLTRONA_1: 30,
  POLTRONA_2_SOLO: 45,
  POLTRONA_2_ADD: 15,
  PAINEL_1: 120,
  PAINEL_2: 210,
} as const

type RoupeiroTipo = '' | '23' | '4' | 'TUTTO_4PTS' | 'PROVENCE_FLOW' | 'DESLIZANTE_TUTTO'

export function normalizarOpcaoTempoServico(valor: string | null | undefined): string {
  const bruto = String(valor ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
  if (!bruto || bruto === 'NÃO' || bruto === 'NAO' || bruto === 'NÃƒO' || bruto === 'SELECIONE') return ''

  const texto = String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')

  if (!texto || texto === 'NAO' || texto === 'NA\u0191O' || texto === 'SELECIONE') return ''
  return texto
}

function roupeiroTipo(roupeiro: string): RoupeiroTipo {
  if (!roupeiro) return ''

  if (/4 PTS\s*\(TUTTO\)/.test(roupeiro)) return 'TUTTO_4PTS'
  if (/DESLIZANTE/.test(roupeiro) && /TUTTO/.test(roupeiro)) return 'DESLIZANTE_TUTTO'
  if (/PROVENCE\/FLOW/.test(roupeiro) || /PROVENCE/.test(roupeiro)) return 'PROVENCE_FLOW'
  if (/4 PTS/.test(roupeiro) || /DESLIZANTE/.test(roupeiro)) return '4'
  if (/2 PTS|3 PTS/.test(roupeiro)) return '23'

  return ''
}

function painelMinutos(painel: string): number {
  if (!painel) return 0

  let modulos = Number(/\b(\d)\s*MODULO/.exec(painel)?.[1] || 0)
  if (/2 MODULOS/.test(painel)) modulos = 2
  if (/1 MODULO/.test(painel)) modulos = 1

  const base = /2 PAINEIS/.test(painel) ? BASE.PAINEL_2 : BASE.PAINEL_1
  return base + modulos * 30
}

function bercoMinutos(berco: string, inCombo: boolean): number {
  if (!berco) return 0

  if (berco === 'DIVERSOS') return BASE.BERCO_DIVERSOS
  if (berco === '2 DIVERSOS' || berco === '2 BERCOS DIVERSOS') return BASE.BERCO_2DIVERSOS
  if (berco === '2 CAMAS') return BASE.BERCO_2DIVERSOS
  if (berco === 'NIDO') return BASE.BERCO_NIDO
  if (berco === 'FORMARE') return BASE.BERCO_FORMARE
  if (berco === 'MAXX') return BASE.BERCO_MAXX
  if (berco === 'CAMA') return BASE.BERCO_CAMA
  if (berco === 'CAMA + C. AUXILIAR') return BASE.BERCO_CAMA_C_AUXILIAR
  if (berco === 'DIVERSOS E CAMA') return inCombo ? 75 : BASE.BERCO_DIVERSOS_CAMA
  if (berco === 'NIDO E CAMA') return inCombo ? 75 : BASE.BERCO_NIDO_CAMA
  if (berco === 'FORMARE E CAMA') return inCombo ? 120 : BASE.BERCO_FORMARE_CAMA
  if (berco === 'MAXX E CAMA') return inCombo ? 105 : BASE.BERCO_MAXX_CAMA

  return 0
}

function roupeiroMinutos(tipo: RoupeiroTipo): number {
  if (tipo === '23') return BASE.ROUPEIRO_23
  if (tipo === '4') return BASE.ROUPEIRO_4
  if (tipo === 'TUTTO_4PTS') return BASE.ROUPEIRO_TUTTO_4PTS
  if (tipo === 'DESLIZANTE_TUTTO') return BASE.ROUPEIRO_DESLIZANTE_TUTTO
  if (tipo === 'PROVENCE_FLOW') return BASE.ROUPEIRO_PROVENCE_FLOW
  return 0
}

export function calcularTempoServicoMinutos(input: TempoServicoInput): number {
  const berco = normalizarOpcaoTempoServico(input.berco)
  const comoda = normalizarOpcaoTempoServico(input.comoda)
  const roupeiro = normalizarOpcaoTempoServico(input.roupeiro)
  const poltrona = normalizarOpcaoTempoServico(input.poltrona)
  const painel = normalizarOpcaoTempoServico(input.painel)

  const tipoRoupeiro = roupeiroTipo(roupeiro)
  const hasBerco = berco !== ''
  const hasComoda = comoda !== ''
  const hasRoupeiro = tipoRoupeiro !== ''
  const hasPainel = painel !== ''
  const mainCount = (hasBerco ? 1 : 0) + (hasComoda ? 1 : 0) + (hasRoupeiro ? 1 : 0)

  let min = painelMinutos(painel) + bercoMinutos(berco, hasComoda || hasRoupeiro)
  min += comoda === 'SIM' ? BASE.COMODA_1 : comoda === '2 COMODAS' ? BASE.COMODA_2 : 0

  let roupeiroMin = roupeiroMinutos(tipoRoupeiro)
  const bercoFormareOuMaxx = berco === 'FORMARE' || berco === 'MAXX'
  const roupeiroTuttoOuProvence =
    tipoRoupeiro === 'TUTTO_4PTS' ||
    tipoRoupeiro === 'DESLIZANTE_TUTTO' ||
    tipoRoupeiro === 'PROVENCE_FLOW'

  if (mainCount === 3 && tipoRoupeiro) {
    const deveSomar = !(bercoFormareOuMaxx && hasComoda && roupeiroTuttoOuProvence)
    if (deveSomar) {
      // Equivalencia com Apps Script gerarTempoServiCalcula: o comentario legado fala +15, mas o codigo real soma +30.
      roupeiroMin += 30
    }
  }

  min += roupeiroMin

  if (poltrona === 'SIM' && !hasBerco && !hasComoda && !hasRoupeiro && !hasPainel) {
    min += BASE.POLTRONA_1
  }

  if (poltrona === '2 POLTRONAS') {
    min += !hasBerco && !hasComoda && !hasRoupeiro && !hasPainel ? BASE.POLTRONA_2_SOLO : BASE.POLTRONA_2_ADD
  }

  const bercoForm = /^FORMARE/.test(berco) || /^MAXX/.test(berco)
  let desconto = 0

  if (mainCount === 2) {
    if (hasBerco && hasComoda) {
      desconto = bercoForm || berco.startsWith('2') || comoda === '2 COMODAS' ? 30 : 15
    } else if (hasRoupeiro && (hasBerco || hasComoda)) {
      desconto = tipoRoupeiro === '23' ? 45 : 30
    }
  }

  if (mainCount === 3) {
    desconto = tipoRoupeiro === '23' ? (bercoForm ? 90 : 75) : bercoForm ? 75 : 60
  }

  return Math.max(0, min - desconto)
}

export function formatarMinutosParaHHMM(minutos: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(minutos) ? minutos : 0))
  const horas = Math.floor(total / 60)
  const mins = total % 60
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}
