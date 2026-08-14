import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarEntradaHubVendas } from './registrar-entrada'
import type { HubVendasMensagemValidada } from './payload'

const buscarContatoCompletoMock = vi.hoisted(() => vi.fn())
const buscarTicketResgatePorIdMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/digisac/contatos', () => ({
  buscarContatoCompleto: buscarContatoCompletoMock,
}))

vi.mock('./envio', () => ({
  buscarTicketResgatePorId: buscarTicketResgatePorIdMock,
}))

type LeadRow = {
  id: string
  telefone_normalizado_ddi: string
  telefone_normalizado: string
  ciclo_numero: number
  data_entrada_hub: string
  nome_contato_hub?: string | null
}

type EventRow = {
  id: string
  digisac_message_id: string
  status: string
  resultado: Record<string, unknown>
  lead_id?: string | null
}

function criarMensagem(id: string, timestamp = '2026-07-24T12:00:00.000Z'): HubVendasMensagemValidada {
  return {
    event: 'message.created',
    messageId: id,
    contactId: 'contact-hub',
    serviceId: '4af28025-c210-4336-a560-785d2fb8a778',
    ticketId: 'ticket-hub',
    timestampEvento: new Date(timestamp),
    texto: 'saudacao',
    data: {},
  }
}

function criarSupabaseFake() {
  const leads: LeadRow[] = []
  const eventos: EventRow[] = []

  const client = {
    leads,
    eventos,
    from(table: string) {
      const state: Record<string, unknown> = {}
      const builder = {
        insert(row: Record<string, unknown>) {
          if (table === 'hub_vendas_eventos_processados') {
            if (eventos.some((evento) => evento.digisac_message_id === row.digisac_message_id)) {
              state.error = { code: '23505', message: 'duplicate key' }
            } else {
              const evento = {
                id: `evento-${eventos.length + 1}`,
                digisac_message_id: String(row.digisac_message_id),
                status: String(row.status),
                resultado: {},
              }
              eventos.push(evento)
              state.data = evento
            }
          } else if (table === 'hub_vendas_leads') {
            const lead = { id: `lead-${leads.length + 1}`, ...(row as Omit<LeadRow, 'id'>) }
            leads.push(lead)
            state.data = lead
          }
          return builder
        },
        select() {
          return builder
        },
        single() {
          return Promise.resolve({ data: state.data, error: state.error ?? null })
        },
        in(_column: string, values: string[]) {
          state.inValues = values
          return builder
        },
        order() {
          return builder
        },
        limit() {
          return builder
        },
        maybeSingle() {
          const values = state.inValues as string[]
          const match = leads
            .filter((lead) => values.includes(lead.telefone_normalizado_ddi))
            .sort((a, b) => b.ciclo_numero - a.ciclo_numero)[0] ?? null
          return Promise.resolve({ data: match, error: null })
        },
        update(values: Partial<EventRow>) {
          state.update = values
          return builder
        },
        eq(_column: string, id: string) {
          const evento = eventos.find((item) => item.id === id)
          if (evento) Object.assign(evento, state.update)
          return Promise.resolve({ error: null })
        },
      }
      return builder
    },
  }

  return client
}

describe('registrarEntradaHubVendas', () => {
  beforeEach(() => {
    buscarContatoCompletoMock.mockReset()
    buscarContatoCompletoMock.mockResolvedValue({
      name: 'Cliente Teste',
      data: { number: '+55 (41) 99624-6875' },
    })
    buscarTicketResgatePorIdMock.mockReset()
    buscarTicketResgatePorIdMock.mockResolvedValue({ ticketId: 'ticket-hub', protocolo: '654321', transferido: false })
  })

  it('cria ciclo 1 quando nao existe lead anterior', async () => {
    const supabase = criarSupabaseFake()
    const resultado = await registrarEntradaHubVendas(criarMensagem('msg-1'), supabase as never)

    expect(resultado).toMatchObject({ ok: true, processed: true, cicloNumero: 1, repeated: false })
    expect(supabase.leads[0]).toMatchObject({
      telefone_normalizado_ddi: '5541996246875',
      telefone_normalizado: '41996246875',
      ciclo_numero: 1,
      status: 'aguardando_conversao',
      digisac_ticket_id_hub: 'ticket-hub',
      digisac_protocolo_hub: '654321',
    })
    expect(supabase.eventos[0]).toMatchObject({ status: 'processado', lead_id: 'lead-1' })
  })

  it('persiste lead mesmo quando a busca do protocolo original falha', async () => {
    buscarTicketResgatePorIdMock.mockRejectedValue(new Error('falha_digisac'))
    const supabase = criarSupabaseFake()

    const resultado = await registrarEntradaHubVendas(criarMensagem('msg-1'), supabase as never)

    expect(resultado).toMatchObject({ ok: true, processed: true, cicloNumero: 1, repeated: false })
    expect(supabase.leads[0]).toMatchObject({ digisac_protocolo_hub: null })
  })

  it('persiste nome valido do perfil recebido no webhook da entrada', async () => {
    buscarContatoCompletoMock.mockResolvedValue({
      name: 'Cliente',
      data: { number: '+55 (41) 99624-6875' },
    })
    const supabase = criarSupabaseFake()
    const mensagem = criarMensagem('msg-1')
    mensagem.data.data = { pushName: 'M\u00ea Mastaler' }

    await registrarEntradaHubVendas(mensagem, supabase as never)

    expect(supabase.leads[0]).toMatchObject({
      nome_contato_hub: 'M\u00ea Mastaler',
    })
  })

  it('ignora saudacao repetida antes de 14 dias no mesmo telefone', async () => {
    const supabase = criarSupabaseFake()
    await registrarEntradaHubVendas(criarMensagem('msg-1', '2026-07-01T12:00:00.000Z'), supabase as never)

    const resultado = await registrarEntradaHubVendas(criarMensagem('msg-2', '2026-07-10T12:00:00.000Z'), supabase as never)

    expect(resultado).toMatchObject({ ok: true, processed: true, leadId: 'lead-1', cicloNumero: 1, repeated: true })
    expect(supabase.leads).toHaveLength(1)
    expect(supabase.eventos[1]).toMatchObject({ status: 'ignorado', lead_id: 'lead-1' })
  })

  it('cria novo ciclo quando a saudacao ocorre depois de 14 dias', async () => {
    const supabase = criarSupabaseFake()
    await registrarEntradaHubVendas(criarMensagem('msg-1', '2026-07-01T12:00:00.000Z'), supabase as never)

    const resultado = await registrarEntradaHubVendas(criarMensagem('msg-2', '2026-07-16T12:00:00.000Z'), supabase as never)

    expect(resultado).toMatchObject({ ok: true, processed: true, cicloNumero: 2, repeated: false })
    expect(supabase.leads).toHaveLength(2)
  })

  it('reserva evento antes e bloqueia duplicidade por messageId', async () => {
    const supabase = criarSupabaseFake()
    await registrarEntradaHubVendas(criarMensagem('msg-1'), supabase as never)

    const resultado = await registrarEntradaHubVendas(criarMensagem('msg-1'), supabase as never)

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'evento_duplicado' })
    expect(buscarContatoCompletoMock).toHaveBeenCalledTimes(1)
  })
})
