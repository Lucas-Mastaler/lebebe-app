import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processarFilaRecuperacaoHubVendas } from './processar-fila'

const envioMocks = vi.hoisted(() => ({
  buscarContatoResgatePorTelefone: vi.fn(),
  garantirContatoResgateHubVendas: vi.fn(),
  buscarTicketAbertoContato: vi.fn(),
  abrirTicketResgateHubVendas: vi.fn(),
  enviarMensagemResgateHubVendas: vi.fn(),
}))

vi.mock('./envio', async () => {
  const crypto = await import('node:crypto')
  return {
    ...envioMocks,
    hashTextoHubVendas: (texto: string) => crypto.createHash('sha256').update(texto).digest('hex'),
    mascararTextoParaResposta: (texto: string) => `${texto.slice(0, 8)}...[${texto.length}]`,
  }
})

vi.mock('./preparar-fila', () => ({
  analisarReconciliacaoLead: vi.fn().mockResolvedValue({ resultado: 'ignorado', conversoes: [] }),
}))

const FILA_ID = '2afa6d30-2a17-46fe-b968-3d412bcaf0f3'
const LEAD_ID = 'da772a09-dcf0-4476-a81d-86983d7ac624'
const PORTAO_ID = 'c60d720f-5ad5-4a1b-bedb-e51495dee686'

type LeadRow = {
  id: string
  telefone_normalizado_ddi: string
  data_entrada_hub: string
  status: string
  nome_contato_hub: string | null
}

type FilaRow = {
  id: string
  lead_id: string
  conexao_destino_id: string
  conexao_destino_nome: string | null
  status: string
  programado_para: string
  reservado_em: string | null
  reservado_por: string | null
  requisicao_iniciada_em: string | null
  requisicao_finalizada_em: string | null
  enviado_em: string | null
  resultado: string | null
  erro: string | null
  categoria_erro: string | null
  motivo_cancelamento: string | null
  versao_mensagem: number | null
  texto_enviado: string | null
  hash_texto_enviado: string | null
  digisac_message_id: string | null
  digisac_contact_id: string | null
  digisac_ticket_id: string | null
  ultima_reconciliacao_em: string | null
  quantidade_reconciliacoes: number
  tentativas_envio: number
  created_at: string
  updated_at: string
}

function criarFila(overrides: Partial<FilaRow> = {}): FilaRow {
  return {
    id: FILA_ID,
    lead_id: LEAD_ID,
    conexao_destino_id: PORTAO_ID,
    conexao_destino_nome: 'Portao',
    status: 'agendado',
    programado_para: '2026-07-29T19:30:00.000Z',
    reservado_em: null,
    reservado_por: null,
    requisicao_iniciada_em: null,
    requisicao_finalizada_em: null,
    enviado_em: null,
    resultado: null,
    erro: null,
    categoria_erro: null,
    motivo_cancelamento: null,
    versao_mensagem: null,
    texto_enviado: null,
    hash_texto_enviado: null,
    digisac_message_id: null,
    digisac_contact_id: null,
    digisac_ticket_id: null,
    ultima_reconciliacao_em: null,
    quantidade_reconciliacoes: 1,
    tentativas_envio: 0,
    created_at: '2026-07-29T19:05:11.000Z',
    updated_at: '2026-07-29T19:24:49.000Z',
    ...overrides,
  }
}

function criarSupabaseFake(options: { automacaoAtiva?: boolean; pausada?: boolean; mensagensAtivas?: boolean } = {}) {
  const state = {
    filas: [criarFila()],
    leads: [{
      id: LEAD_ID,
      telefone_normalizado_ddi: '5541999999161',
      data_entrada_hub: '2026-07-29T18:49:44.117Z',
      status: 'encaminhado_recuperacao',
      nome_contato_hub: 'Cliente Teste',
    }] as LeadRow[],
    rpcCalls: [] as Array<{ fn: string; params: Record<string, unknown> }>,
    config: [
      {
        chave: 'automacao',
        valor: {
          ativa: options.automacaoAtiva ?? false,
          pausada: options.pausada ?? true,
          motivo: 'Fase 1',
        },
      },
      { chave: 'parametros', valor: { pausa_automatica_erros: 3 } },
      { chave: 'pausas_conexoes', valor: { [PORTAO_ID]: { nome: 'Portao', pausada: false, erros_consecutivos: 0 } } },
      {
        chave: 'mensagens_recuperacao',
        valor: {
          versoes: [
            { id: 'direta', nome: 'Direta', ordem: 1, ativa: options.mensagensAtivas ?? true, texto: 'Ola [LOJA], podemos ajudar?' },
          ],
        },
      },
    ],
  }

  class Builder {
    private filters: Record<string, unknown> = {}
    private inFilters: Record<string, unknown[]> = {}

    constructor(private table: string) {}

    select() {
      return this
    }

    eq(column: string, value: unknown) {
      this.filters[column] = value
      return this
    }

    in(column: string, values: unknown[]) {
      this.inFilters[column] = values
      return this
    }

    lte(column: string, value: unknown) {
      this.filters[`${column}__lte`] = value
      return this
    }

    order() {
      return this
    }

    limit() {
      return this
    }

    then(resolve: (value: unknown) => void, reject: (reason?: unknown) => void) {
      Promise.resolve(this.execute()).then(resolve, reject)
    }

    private execute() {
      if (this.table === 'hub_vendas_config') {
        const keys = this.inFilters.chave as string[] | undefined
        return { data: keys ? state.config.filter((row) => keys.includes(row.chave)) : state.config, error: null }
      }
      if (this.table === 'hub_vendas_recuperacao_fila') {
        let data = [...state.filas]
        if (this.filters.id) data = data.filter((fila) => fila.id === this.filters.id)
        if (this.filters.status) data = data.filter((fila) => fila.status === this.filters.status)
        if (this.filters.programado_para__lte) {
          data = data.filter((fila) => fila.programado_para <= String(this.filters.programado_para__lte))
        }
        return { data, error: null }
      }
      if (this.table === 'hub_vendas_leads') {
        let data = [...state.leads]
        if (this.filters.id) data = data.filter((lead) => lead.id === this.filters.id)
        return { data, error: null }
      }
      return { data: [], error: null }
    }
  }

  return {
    state,
    from(table: string) {
      return new Builder(table)
    },
    rpc(fn: string, params: Record<string, unknown>) {
      state.rpcCalls.push({ fn, params })
      const fila = state.filas.find((item) => item.id === (params.p_fila_id ?? FILA_ID))
      if (!fila) return Promise.resolve({ data: null, error: null })

      if (fn === 'hub_vendas_reservar_filas_recuperacao') {
        if (fila.status !== 'agendado') return Promise.resolve({ data: [], error: null })
        fila.status = 'reservado'
        fila.reservado_por = String(params.p_worker)
        return Promise.resolve({ data: [fila], error: null })
      }
      if (fn === 'hub_vendas_marcar_fila_enviando') {
        fila.status = 'enviando'
        fila.digisac_contact_id = String(params.p_digisac_contact_id)
        fila.digisac_ticket_id = params.p_digisac_ticket_id as string | null
        fila.versao_mensagem = Number(params.p_versao_mensagem)
        fila.texto_enviado = String(params.p_texto_enviado)
        fila.hash_texto_enviado = String(params.p_hash_texto_enviado)
        fila.tentativas_envio += 1
        return Promise.resolve({ data: fila, error: null })
      }
      if (fn === 'hub_vendas_confirmar_fila_enviada') {
        if (!params.p_digisac_message_id || String(params.p_digisac_message_id).trim() === '') {
          return Promise.resolve({ data: null, error: { message: 'hub_vendas_digisac_message_id_obrigatorio' } })
        }
        fila.status = 'enviado'
        fila.digisac_message_id = params.p_digisac_message_id as string | null
        fila.enviado_em = '2026-07-29T19:31:00.000Z'
        state.leads[0].status = 'recuperacao_enviada'
        return Promise.resolve({ data: fila, error: null })
      }
      if (fn === 'hub_vendas_cancelar_fila_reservada') {
        fila.status = 'cancelado'
        fila.motivo_cancelamento = String(params.p_motivo)
        return Promise.resolve({ data: fila, error: null })
      }
      if (fn === 'hub_vendas_registrar_resultado_incerto') {
        fila.status = 'resultado_incerto'
        fila.categoria_erro = String(params.p_categoria)
        return Promise.resolve({ data: fila, error: null })
      }
      if (fn === 'hub_vendas_registrar_erro_fila') {
        if (fila.status === 'reservado') {
          fila.tentativas_envio += 1
        }
        fila.status = params.p_retentavel ? 'agendado' : 'erro'
        fila.categoria_erro = String(params.p_categoria)
        return Promise.resolve({ data: fila, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    },
  }
}

describe('processarFilaRecuperacaoHubVendas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    envioMocks.buscarContatoResgatePorTelefone.mockResolvedValue(null)
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({ contactId: 'contact-1', criado: false })
    envioMocks.buscarTicketAbertoContato.mockResolvedValue(null)
    envioMocks.abrirTicketResgateHubVendas.mockResolvedValue({ ticketId: 'ticket-1', transferido: true })
    envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: true, messageId: 'message-1', ticketId: 'ticket-1', contactId: 'contact-1' })
  })

  it('mantem processamento global bloqueado com automacao pausada', async () => {
    const supabase = criarSupabaseFake({ automacaoAtiva: false, pausada: true })

    const resultado = await processarFilaRecuperacaoHubVendas({ supabase: supabase as never })

    expect(resultado).toMatchObject({ ok: true, automacaoAtiva: false, pausada: true, totalReservado: 0 })
    expect(supabase.state.rpcCalls).toHaveLength(0)
  })

  it('dry-run isolado nao reserva nem altera fila', async () => {
    envioMocks.buscarContatoResgatePorTelefone.mockResolvedValue(null)
    const supabase = criarSupabaseFake({ mensagensAtivas: true })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      modoSimulacao: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalReservado).toBe(0)
    expect(resultado.detalhes[0]).toMatchObject({ filaId: FILA_ID, acao: 'enviaria', versaoMensagem: 1 })
    expect(supabase.state.filas[0].status).toBe('agendado')
    expect(supabase.state.rpcCalls).toHaveLength(0)
    expect(envioMocks.garantirContatoResgateHubVendas).not.toHaveBeenCalled()
  })

  it('processa uma fila isolada e confirma envio sem tocar outras filas', async () => {
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({ contactId: 'contact-1', criado: false })
    envioMocks.buscarTicketAbertoContato.mockResolvedValue(null)
    envioMocks.abrirTicketResgateHubVendas.mockResolvedValue({ ticketId: 'ticket-1', transferido: true })
    envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: true, messageId: 'message-1', ticketId: 'ticket-1', contactId: 'contact-1' })
    const supabase = criarSupabaseFake({ mensagensAtivas: true })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalReservado).toBe(1)
    expect(resultado.totalEnviado).toBe(1)
    expect(supabase.state.filas[0]).toMatchObject({ status: 'enviado', digisac_message_id: 'message-1', versao_mensagem: 1 })
    expect(supabase.state.leads[0].status).toBe('recuperacao_enviada')
  })

  it('marca resultado incerto em timeout sem retry automatico cego', async () => {
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({ contactId: 'contact-1', criado: false })
    envioMocks.buscarTicketAbertoContato.mockResolvedValue(null)
    envioMocks.abrirTicketResgateHubVendas.mockResolvedValue({ ticketId: 'ticket-1', transferido: true })
    envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: false, status: null, erro: 'Digisac Request Timeout (30s)', resultadoIncerto: true })
    const supabase = criarSupabaseFake({ mensagensAtivas: true })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalResultadoIncerto).toBe(1)
    expect(supabase.state.filas[0].status).toBe('resultado_incerto')
  })

  it('nao confirma enviado quando resposta ok vem sem messageId', async () => {
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({ contactId: 'contact-1', criado: false })
    envioMocks.buscarTicketAbertoContato.mockResolvedValue(null)
    envioMocks.abrirTicketResgateHubVendas.mockResolvedValue({ ticketId: 'ticket-1', transferido: true })
    envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: true, messageId: null, ticketId: 'ticket-1', contactId: 'contact-1' })
    const supabase = criarSupabaseFake({ mensagensAtivas: true })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalResultadoIncerto).toBe(1)
    expect(resultado.detalhes[0]).toMatchObject({ acao: 'resultado_incerto', motivo: 'digisac_message_id_ausente' })
    expect(supabase.state.filas[0]).toMatchObject({ status: 'resultado_incerto', digisac_message_id: null })
    expect(supabase.state.rpcCalls.some((call) => call.fn === 'hub_vendas_confirmar_fila_enviada')).toBe(false)
  })

  it('agenda retry para erro retentavel antes do envio confirmado', async () => {
    envioMocks.garantirContatoResgateHubVendas.mockRejectedValue(new Error('contato_criacao_falhou status=429'))
    const supabase = criarSupabaseFake({ mensagensAtivas: true })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalRetryAgendado).toBe(1)
    expect(supabase.state.filas[0]).toMatchObject({ status: 'agendado', categoria_erro: 'rate_limit' })
  })

  it('bloqueia envio quando nenhuma mensagem esta ativa', async () => {
    const supabase = criarSupabaseFake({ mensagensAtivas: false })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalErro).toBe(1)
    expect(supabase.state.filas[0]).toMatchObject({ status: 'erro', categoria_erro: 'configuracao' })
  })
})
