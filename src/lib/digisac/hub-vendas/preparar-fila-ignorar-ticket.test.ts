import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/digisac/clienteDigisac', () => ({
  fetchDigisac: vi.fn(),
}))

const { fetchDigisac } = await import('@/lib/digisac/clienteDigisac')
const { analisarReconciliacaoLead } = await import('./preparar-fila')

const HAUER_SERVICE = '1352c41b-80a9-4e74-b9d9-4c5e7aed060e'
const ENTRADA = '2026-09-19T13:00:00.000Z'
const AGORA = new Date('2026-09-19T14:28:00.000Z')

const lead = {
  id: 'lead-1',
  telefone_normalizado_ddi: '5541999999161',
  data_entrada_hub: ENTRADA,
  status: 'encaminhado_recuperacao',
}

function ticketNaLoja(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    isOpen: true,
    startedAt: '2026-09-19T14:18:03.754Z', // dentro da janela de conversao de 24h apos a entrada
    contact: { id: 'contato-1', service: { id: HAUER_SERVICE } },
    ...overrides,
  }
}

describe('analisarReconciliacaoLead — ticket do proprio envio automatico', () => {
  beforeEach(() => {
    vi.mocked(fetchDigisac).mockReset()
  })

  it('sem exclusao: ticket aberto na loja continua sendo cliente em atendimento (comportamento anterior)', async () => {
    vi.mocked(fetchDigisac).mockResolvedValue({ data: [ticketNaLoja('ticket-robo')] })

    const analise = await analisarReconciliacaoLead(lead as never, AGORA)

    expect(analise.resultado).toBe('cliente_em_atendimento')
  })

  it('ticket comprovado como do robo fica fora: nao e cliente em atendimento nem conversao', async () => {
    vi.mocked(fetchDigisac).mockResolvedValue({ data: [ticketNaLoja('ticket-robo')] })

    const analise = await analisarReconciliacaoLead(lead as never, AGORA, { ignorarTicketIds: ['ticket-robo'] })

    expect(analise.resultado).toBe('ignorado')
    expect(analise.chamadoAberto).toBeUndefined()
    expect(analise.conversoes).toEqual([])
  })

  it('outro ticket aberto por cliente/atendente continua bloqueando mesmo ignorando o ticket do robo', async () => {
    vi.mocked(fetchDigisac).mockResolvedValue({
      data: [ticketNaLoja('ticket-robo'), ticketNaLoja('ticket-do-cliente', { startedAt: '2026-09-19T14:20:00.000Z' })],
    })

    const analise = await analisarReconciliacaoLead(lead as never, AGORA, { ignorarTicketIds: ['ticket-robo'] })

    expect(analise.resultado).toBe('cliente_em_atendimento')
    expect(analise.chamadoAberto?.ticket.id).toBe('ticket-do-cliente')
  })

  it('ticket do cliente ja encerrado dentro da janela continua contando como conversao', async () => {
    vi.mocked(fetchDigisac).mockResolvedValue({
      data: [ticketNaLoja('ticket-robo'), ticketNaLoja('ticket-fechado-do-cliente', { isOpen: false, startedAt: '2026-09-19T13:30:00.000Z' })],
    })

    const analise = await analisarReconciliacaoLead(lead as never, AGORA, { ignorarTicketIds: ['ticket-robo'] })

    expect(analise.resultado).toBe('convertido_reconciliacao')
    expect(analise.conversoes.map((c) => c.ticket.id)).toEqual(['ticket-fechado-do-cliente'])
  })
})
