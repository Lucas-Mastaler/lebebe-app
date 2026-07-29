import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarConversaoHubVendas } from './registrar-conversao'
import type { HubVendasMensagemValidada } from './payload'

const buscarContatoCompletoMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/digisac/contatos', () => ({
  buscarContatoCompleto: buscarContatoCompletoMock,
}))

type LeadRow = {
  id: string
  telefone_normalizado_ddi: string
  data_entrada_hub: string
  ciclo_numero: number
  status: string
  lojas_chamadas: string[]
  loja_principal: string | null
  data_conversao: string | null
  chamou_mais_de_uma_loja: boolean
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
    texto: 'Oi',
    data: {},
  }
}

function criarLead(id = 'lead-1', dataEntrada = '2026-07-24T12:00:00.000Z'): LeadRow {
  return {
    id,
    telefone_normalizado_ddi: '5541996246875',
    data_entrada_hub: dataEntrada,
    ciclo_numero: 1,
    status: 'aguardando_conversao',
    lojas_chamadas: [],
    loja_principal: null,
    data_conversao: null,
    chamou_mais_de_uma_loja: false,
  }
}

function criarSupabaseFake(leadsIniciais: LeadRow[], rpcError?: { code?: string; message?: string }) {
  const leads = leadsIniciais
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
          }
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
        lte(_column: string, value: string) {
          state.lte = value
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
        eq(_column: string, id: string) {
          const evento = eventos.find((item) => item.id === id)
          if (evento) Object.assign(evento, state.update)
          return Promise.resolve({ error: null })
        },
        then(resolve: (value: { data: LeadRow[]; error: null }) => void) {
          const telefones = state.telefone_normalizado_ddi as string[]
          const status = state.status as string[]
          const lte = new Date(String(state.lte)).getTime()
          resolve({
            data: leads
              .filter((lead) => telefones.includes(lead.telefone_normalizado_ddi))
              .filter((lead) => status.includes(lead.status))
              .filter((lead) => new Date(lead.data_entrada_hub).getTime() <= lte)
              .sort((a, b) => new Date(b.data_entrada_hub).getTime() - new Date(a.data_entrada_hub).getTime())
              .slice(0, 5),
            error: null,
          })
        },
      }
      return builder
    },
    rpc(_fn: string, params: { p_lead_id: string; p_loja: string; p_timestamp_evento: string }) {
      if (rpcError) {
        return Promise.resolve({ data: null, error: rpcError })
      }

      const lead = leads.find((item) => item.id === params.p_lead_id)!
      const lojaJaExistia = lead.lojas_chamadas.includes(params.p_loja)
      if (lojaJaExistia) {
        return Promise.resolve({
          data: {
            atualizado: false,
            motivo: 'loja_ja_registrada',
            resultado_semantico: 'loja_ja_registrada',
            loja_ja_existia: true,
            chamou_mais_de_uma_loja: lead.chamou_mais_de_uma_loja,
            quantidade_lojas: lead.lojas_chamadas.length,
          },
          error: null,
        })
      }
      const resultadoSemantico = lead.loja_principal ? 'loja_adicional' : 'primeira_conversao'
      if (!lojaJaExistia) lead.lojas_chamadas.push(params.p_loja)
      lead.loja_principal ??= params.p_loja
      lead.data_conversao ??= params.p_timestamp_evento
      lead.status = 'convertido_organicamente'
      lead.chamou_mais_de_uma_loja = lead.lojas_chamadas.length > 1
      return Promise.resolve({
        data: {
          atualizado: true,
          loja_ja_existia: lojaJaExistia,
          chamou_mais_de_uma_loja: lead.chamou_mais_de_uma_loja,
          resultado_semantico: resultadoSemantico,
          quantidade_lojas: lead.lojas_chamadas.length,
        },
        error: null,
      })
    },
  }

  return client
}

describe('registrarConversaoHubVendas', () => {
  beforeEach(() => {
    buscarContatoCompletoMock.mockReset()
    buscarContatoCompletoMock.mockResolvedValue({ data: { number: '+55 (41) 99624-6875' } })
  })

  it('registra primeira loja dentro da janela de 24h', async () => {
    const supabase = criarSupabaseFake([criarLead()])

    const resultado = await registrarConversaoHubVendas(
      criarMensagem('msg-loja-1', '2026-07-24T13:00:00.000Z'),
      'portao',
      supabase as never
    )

    expect(resultado).toMatchObject({ ok: true, processed: true, leadId: 'lead-1', loja: 'portao', multipleStores: false })
    expect(supabase.leads[0]).toMatchObject({
      status: 'convertido_organicamente',
      loja_principal: 'portao',
      lojas_chamadas: ['portao'],
      chamou_mais_de_uma_loja: false,
    })
  })

  it('usa variacao de nono digito para encontrar o lead', async () => {
    buscarContatoCompletoMock.mockResolvedValueOnce({ data: { number: '554196246875' } })
    const supabase = criarSupabaseFake([criarLead()])

    const resultado = await registrarConversaoHubVendas(
      criarMensagem('msg-loja-1', '2026-07-24T13:00:00.000Z'),
      'portao',
      supabase as never
    )

    expect(resultado).toMatchObject({ ok: true, processed: true, leadId: 'lead-1' })
  })

  it('ignora mensagem exatamente no limite superior de 24h', async () => {
    const supabase = criarSupabaseFake([criarLead()])

    const resultado = await registrarConversaoHubVendas(
      criarMensagem('msg-loja-1', '2026-07-25T12:00:00.000Z'),
      'portao',
      supabase as never
    )

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'fora_janela_conversao' })
    expect(supabase.leads[0].status).toBe('aguardando_conversao')
  })

  it('preserva primeira loja e registra segunda loja distinta sem duplicar mesma loja', async () => {
    const lead = criarLead()
    lead.status = 'convertido_organicamente'
    lead.lojas_chamadas = ['portao']
    lead.loja_principal = 'portao'
    lead.data_conversao = '2026-07-24T13:00:00.000Z'
    const supabase = criarSupabaseFake([lead])

    const segundaLoja = await registrarConversaoHubVendas(
      criarMensagem('msg-loja-2', '2026-07-24T14:00:00.000Z'),
      'bigorrilho',
      supabase as never
    )
    const mesmaLoja = await registrarConversaoHubVendas(
      criarMensagem('msg-loja-3', '2026-07-24T15:00:00.000Z'),
      'bigorrilho',
      supabase as never
    )

    expect(segundaLoja).toMatchObject({ ok: true, processed: true, multipleStores: true })
    expect(mesmaLoja).toEqual({ ok: true, ignored: true, reason: 'loja_ja_registrada' })
    expect(supabase.leads[0]).toMatchObject({
      loja_principal: 'portao',
      lojas_chamadas: ['portao', 'bigorrilho'],
      data_conversao: '2026-07-24T13:00:00.000Z',
      chamou_mais_de_uma_loja: true,
    })
  })

  it('escolhe ciclo mais recente compativel e nao ciclo antigo', async () => {
    const antigo = criarLead('lead-antigo', '2026-07-01T12:00:00.000Z')
    const novo = criarLead('lead-novo', '2026-07-24T12:00:00.000Z')
    novo.ciclo_numero = 2
    const supabase = criarSupabaseFake([antigo, novo])

    const resultado = await registrarConversaoHubVendas(
      criarMensagem('msg-loja-1', '2026-07-24T13:00:00.000Z'),
      'portao',
      supabase as never
    )

    expect(resultado).toMatchObject({ leadId: 'lead-novo' })
    expect(antigo.lojas_chamadas).toEqual([])
  })

  it('registra erro tecnico sanitizado quando RPC falha', async () => {
    const supabase = criarSupabaseFake(
      [criarLead()],
      {
        code: '42702',
        message: 'column reference "lead_id" is ambiguous',
      }
    )
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const resultado = await registrarConversaoHubVendas(
      criarMensagem('msg-loja-erro', '2026-07-24T13:00:00.000Z'),
      'portao',
      supabase as never
    )

    expect(resultado).toEqual({ ok: false, error: 'erro_registro_conversao' })
    expect(supabase.eventos[0]).toMatchObject({
      status: 'erro',
      erro: 'postgres_42702_coluna_ambigua',
      resultado: {
        reason: 'erro_registro_conversao',
        operacao: 'rpc_hub_vendas_registrar_conversao',
        codigo: '42702',
        mensagem: 'column reference "lead_id" is ambiguous',
      },
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[HUB VENDAS] Falha ao registrar conversao operacao=rpc_hub_vendas_registrar_conversao codigo=42702'
    )
    consoleErrorSpy.mockRestore()
  })
})
