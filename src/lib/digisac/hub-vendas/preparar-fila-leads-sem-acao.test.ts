import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/digisac/clienteDigisac', () => ({
  fetchDigisac: vi.fn(),
}))

const verificarTicketRoboMock = vi.hoisted(() => vi.fn())
vi.mock('./envio', () => ({
  verificarTicketRoboReutilizavel: verificarTicketRoboMock,
}))

const { fetchDigisac } = await import('@/lib/digisac/clienteDigisac')
const { encerrarLeadsSemAcaoValidaHubVendas } = await import('./preparar-fila')

const HAUER = '1352c41b-80a9-4e74-b9d9-4c5e7aed060e'
const AGORA = new Date('2026-09-21T15:00:00.000Z')
const PARAMETROS = { elegibilidade_horas: 48 }
const FORA_DA_JANELA = '2026-09-02T13:00:00.000Z' // ~19 dias antes
const DENTRO_DA_JANELA = '2026-09-20T09:00:00.000Z' // 30h antes

type LeadRow = {
  id: string
  telefone_normalizado_ddi: string
  data_entrada_hub: string
  status: string
  data_fila_manual?: string | null
  motivo_bloqueio_recuperacao?: string | null
  data_encerrado?: string | null
  data_recuperacao_enviada?: string | null
}

type FilaRow = {
  id: string
  lead_id: string
  status: string
  conexao_destino_id: string
  digisac_message_id: string | null
  digisac_ticket_id: string | null
  digisac_contact_id: string | null
  erro: string | null
  categoria_erro: string | null
  tentativas_envio: number
  motivo_cancelamento: string | null
  updated_at?: string
}

function criarLead(id: string, overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id,
    telefone_normalizado_ddi: '5541996246875',
    data_entrada_hub: FORA_DA_JANELA,
    status: 'encaminhado_recuperacao',
    data_fila_manual: null,
    motivo_bloqueio_recuperacao: null,
    ...overrides,
  }
}

function criarFila(id: string, leadId: string, overrides: Partial<FilaRow> = {}): FilaRow {
  return {
    id,
    lead_id: leadId,
    status: 'erro',
    conexao_destino_id: HAUER,
    digisac_message_id: null,
    digisac_ticket_id: null,
    digisac_contact_id: null,
    erro: 'contato_criacao_falhou status=500 body={"message":"serverPod is not set."}',
    categoria_erro: 'contato',
    tentativas_envio: 4,
    motivo_cancelamento: null,
    ...overrides,
  }
}

function criarSupabaseFake(leads: LeadRow[], filas: FilaRow[]) {
  class Builder {
    private filtros: Array<(linha: Record<string, unknown>) => boolean> = []
    private valores: Record<string, unknown> | null = null
    private retornaLinhas = false

    constructor(private tabela: 'hub_vendas_leads' | 'hub_vendas_recuperacao_fila') {}

    select() {
      this.retornaLinhas = true
      return this
    }

    update(valores: Record<string, unknown>) {
      this.valores = valores
      this.retornaLinhas = false
      return this
    }

    eq(coluna: string, valor: unknown) {
      this.filtros.push((linha) => linha[coluna] === valor)
      return this
    }

    lte(coluna: string, valor: string) {
      this.filtros.push((linha) => String(linha[coluna]) <= valor)
      return this
    }

    in(coluna: string, valores: unknown[]) {
      this.filtros.push((linha) => valores.includes(linha[coluna]))
      return this
    }

    order() {
      return this
    }

    then(resolve: (valor: unknown) => void, reject: (motivo?: unknown) => void) {
      Promise.resolve(this.executar()).then(resolve, reject)
    }

    private executar() {
      const origem = (this.tabela === 'hub_vendas_leads' ? leads : filas) as unknown as Array<Record<string, unknown>>
      const alvo = origem.filter((linha) => this.filtros.every((filtro) => filtro(linha)))
      if (this.valores) {
        for (const linha of alvo) Object.assign(linha, this.valores)
        return { data: this.retornaLinhas ? alvo.map((linha) => ({ id: linha.id })) : null, error: null }
      }
      return { data: alvo.map((linha) => ({ ...linha })), error: null }
    }
  }

  return { from: (tabela: string) => new Builder(tabela as 'hub_vendas_leads' | 'hub_vendas_recuperacao_fila') }
}

type TicketFake = { id: string; isOpen: boolean; startedAt: string }

function simularTicketsNasLojas(tickets: TicketFake[]) {
  vi.mocked(fetchDigisac).mockResolvedValue({
    data: tickets.map((ticket) => ({ ...ticket, contact: { id: 'contato-loja', service: { id: HAUER } } })),
  })
}

async function rodar(leads: LeadRow[], filas: FilaRow[]) {
  const supabase = criarSupabaseFake(leads, filas)
  const total = await encerrarLeadsSemAcaoValidaHubVendas(supabase as never, PARAMETROS, AGORA)
  return { total, supabase }
}

describe('encerrarLeadsSemAcaoValidaHubVendas', () => {
  beforeEach(() => {
    vi.mocked(fetchDigisac).mockReset()
    verificarTicketRoboMock.mockReset()
    verificarTicketRoboMock.mockResolvedValue({ reutilizavel: false, motivo: 'nao_configurado_no_teste' })
    simularTicketsNasLojas([])
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('encerra (fora da janela, sem acao futura, sem atividade nas lojas)', () => {
    it('erro definitivo: lead vai para o terminal fila_manual, com motivo e data, e a fila em erro vira expirado com historico preservado', async () => {
      const lead = criarLead('lead-erro')
      const fila = criarFila('fila-erro', lead.id)

      const { total } = await rodar([lead], [fila])

      expect(total).toBe(1)
      expect(lead).toMatchObject({
        status: 'fila_manual',
        data_fila_manual: AGORA.toISOString(),
        motivo_bloqueio_recuperacao: 'recuperacao_expirada_erro_definitivo',
      })
      // Nao registra recuperacao que nao aconteceu.
      expect(lead.data_recuperacao_enviada).toBeUndefined()
      // Historico da fila preservado: nada apagado, so o status muda para expirado (nao reprocessavel).
      expect(fila).toMatchObject({
        status: 'expirado',
        motivo_cancelamento: 'recuperacao_expirada',
        categoria_erro: 'contato',
        tentativas_envio: 4,
        digisac_message_id: null,
      })
      expect(fila.erro).toContain('serverPod is not set')
    })

    it('fila cancelada sem acao futura (motivo operacional): lead encerrado e a fila continua cancelada, com o motivo original', async () => {
      const lead = criarLead('lead-cancelado')
      const fila = criarFila('fila-cancelada', lead.id, {
        status: 'cancelado', erro: null, categoria_erro: null, tentativas_envio: 0, motivo_cancelamento: 'telefone_invalido',
      })

      const { total } = await rodar([lead], [fila])

      expect(total).toBe(1)
      expect(lead).toMatchObject({ status: 'fila_manual', motivo_bloqueio_recuperacao: 'recuperacao_expirada_fila_cancelada' })
      // Nao mistura cancelamento operacional com "oportunidade expirada".
      expect(fila).toMatchObject({ status: 'cancelado', motivo_cancelamento: 'telefone_invalido' })
    })

    it('varias filas terminais (erro + cancelada): encerra e so a fila em erro vira expirado', async () => {
      const lead = criarLead('lead-misto')
      const erro = criarFila('fila-1', lead.id)
      const cancelada = criarFila('fila-2', lead.id, { status: 'cancelado', motivo_cancelamento: 'conexao_pausada', erro: null, categoria_erro: null })

      const { total } = await rodar([lead], [erro, cancelada])

      expect(total).toBe(1)
      expect(erro.status).toBe('expirado')
      expect(cancelada.status).toBe('cancelado')
      expect(lead.motivo_bloqueio_recuperacao).toBe('recuperacao_expirada_erro_definitivo')
    })

    it('ticket do PROPRIO robo (comprovadamente intacto) nao conta como atividade: lead encerrado', async () => {
      const lead = criarLead('lead-robo')
      const fila = criarFila('fila-robo', lead.id, {
        status: 'cancelado', erro: null, categoria_erro: null, motivo_cancelamento: 'cliente_em_atendimento',
        digisac_ticket_id: 'ticket-robo', digisac_contact_id: 'contato-1',
      })
      simularTicketsNasLojas([{ id: 'ticket-robo', isOpen: true, startedAt: '2026-09-19T14:18:03.754Z' }])
      verificarTicketRoboMock.mockResolvedValue({ reutilizavel: true, ticket: { ticketId: 'ticket-robo', protocolo: '1', transferido: false } })

      const { total } = await rodar([lead], [fila])

      expect(verificarTicketRoboMock).toHaveBeenCalledWith({ ticketId: 'ticket-robo', contactId: 'contato-1', serviceId: HAUER })
      expect(total).toBe(1)
      expect(lead.status).toBe('fila_manual')
    })
  })

  describe('nao encerra', () => {
    it('lead dentro da janela de recuperacao (menos de 48h desde a entrada), mesmo com fila em erro', async () => {
      const lead = criarLead('lead-recente', { data_entrada_hub: DENTRO_DA_JANELA })
      const fila = criarFila('fila-recente', lead.id)

      const { total } = await rodar([lead], [fila])

      expect(total).toBe(0)
      expect(lead.status).toBe('encaminhado_recuperacao')
      expect(fila.status).toBe('erro')
      expect(fetchDigisac).not.toHaveBeenCalled()
    })

    it.each([
      ['retry agendado', 'agendado'],
      ['reservada para envio', 'reservado'],
      ['enviando', 'enviando'],
      ['resultado incerto aguardando tratamento', 'resultado_incerto'],
      ['analise manual pendente', 'analise_manual'],
      ['enviada', 'enviado'],
    ])('fila %s: nao encerra e nao consulta o DigiSac', async (_nome, status) => {
      const lead = criarLead('lead-pendente')
      const fila = criarFila('fila-pendente', lead.id, { status, erro: null, categoria_erro: null })

      const { total } = await rodar([lead], [fila])

      expect(total).toBe(0)
      expect(lead.status).toBe('encaminhado_recuperacao')
      expect(fila.status).toBe(status)
      expect(fetchDigisac).not.toHaveBeenCalled()
    })

    it('uma fila terminal + outra ainda com retry agendado: nao encerra', async () => {
      const lead = criarLead('lead-parcial')
      const erro = criarFila('fila-a', lead.id)
      const retry = criarFila('fila-b', lead.id, { status: 'agendado', erro: null, categoria_erro: null })

      const { total } = await rodar([lead], [erro, retry])

      expect(total).toBe(0)
      expect(lead.status).toBe('encaminhado_recuperacao')
      expect(erro.status).toBe('erro')
    })

    it('fila terminal mas com message id (pode ter sido entregue): nao encerra', async () => {
      const lead = criarLead('lead-com-message-id')
      const fila = criarFila('fila-com-id', lead.id, { digisac_message_id: 'msg-1' })

      const { total } = await rodar([lead], [fila])

      expect(total).toBe(0)
      expect(lead.status).toBe('encaminhado_recuperacao')
    })

    it('lead sem nenhuma fila: nao encerra (nada a concluir)', async () => {
      const lead = criarLead('lead-sem-fila')

      const { total } = await rodar([lead], [])

      expect(total).toBe(0)
      expect(lead.status).toBe('encaminhado_recuperacao')
    })

    it('cliente realmente em atendimento (ticket aberto de outro atendimento nas lojas): nao encerra e preserva a fila cancelada', async () => {
      const lead = criarLead('lead-em-atendimento')
      const fila = criarFila('fila-atendimento', lead.id, {
        status: 'cancelado', erro: null, categoria_erro: null, motivo_cancelamento: 'cliente_em_atendimento',
      })
      simularTicketsNasLojas([{ id: 'ticket-do-cliente', isOpen: true, startedAt: '2026-09-19T14:20:00.000Z' }])

      const { total } = await rodar([lead], [fila])

      expect(total).toBe(0)
      expect(lead.status).toBe('encaminhado_recuperacao')
      expect(fila).toMatchObject({ status: 'cancelado', motivo_cancelamento: 'cliente_em_atendimento' })
    })

    it('ticket do robo que ja nao esta intacto (atendente assumiu): continua contando como atendimento', async () => {
      const lead = criarLead('lead-robo-assumido')
      const fila = criarFila('fila-robo-assumido', lead.id, {
        status: 'cancelado', erro: null, categoria_erro: null, motivo_cancelamento: 'cliente_em_atendimento',
        digisac_ticket_id: 'ticket-robo', digisac_contact_id: 'contato-1',
      })
      simularTicketsNasLojas([{ id: 'ticket-robo', isOpen: true, startedAt: '2026-09-19T14:18:03.754Z' }])
      verificarTicketRoboMock.mockResolvedValue({ reutilizavel: false, motivo: 'ticket_com_atendente' })

      const { total } = await rodar([lead], [fila])

      expect(total).toBe(0)
      expect(lead.status).toBe('encaminhado_recuperacao')
    })

    it('cliente que voltou a conversar (ticket ja FECHADO nas lojas desde a entrada): nao encerra', async () => {
      const lead = criarLead('lead-voltou')
      const fila = criarFila('fila-voltou', lead.id)
      // Ticket fechado, iniciado depois da janela de conversao de 24h: nao e "conversao" nem "aberto", mas e atividade.
      simularTicketsNasLojas([{ id: 'ticket-antigo', isOpen: false, startedAt: '2026-09-10T12:00:00.000Z' }])

      const { total } = await rodar([lead], [fila])

      expect(total).toBe(0)
      expect(lead.status).toBe('encaminhado_recuperacao')
      expect(fila.status).toBe('erro')
    })

    it('falha ao consultar o DigiSac: mantem o lead (nao encerra por duvida) e nao propaga excecao', async () => {
      const lead = criarLead('lead-digisac-fora')
      const fila = criarFila('fila-digisac-fora', lead.id)
      vi.mocked(fetchDigisac).mockRejectedValue(new Error('Digisac Request Timeout (30s)'))

      const { total } = await rodar([lead], [fila])

      expect(total).toBe(0)
      expect(lead.status).toBe('encaminhado_recuperacao')
      expect(fila.status).toBe('erro')
    })

    it('fila reprocessada entre a leitura e o encerramento: nao encerra o lead', async () => {
      const lead = criarLead('lead-reprocessado')
      const fila = criarFila('fila-reprocessada', lead.id)
      const supabase = criarSupabaseFake([lead], [fila])
      // Simula o operador reprocessando a fila logo depois da consulta ao DigiSac.
      vi.mocked(fetchDigisac).mockImplementation(async () => {
        fila.status = 'agendado'
        return { data: [] }
      })

      const total = await encerrarLeadsSemAcaoValidaHubVendas(supabase as never, PARAMETROS, AGORA)

      expect(total).toBe(0)
      expect(lead.status).toBe('encaminhado_recuperacao')
      expect(fila.status).toBe('agendado')
    })
  })

  describe('nao mexe em leads de outros estados', () => {
    it.each([
      'aguardando_conversao', 'convertido_organicamente', 'cliente_em_atendimento',
      'recuperacao_enviada', 'recuperado', 'fila_manual', 'encerrado',
    ])('lead %s permanece intacto', async (status) => {
      const lead = criarLead('lead-outro', { status })
      const fila = criarFila('fila-outro', lead.id)

      const { total } = await rodar([lead], [fila])

      expect(total).toBe(0)
      expect(lead.status).toBe(status)
      expect(fila.status).toBe('erro')
    })
  })

  it('idempotente: segunda execucao nao altera nada e o lead nao volta ao estado intermediario', async () => {
    const lead = criarLead('lead-idem')
    const fila = criarFila('fila-idem', lead.id)
    const supabase = criarSupabaseFake([lead], [fila])

    const primeira = await encerrarLeadsSemAcaoValidaHubVendas(supabase as never, PARAMETROS, AGORA)
    const dataPrimeira = lead.data_fila_manual
    const segunda = await encerrarLeadsSemAcaoValidaHubVendas(supabase as never, PARAMETROS, new Date('2026-09-22T15:00:00.000Z'))

    expect(primeira).toBe(1)
    expect(segunda).toBe(0)
    expect(lead.status).toBe('fila_manual')
    expect(lead.data_fila_manual).toBe(dataPrimeira)
  })

  it('limita a quantidade de leads avaliados por execucao (protege o DigiSac)', async () => {
    const leads = Array.from({ length: 15 }, (_, i) => criarLead(`lead-${i}`))
    const filas = leads.map((lead, i) => criarFila(`fila-${i}`, lead.id))

    const { total } = await rodar(leads, filas)

    expect(total).toBe(10)
    expect(leads.filter((lead) => lead.status === 'fila_manual')).toHaveLength(10)
    expect(leads.filter((lead) => lead.status === 'encaminhado_recuperacao')).toHaveLength(5)
  })
})
