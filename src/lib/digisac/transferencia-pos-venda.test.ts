import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEPARTAMENTO_POS_VENDA_ID, DEPARTAMENTOS_FIXOS } from './departamentosFixos'
import { fetchDigisac, fetchDigisacRaw } from './clienteDigisac'

vi.mock('./clienteDigisac', () => ({
  fetchDigisac: vi.fn(),
  fetchDigisacRaw: vi.fn(),
}))

const { transferirAtendimentoPosVenda } = await import('./transferencia-pos-venda')

const CONTATO = 'contact-1'
const TICKET = 'ticket-1'
const SESSAO = 'sessao-1'
const BOT = 'bot-user-1'

type Evento = {
  id: string
  sessao_id: string
  tipo: string
  descricao: string
  metadata: Record<string, unknown>
  created_at: string
}

type Sessao = { id: string; digisac_ticket_id: string }

function respostaHttp(status: number, body = '{}') {
  return { ok: status >= 200 && status < 300, status, text: async () => body }
}

function ticket(parcial: Record<string, unknown> = {}) {
  return {
    id: TICKET,
    isOpen: true,
    endedAt: null,
    contactId: CONTATO,
    departmentId: 'departamento-inicial',
    userId: 'atendente-1',
    ...parcial,
  }
}

function criarBanco() {
  const eventos: Evento[] = []
  const sessoes: Sessao[] = [{ id: SESSAO, digisac_ticket_id: TICKET }]

  function filtrar(filtros: Record<string, string>) {
    return eventos.filter((evento) => {
      if (filtros.sessao_id && evento.sessao_id !== filtros.sessao_id) return false
      if (filtros.tipo && evento.tipo !== filtros.tipo) return false
      if (filtros.id && evento.id !== filtros.id) return false
      if (filtros['metadata->>token'] && evento.metadata.token !== filtros['metadata->>token']) return false
      return true
    })
  }

  return {
    eventos,
    sessoes,
    from(table: string) {
      const filtros: Record<string, string> = {}
      const builder = {
        select() {
          return builder
        },
        eq(coluna: string, valor: string) {
          filtros[coluna] = valor
          return builder
        },
        insert(row: Evento) {
          const conflito = table === 'atendimento_automatico_eventos'
            && eventos.some((evento) => evento.sessao_id === row.sessao_id && evento.tipo === row.tipo)
          const criado: Evento = {
            id: `evt-${eventos.length + 1}`,
            created_at: new Date().toISOString(),
            ...row,
          }
          if (!conflito && table === 'atendimento_automatico_eventos') eventos.push(criado)
          return {
            select() {
              return {
                single: async () => conflito
                  ? { data: null, error: { code: '23505', message: 'duplicate key' } }
                  : { data: { id: criado.id }, error: null },
              }
            },
          }
        },
        update(patch: { metadata?: Record<string, unknown>; descricao?: string; digisac_ticket_id?: string }) {
          return {
            eq(coluna: string, valor: string) {
              filtros[coluna] = valor
              return this
            },
            select() {
              if (table === 'atendimento_automatico_sessoes') {
                const sessao = sessoes.find((item) => item.id === filtros.id && item.digisac_ticket_id === filtros.digisac_ticket_id)
                if (!sessao || !patch.digisac_ticket_id) return Promise.resolve({ data: [], error: null })
                sessao.digisac_ticket_id = patch.digisac_ticket_id
                return Promise.resolve({ data: [{ id: sessao.id }], error: null })
              }
              const encontrados = filtrar(filtros)
              for (const evento of encontrados) {
                if (patch.metadata) evento.metadata = patch.metadata
                if (patch.descricao) evento.descricao = patch.descricao
              }
              return Promise.resolve({ data: encontrados.map((evento) => ({ id: evento.id })), error: null })
            },
          }
        },
        maybeSingle() {
          const encontrado = filtrar(filtros)[0] ?? null
          return Promise.resolve({ data: encontrado, error: null })
        },
      }
      return builder
    },
  }
}

describe('transferirAtendimentoPosVenda', () => {
  beforeEach(() => {
    process.env.DIGISAC_BOT_USER_ID = BOT
    vi.mocked(fetchDigisac).mockReset()
    vi.mocked(fetchDigisacRaw).mockReset()
  })

  it('usa o departamento fixo e remove o atendente individual', () => {
    expect(DEPARTAMENTO_POS_VENDA_ID).toBe('50e84096-8d47-4960-b32d-3b4000eee516')
    expect(DEPARTAMENTOS_FIXOS.find((item) => item.name === 'PÓS VENDA')?.id).toBe(DEPARTAMENTO_POS_VENDA_ID)
  })

  it('transfere ao concluir e confirma o ticket aberto sem atendente', async () => {
    const banco = criarBanco()
    vi.mocked(fetchDigisac)
      .mockResolvedValueOnce(ticket())
      .mockResolvedValueOnce(ticket({ departmentId: DEPARTAMENTO_POS_VENDA_ID, userId: null }))
    vi.mocked(fetchDigisacRaw).mockResolvedValue(respostaHttp(200, JSON.stringify({ ticketId: TICKET })) as never)

    const resultado = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: CONTATO,
      ticketId: TICKET,
    })

    expect(resultado).toMatchObject({ status: 'aceita', ticketId: TICKET, httpStatus: 200, motivo: null })
    const body = JSON.parse(String(vi.mocked(fetchDigisacRaw).mock.calls[0][1]?.body))
    expect(body).toEqual({
      departmentId: DEPARTAMENTO_POS_VENDA_ID,
      userId: null,
      comments: '',
      byUserId: BOT,
    })
    expect(fetchDigisacRaw).toHaveBeenCalledTimes(1)
  })

  it('aceita o formato aninhado de department e user ja usado na sincronizacao', async () => {
    const banco = criarBanco()
    vi.mocked(fetchDigisac).mockResolvedValue({
      id: TICKET,
      isOpen: true,
      endedAt: null,
      contact: { id: CONTATO },
      department: { id: DEPARTAMENTO_POS_VENDA_ID },
      user: null,
    })

    const resultado = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: CONTATO,
      ticketId: TICKET,
    })

    expect(resultado).toMatchObject({ status: 'aceita', motivo: 'ja_no_departamento' })
    expect(fetchDigisacRaw).not.toHaveBeenCalled()
  })

  it('nao chama a API quando o ticket ja esta no departamento e sem atendente', async () => {
    const banco = criarBanco()
    vi.mocked(fetchDigisac).mockResolvedValue(ticket({ departmentId: DEPARTAMENTO_POS_VENDA_ID, userId: null }))

    const resultado = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: CONTATO,
      ticketId: TICKET,
    })

    expect(resultado.status).toBe('aceita')
    expect(fetchDigisacRaw).not.toHaveBeenCalled()
  })

  it('chama a API quando o departamento esta certo mas ainda ha atendente', async () => {
    const banco = criarBanco()
    vi.mocked(fetchDigisac)
      .mockResolvedValueOnce(ticket({ departmentId: DEPARTAMENTO_POS_VENDA_ID, userId: 'atendente-1' }))
      .mockResolvedValueOnce(ticket({ departmentId: DEPARTAMENTO_POS_VENDA_ID, userId: null }))
    vi.mocked(fetchDigisacRaw).mockResolvedValue(respostaHttp(200, '{}') as never)

    const resultado = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: CONTATO,
      ticketId: TICKET,
    })

    expect(resultado.status).toBe('aceita')
    expect(fetchDigisacRaw).toHaveBeenCalledTimes(1)
  })

  it('timeout nao repete o POST na mesma chamada e nao lanca excecao', async () => {
    const banco = criarBanco()
    vi.mocked(fetchDigisac).mockResolvedValue(ticket())
    vi.mocked(fetchDigisacRaw).mockRejectedValue(new Error('Digisac Request Timeout (30s)'))

    const resultado = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: CONTATO,
      ticketId: TICKET,
    })

    expect(resultado).toMatchObject({ status: 'incerta', motivo: 'timeout_ou_falha_de_rede' })
    expect(fetchDigisacRaw).toHaveBeenCalledTimes(1)
  })

  it('erro HTTP rejeitado fica como erro e nao repete o POST', async () => {
    const banco = criarBanco()
    vi.mocked(fetchDigisac).mockResolvedValue(ticket())
    vi.mocked(fetchDigisacRaw).mockResolvedValue(respostaHttp(422, '{"message":"invalido"}') as never)

    const resultado = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: CONTATO,
      ticketId: TICKET,
    })

    expect(resultado).toMatchObject({ status: 'erro', motivo: 'resposta_rejeitada', httpStatus: 422 })
    expect(fetchDigisacRaw).toHaveBeenCalledTimes(1)
  })

  it('duas chamadas simultaneas fazem um unico POST', async () => {
    const banco = criarBanco()
    let consultas = 0
    vi.mocked(fetchDigisac).mockImplementation(async () => {
      consultas += 1
      if (consultas === 1) return ticket()
      return ticket({ departmentId: DEPARTAMENTO_POS_VENDA_ID, userId: null })
    })
    vi.mocked(fetchDigisacRaw).mockResolvedValue(respostaHttp(200, JSON.stringify({ ticketId: TICKET })) as never)

    const [primeira, segunda] = await Promise.all([
      transferirAtendimentoPosVenda({ supabase: banco as never, sessaoId: SESSAO, contactId: CONTATO, ticketId: TICKET }),
      transferirAtendimentoPosVenda({ supabase: banco as never, sessaoId: SESSAO, contactId: CONTATO, ticketId: TICKET }),
    ])

    const statuses = [primeira.status, segunda.status].sort()
    expect(statuses).toEqual(['aceita', 'em_andamento'])
    expect(fetchDigisacRaw).toHaveBeenCalledTimes(1)
  })

  it('reserva ja aceita nao chama a API de novo', async () => {
    const banco = criarBanco()
    banco.eventos.push({
      id: 'evt-aceita',
      sessao_id: SESSAO,
      tipo: 'transferencia_pos_venda',
      descricao: 'aceita',
      created_at: new Date().toISOString(),
      metadata: { status: 'aceita', token: 'token-1', ticketId: TICKET },
    })

    const resultado = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: CONTATO,
      ticketId: TICKET,
    })

    expect(resultado).toMatchObject({ status: 'aceita', motivo: 'ja_transferida' })
    expect(fetchDigisac).not.toHaveBeenCalled()
    expect(fetchDigisacRaw).not.toHaveBeenCalled()
  })

  it('nao chama a API sem contactId ou sem usuario de automacao', async () => {
    const banco = criarBanco()
    const semContato = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: null,
      ticketId: TICKET,
    })
    expect(semContato).toMatchObject({ status: 'erro', motivo: 'identificador_ausente' })

    delete process.env.DIGISAC_BOT_USER_ID
    const semUsuario = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: CONTATO,
      ticketId: TICKET,
    })
    expect(semUsuario).toMatchObject({ status: 'erro', motivo: 'DIGISAC_BOT_USER_ID_nao_configurado' })
    expect(fetchDigisacRaw).not.toHaveBeenCalled()
  })

  it('vincula o ticket novo somente quando a resposta e a consulta confirmam o mesmo id', async () => {
    const banco = criarBanco()
    vi.mocked(fetchDigisac).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/tickets/ticket-novo') {
        return ticket({ id: 'ticket-novo', departmentId: DEPARTAMENTO_POS_VENDA_ID, userId: null })
      }
      return ticket({ isOpen: false, endedAt: '2026-10-26T18:00:00.000Z' })
    })
    vi.mocked(fetchDigisacRaw).mockResolvedValue(respostaHttp(200, JSON.stringify({ ticketId: 'ticket-novo' })) as never)

    const resultado = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: CONTATO,
      ticketId: TICKET,
    })

    expect(resultado).toMatchObject({ status: 'aceita', ticketId: 'ticket-novo' })
    expect(banco.sessoes[0].digisac_ticket_id).toBe('ticket-novo')
  })

  it('nao procura outro ticket aberto quando a transferencia nao devolve id', async () => {
    const banco = criarBanco()
    vi.mocked(fetchDigisac).mockResolvedValue(ticket({ isOpen: false, endedAt: '2026-10-26T18:00:00.000Z' }))
    vi.mocked(fetchDigisacRaw).mockResolvedValue(respostaHttp(200, '{}') as never)

    const resultado = await transferirAtendimentoPosVenda({
      supabase: banco as never,
      sessaoId: SESSAO,
      contactId: CONTATO,
      ticketId: TICKET,
    })

    expect(resultado).toMatchObject({ status: 'incerta', motivo: 'transferencia_nao_confirmada' })
    expect(banco.sessoes[0].digisac_ticket_id).toBe(TICKET)
    expect(vi.mocked(fetchDigisac).mock.calls.every(([endpoint]) => endpoint === `/tickets/${TICKET}`)).toBe(true)
  })
})
