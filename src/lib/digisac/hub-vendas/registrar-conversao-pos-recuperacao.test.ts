import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarConversaoPosRecuperacaoHubVendas } from './registrar-conversao-pos-recuperacao'
import type { HubVendasMensagemValidada } from './payload'

const buscarContatoCompletoMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/digisac/contatos', () => ({
  buscarContatoCompleto: buscarContatoCompletoMock,
}))

type LeadRow = {
  id: string
  telefone_normalizado_ddi: string
  status: string
  data_recuperacao_enviada: string | null
  data_recuperacao_respondida: string | null
}

type EventRow = {
  id: string
  digisac_message_id: string
  status: string
  resultado: Record<string, unknown>
  lead_id?: string | null
}

function criarMensagem(id: string, timestamp: string): HubVendasMensagemValidada {
  return {
    event: 'message.created',
    messageId: id,
    contactId: 'contact-loja',
    serviceId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
    ticketId: 'ticket-loja',
    timestampEvento: new Date(timestamp),
    texto: 'Oi, ainda tem esse tapete?',
    data: {},
  }
}

function criarLead(id = 'lead-1', dataRecuperacaoEnviada = '2026-07-24T12:00:00.000Z'): LeadRow {
  return {
    id,
    telefone_normalizado_ddi: '5541996246875',
    status: 'recuperacao_enviada',
    data_recuperacao_enviada: dataRecuperacaoEnviada,
    data_recuperacao_respondida: null,
  }
}

function criarSupabaseFake(leadsIniciais: LeadRow[]) {
  const leads = leadsIniciais
  const eventos: EventRow[] = []

  const client = {
    leads,
    eventos,
    from(table: string) {
      const state: Record<string, unknown> = {}
      const builder = {
        insert() {
          return builder
        },
        select() {
          return builder
        },
        single() {
          return Promise.resolve({ data: state.data, error: state.error ?? null })
        },
        in(column: string, values: string[]) {
          state[column] = values
          return builder
        },
        eq(column: string, value: string) {
          if (table === 'hub_vendas_eventos_processados') {
            const evento = eventos.find((item) => item.id === value)
            if (evento) Object.assign(evento, state.update)
            return Promise.resolve({ error: null })
          }
          state[column] = value
          return builder
        },
        not(column: string, ..._resto: unknown[]) {
          state[`${column}__not_null`] = true
          return builder
        },
        order() {
          return builder
        },
        limit() {
          return builder
        },
        update(values: Partial<EventRow>) {
          state.update = values
          return builder
        },
        then(resolve: (value: { data: LeadRow[]; error: null }) => void) {
          const telefones = state.telefone_normalizado_ddi as string[]
          const status = state.status as string
          resolve({
            data: leads
              .filter((lead) => telefones.includes(lead.telefone_normalizado_ddi))
              .filter((lead) => lead.status === status)
              .filter((lead) => !state.data_recuperacao_enviada__not_null || lead.data_recuperacao_enviada != null)
              .sort(
                (a, b) =>
                  new Date(b.data_recuperacao_enviada ?? 0).getTime() - new Date(a.data_recuperacao_enviada ?? 0).getTime()
              )
              .slice(0, 5),
            error: null,
          })
        },
      }
      return builder
    },
    rpc(_fn: string, params: { p_lead_id: string; p_timestamp_evento: string }) {
      const lead = leads.find((item) => item.id === params.p_lead_id)
      if (!lead) {
        return Promise.resolve({
          data: { lead_id: params.p_lead_id, atualizado: false, motivo: 'lead_nao_encontrado', status: null, data_recuperacao_respondida: null },
          error: null,
        })
      }

      if (lead.status !== 'recuperacao_enviada') {
        return Promise.resolve({
          data: { lead_id: lead.id, atualizado: false, motivo: 'status_nao_elegivel', status: lead.status, data_recuperacao_respondida: lead.data_recuperacao_respondida },
          error: null,
        })
      }

      const inicioMs = new Date(lead.data_recuperacao_enviada!).getTime()
      const eventoMs = new Date(params.p_timestamp_evento).getTime()
      if (eventoMs < inicioMs || eventoMs >= inicioMs + 24 * 60 * 60 * 1000) {
        return Promise.resolve({
          data: { lead_id: lead.id, atualizado: false, motivo: 'fora_janela_24h_pos_recuperacao', status: lead.status, data_recuperacao_respondida: null },
          error: null,
        })
      }

      lead.status = 'recuperado'
      lead.data_recuperacao_respondida = params.p_timestamp_evento
      return Promise.resolve({
        data: { lead_id: lead.id, atualizado: true, motivo: 'recuperado', status: lead.status, data_recuperacao_respondida: lead.data_recuperacao_respondida },
        error: null,
      })
    },
  }

  return client
}

describe('registrarConversaoPosRecuperacaoHubVendas', () => {
  beforeEach(() => {
    buscarContatoCompletoMock.mockReset()
    buscarContatoCompletoMock.mockResolvedValue({ data: { number: '+55 (41) 99624-6875' } })
  })

  it('converte para recuperado quando resposta chega dentro da janela de 24h', async () => {
    const supabase = criarSupabaseFake([criarLead()])

    const resultado = await registrarConversaoPosRecuperacaoHubVendas(
      criarMensagem('msg-1', '2026-07-24T20:00:00.000Z'),
      'portao',
      supabase as never,
      { eventoId: 'evento-1' }
    )

    expect(resultado).toEqual({ ok: true, processed: true, leadId: 'lead-1', loja: 'portao' })
    expect(supabase.leads[0]).toMatchObject({ status: 'recuperado', data_recuperacao_respondida: '2026-07-24T20:00:00.000Z' })
  })

  it('converte exatamente no instante de data_recuperacao_enviada (limite inferior valido)', async () => {
    const supabase = criarSupabaseFake([criarLead()])

    const resultado = await registrarConversaoPosRecuperacaoHubVendas(
      criarMensagem('msg-1', '2026-07-24T12:00:00.000Z'),
      'portao',
      supabase as never,
      { eventoId: 'evento-1' }
    )

    expect(resultado).toMatchObject({ ok: true, processed: true })
  })

  it('nao converte quando resposta chega exatamente em +24h (limite superior invalido)', async () => {
    const supabase = criarSupabaseFake([criarLead()])

    const resultado = await registrarConversaoPosRecuperacaoHubVendas(
      criarMensagem('msg-1', '2026-07-25T12:00:00.000Z'),
      'portao',
      supabase as never,
      { eventoId: 'evento-1' }
    )

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'fora_janela_pos_recuperacao' })
    expect(supabase.leads[0].status).toBe('recuperacao_enviada')
  })

  it('nao converte quando resposta chega apos 24h', async () => {
    const supabase = criarSupabaseFake([criarLead()])

    const resultado = await registrarConversaoPosRecuperacaoHubVendas(
      criarMensagem('msg-1', '2026-07-25T13:00:00.000Z'),
      'portao',
      supabase as never,
      { eventoId: 'evento-1' }
    )

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'fora_janela_pos_recuperacao' })
    expect(supabase.leads[0].status).toBe('recuperacao_enviada')
  })

  it('ignora quando nao ha lead em recuperacao_enviada para o telefone', async () => {
    const supabase = criarSupabaseFake([])

    const resultado = await registrarConversaoPosRecuperacaoHubVendas(
      criarMensagem('msg-1', '2026-07-24T20:00:00.000Z'),
      'portao',
      supabase as never,
      { eventoId: 'evento-1' }
    )

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'lead_recuperacao_nao_encontrado' })
  })

  it('segunda chamada para o mesmo lead ja recuperado nao duplica/nao reverte (idempotente)', async () => {
    const supabase = criarSupabaseFake([criarLead()])

    const primeira = await registrarConversaoPosRecuperacaoHubVendas(
      criarMensagem('msg-1', '2026-07-24T20:00:00.000Z'),
      'portao',
      supabase as never,
      { eventoId: 'evento-1' }
    )
    // Segunda mensagem do mesmo telefone: a busca de lead compativel ja nao encontra mais
    // lead em recuperacao_enviada (o lead ja virou 'recuperado'), entao nao ha o que reprocessar.
    const segunda = await registrarConversaoPosRecuperacaoHubVendas(
      criarMensagem('msg-2', '2026-07-24T20:05:00.000Z'),
      'portao',
      supabase as never,
      { eventoId: 'evento-2' }
    )

    expect(primeira).toMatchObject({ ok: true, processed: true })
    expect(segunda).toEqual({ ok: true, ignored: true, reason: 'lead_recuperacao_nao_encontrado' })
    expect(supabase.leads[0].data_recuperacao_respondida).toBe('2026-07-24T20:00:00.000Z')
  })
})
