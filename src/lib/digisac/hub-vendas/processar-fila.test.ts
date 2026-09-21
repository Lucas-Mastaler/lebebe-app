import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processarFilaRecuperacaoHubVendas } from './processar-fila'
import { alertarErroEnvio, alertarResultadoIncerto } from './alertas'
import { analisarReconciliacaoLead } from './preparar-fila'

const envioMocks = vi.hoisted(() => ({
  buscarContatoResgatePorTelefone: vi.fn(),
  garantirContatoResgateHubVendas: vi.fn(),
  buscarTicketAbertoContato: vi.fn(),
  buscarTicketResgatePorId: vi.fn(),
  abrirTicketResgateHubVendas: vi.fn(),
  enviarMensagemResgateHubVendas: vi.fn(),
  verificarTicketRoboReutilizavel: vi.fn(),
  consultarEntregaAposFalhaHttp: vi.fn(),
  contatoDigisacMarcadoInvalido: vi.fn(),
}))
const buscarContatoCompletoMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/digisac/contatos', () => ({
  buscarContatoCompleto: buscarContatoCompletoMock,
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

vi.mock('./alertas', () => ({
  alertarAnaliseManual: vi.fn().mockResolvedValue(undefined),
  alertarErroEnvio: vi.fn().mockResolvedValue(undefined),
  alertarResultadoIncerto: vi.fn().mockResolvedValue(undefined),
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
  digisac_contact_id_hub: string | null
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
  digisac_protocolo: string | null
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
    digisac_protocolo: null,
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
      digisac_contact_id_hub: 'contact-hub',
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
            { id: 'direta', nome: 'Direta', ordem: 1, ativa: options.mensagensAtivas ?? true, texto: 'Olá, [NOME]!\n\nAqui é da Le Bébé [LOJA].' },
          ],
        },
      },
    ],
  }

  class Builder {
    private filters: Record<string, unknown> = {}
    private inFilters: Record<string, unknown[]> = {}
    private updates: Record<string, unknown> | null = null

    constructor(private table: string) {}

    select() {
      return this
    }

    update(values: Record<string, unknown>) {
      this.updates = values
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

    gte(column: string, value: unknown) {
      this.filters[`${column}__gte`] = value
      return this
    }

    lt(column: string, value: unknown) {
      this.filters[`${column}__lt`] = value
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
        if (this.filters.reservado_por) data = data.filter((fila) => fila.reservado_por === this.filters.reservado_por)
        if (this.filters.programado_para__lte) {
          data = data.filter((fila) => fila.programado_para <= String(this.filters.programado_para__lte))
        }
        if (this.updates) {
          for (const fila of data) Object.assign(fila, this.updates)
        }
        return { data, error: null }
      }
      if (this.table === 'hub_vendas_leads') {
        let data = [...state.leads]
        if (this.filters.id) data = data.filter((lead) => lead.id === this.filters.id)
        return { data, error: null }
      }
      if (this.table === 'hub_vendas_alertas') {
        return { data: [], error: null }
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
    buscarContatoCompletoMock.mockResolvedValue({
      name: 'Cliente Teste',
      data: { number: '+55 (41) 99999-9161' },
    })
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({
      contactId: 'contact-1',
      criado: false,
      nomeContatoBruto: 'MARIA EDUARDA SILVA',
      origemNomeBruto: 'contato_destino_existente',
    })
    envioMocks.buscarTicketAbertoContato.mockResolvedValue(null)
    envioMocks.verificarTicketRoboReutilizavel.mockResolvedValue({ reutilizavel: false, motivo: 'nao_configurado_no_teste' })
    envioMocks.consultarEntregaAposFalhaHttp.mockResolvedValue('desconhecida')
    envioMocks.contatoDigisacMarcadoInvalido.mockResolvedValue(false)
    envioMocks.abrirTicketResgateHubVendas.mockResolvedValue({ ticketId: 'ticket-1', protocolo: '123456', transferido: true })
    envioMocks.buscarTicketResgatePorId.mockResolvedValue({ ticketId: 'ticket-1', protocolo: '123456', transferido: false })
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
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({
      contactId: 'contact-1',
      criado: false,
      nomeContatoBruto: 'MARIA EDUARDA SILVA',
      origemNomeBruto: 'contato_destino_existente',
    })
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
    expect(supabase.state.filas[0]).toMatchObject({
      status: 'enviado',
      digisac_message_id: 'message-1',
      digisac_protocolo: '123456',
      versao_mensagem: 1,
      texto_enviado: 'Olá, Maria!\n\nAqui é da Le Bébé Portão.',
    })
    expect(resultado.detalhes[0]).toMatchObject({
      nomeUtilizado: 'Maria',
      origemNome: 'contato_destino_existente',
      fallbackNome: false,
      lojaExibicao: 'Portão',
    })
    expect(supabase.state.leads[0].status).toBe('recuperacao_enviada')
  })

  it('usa nome persistido no lead quando o contato ainda nao existe na loja', async () => {
    const supabase = criarSupabaseFake({ mensagensAtivas: true })
    supabase.state.leads[0].nome_contato_hub = 'M\u00ea Mastaler'
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({
      contactId: 'contact-1',
      criado: true,
      nomeContatoBruto: 'M\u00ea Mastaler',
      origemNomeBruto: 'lead_persistido',
    })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(envioMocks.garantirContatoResgateHubVendas).toHaveBeenCalledWith({
      telefoneNormalizadoDDI: '5541999999161',
      serviceId: PORTAO_ID,
      nomeContato: 'M\u00ea Mastaler',
    })
    expect(supabase.state.filas[0].texto_enviado).toBe('Ol\u00e1, M\u00ea!\n\nAqui \u00e9 da Le B\u00e9b\u00e9 Port\u00e3o.')
    expect(supabase.state.filas[0].texto_enviado).not.toContain('[NOME]')
    expect(resultado.detalhes[0]).toMatchObject({
      contato: 'criado',
      nomeUtilizado: 'M\u00ea',
      origemNome: 'lead_persistido',
      fallbackNome: false,
    })
  })

  it('usa nome de perfil WhatsApp do contato Hub quando nome salvo no lead e invalido', async () => {
    const supabase = criarSupabaseFake({ mensagensAtivas: true })
    supabase.state.leads[0].nome_contato_hub = 'Cliente'
    buscarContatoCompletoMock.mockResolvedValue({
      name: 'Cliente',
      data: {
        number: '+55 (41) 99999-9161',
        pushName: 'M\u00ea Mastaler',
      },
    })
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({
      contactId: 'contact-1',
      criado: true,
      nomeContatoBruto: 'M\u00ea Mastaler',
      origemNomeBruto: 'lead_persistido',
    })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(envioMocks.garantirContatoResgateHubVendas).toHaveBeenCalledWith(expect.objectContaining({
      nomeContato: 'M\u00ea Mastaler',
    }))
    expect(supabase.state.filas[0].texto_enviado).toBe('Ol\u00e1, M\u00ea!\n\nAqui \u00e9 da Le B\u00e9b\u00e9 Port\u00e3o.')
    expect(resultado.detalhes[0]).toMatchObject({
      nomeUtilizado: 'M\u00ea',
      origemNome: 'perfil_whatsapp',
      fallbackNome: false,
    })
  })

  it('usa fallback natural quando contato nao tem nome valido', async () => {
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({
      contactId: 'contact-1',
      criado: false,
      nomeContatoBruto: 'Cliente',
      origemNomeBruto: 'contato_destino_existente',
    })
    const supabase = criarSupabaseFake({ mensagensAtivas: true })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalEnviado).toBe(1)
    expect(supabase.state.filas[0].texto_enviado).toBe('Olá!\n\nAqui é da Le Bébé Portão.')
    expect(resultado.detalhes[0]).toMatchObject({
      nomeUtilizado: null,
      origemNome: 'indisponivel',
      fallbackNome: true,
      lojaExibicao: 'Portão',
    })
  })

  it('dry-run mostra nome e loja sem alterar banco nem criar contato', async () => {
    envioMocks.buscarContatoResgatePorTelefone.mockResolvedValue({
      contactId: 'contact-1',
      criado: false,
      nomeContatoBruto: 'JOÃO PEDRO',
      origemNomeBruto: 'contato_destino_existente',
    })
    const supabase = criarSupabaseFake({ mensagensAtivas: true })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      modoSimulacao: true,
      workerId: 'worker-teste',
    })

    expect(resultado.detalhes[0]).toMatchObject({
      acao: 'enviaria',
      nomeUtilizado: 'João',
      origemNome: 'contato_destino_existente',
      fallbackNome: false,
      lojaExibicao: 'Portão',
    })
    expect(supabase.state.filas[0].status).toBe('agendado')
    expect(envioMocks.garantirContatoResgateHubVendas).not.toHaveBeenCalled()
    expect(envioMocks.enviarMensagemResgateHubVendas).not.toHaveBeenCalled()
  })

  it('retry reutiliza texto e hash persistidos sem recalcular nome', async () => {
    const textoPersistido = 'Olá, Ana!\n\nAqui é da Le Bébé Portão.'
    const hashPersistido = 'a'.repeat(64)
    const supabase = criarSupabaseFake({ mensagensAtivas: false })
    supabase.state.filas[0] = criarFila({
      texto_enviado: textoPersistido,
      hash_texto_enviado: hashPersistido,
      versao_mensagem: 1,
    })
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({
      contactId: 'contact-1',
      criado: false,
      nomeContatoBruto: 'MARIA NOVA',
      origemNomeBruto: 'contato_destino_existente',
    })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalEnviado).toBe(1)
    expect(supabase.state.filas[0]).toMatchObject({
      texto_enviado: textoPersistido,
      hash_texto_enviado: hashPersistido,
      versao_mensagem: 1,
    })
    expect(resultado.detalhes[0]).toMatchObject({
      hashTexto: hashPersistido,
      reutilizouTextoPersistido: true,
    })
  })

  it('bloqueia placeholder persistido antes de consultar ticket ou enviar mensagem', async () => {
    const supabase = criarSupabaseFake({ mensagensAtivas: false })
    supabase.state.filas[0] = criarFila({
      texto_enviado: 'OlÃ¡, [NOME]!\n\nAqui Ã© da Le BÃ©bÃ© PortÃ£o.',
      hash_texto_enviado: 'b'.repeat(64),
      versao_mensagem: 1,
    })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalAnaliseManual).toBe(1)
    expect(resultado.totalEnviado).toBe(0)
    expect(supabase.state.filas[0]).toMatchObject({
      status: 'analise_manual',
      categoria_erro: 'placeholder_nao_resolvido',
    })
    expect(resultado.detalhes[0]).toMatchObject({
      acao: 'analise_manual',
      motivo: 'placeholder_nao_resolvido',
      placeholdersPendentes: ['[NOME]'],
    })
    expect(envioMocks.buscarTicketAbertoContato).not.toHaveBeenCalled()
    expect(envioMocks.enviarMensagemResgateHubVendas).not.toHaveBeenCalled()
  })

  it('marca resultado incerto em timeout sem retry automatico cego', async () => {
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({
      contactId: 'contact-1',
      criado: false,
      nomeContatoBruto: 'MARIA EDUARDA SILVA',
      origemNomeBruto: 'contato_destino_existente',
    })
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
    envioMocks.garantirContatoResgateHubVendas.mockResolvedValue({
      contactId: 'contact-1',
      criado: false,
      nomeContatoBruto: 'MARIA EDUARDA SILVA',
      origemNomeBruto: 'contato_destino_existente',
    })
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

  it('cancela antes de qualquer chamada ao DigiSac quando o telefone do lead nao e brasileiro valido (caso 55 34 6...)', async () => {
    const supabase = criarSupabaseFake({ mensagensAtivas: true })
    supabase.state.leads[0].telefone_normalizado_ddi = '5534612345678'

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalCancelado).toBe(1)
    expect(resultado.totalErro).toBe(0)
    expect(resultado.detalhes[0]).toMatchObject({ acao: 'cancelado', motivo: 'telefone_invalido' })
    expect(supabase.state.filas[0]).toMatchObject({ status: 'cancelado', motivo_cancelamento: 'telefone_invalido' })
    // Sem contato, sem ticket, sem envio, sem retry, sem erro de conexao, sem alerta de erro.
    expect(envioMocks.garantirContatoResgateHubVendas).not.toHaveBeenCalled()
    expect(envioMocks.abrirTicketResgateHubVendas).not.toHaveBeenCalled()
    expect(envioMocks.enviarMensagemResgateHubVendas).not.toHaveBeenCalled()
    expect(supabase.state.rpcCalls.map((call) => call.fn)).not.toContain('hub_vendas_registrar_erro_fila')
    expect(alertarErroEnvio).not.toHaveBeenCalled()
  })

  it('telefone brasileiro valido do lead segue o fluxo normal de envio', async () => {
    const supabase = criarSupabaseFake({ mensagensAtivas: true })

    const resultado = await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(resultado.totalEnviado).toBe(1)
    expect(supabase.state.filas[0].status).toBe('enviado')
  })

  describe('retry apos falha depois do transfer (ticket aberto pelo proprio robo)', () => {
    const TICKET_ROBO = { ticketId: 'ticket-robo', protocolo: '2026091976548', transferido: false }

    function criarFilaDeRetry(supabase: ReturnType<typeof criarSupabaseFake>) {
      supabase.state.filas[0] = criarFila({
        digisac_ticket_id: 'ticket-robo',
        digisac_contact_id: 'contact-1',
        tentativas_envio: 1,
        versao_mensagem: 1,
        texto_enviado: 'Olá, Ana!\n\nAqui é da Le Bébé Portão.',
        hash_texto_enviado: 'c'.repeat(64),
      })
    }

    async function processar(supabase: ReturnType<typeof criarSupabaseFake>) {
      return processarFilaRecuperacaoHubVendas({
        supabase: supabase as never,
        filaId: FILA_ID,
        modoTeste: true,
        workerId: 'worker-teste',
      })
    }

    it('reaproveita o ticket do robo (aberto, sem mensagens, sem atendente): nao vira cliente em atendimento e nao abre outro ticket', async () => {
      const supabase = criarSupabaseFake({ mensagensAtivas: false })
      criarFilaDeRetry(supabase)
      envioMocks.verificarTicketRoboReutilizavel.mockResolvedValue({ reutilizavel: true, ticket: TICKET_ROBO })
      envioMocks.buscarTicketAbertoContato.mockResolvedValue({ id: 'ticket-robo' })
      envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: true, messageId: 'message-1', ticketId: 'ticket-robo', contactId: 'contact-1' })

      const resultado = await processar(supabase)

      expect(envioMocks.verificarTicketRoboReutilizavel).toHaveBeenCalledWith({
        ticketId: 'ticket-robo',
        contactId: 'contact-1',
        serviceId: PORTAO_ID,
      })
      // O ticket do robo fica fora da reconciliacao (nem "atendimento", nem "conversao").
      expect(vi.mocked(analisarReconciliacaoLead).mock.calls[0][2]).toEqual({ ignorarTicketIds: ['ticket-robo'] })
      expect(envioMocks.abrirTicketResgateHubVendas).not.toHaveBeenCalled()
      expect(envioMocks.enviarMensagemResgateHubVendas).toHaveBeenCalledTimes(1)
      expect(resultado.totalEnviado).toBe(1)
      expect(supabase.state.filas[0]).toMatchObject({ status: 'enviado', digisac_ticket_id: 'ticket-robo', digisac_message_id: 'message-1' })
    })

    it('ticket com mensagem do cliente (nao reutilizavel): continua bloqueando como cliente em atendimento, sem envio', async () => {
      const supabase = criarSupabaseFake({ mensagensAtivas: false })
      criarFilaDeRetry(supabase)
      envioMocks.verificarTicketRoboReutilizavel.mockResolvedValue({ reutilizavel: false, motivo: 'ticket_com_mensagens' })
      vi.mocked(analisarReconciliacaoLead).mockResolvedValueOnce({ resultado: 'cliente_em_atendimento', conversoes: [] })

      const resultado = await processar(supabase)

      expect(vi.mocked(analisarReconciliacaoLead).mock.calls[0][2]).toBeUndefined()
      expect(resultado.totalCancelado).toBe(1)
      expect(supabase.state.filas[0]).toMatchObject({ status: 'cancelado', motivo_cancelamento: 'cliente_em_atendimento' })
      expect(envioMocks.abrirTicketResgateHubVendas).not.toHaveBeenCalled()
      expect(envioMocks.enviarMensagemResgateHubVendas).not.toHaveBeenCalled()
    })

    it('ticket assumido por atendente (nao reutilizavel): continua bloqueando', async () => {
      const supabase = criarSupabaseFake({ mensagensAtivas: false })
      criarFilaDeRetry(supabase)
      envioMocks.verificarTicketRoboReutilizavel.mockResolvedValue({ reutilizavel: false, motivo: 'ticket_com_atendente' })
      vi.mocked(analisarReconciliacaoLead).mockResolvedValueOnce({ resultado: 'cliente_em_atendimento', conversoes: [] })

      const resultado = await processar(supabase)

      expect(resultado.totalCancelado).toBe(1)
      expect(envioMocks.enviarMensagemResgateHubVendas).not.toHaveBeenCalled()
    })

    it('cliente com OUTRO ticket aberto na loja mesmo havendo ticket reutilizavel do robo: cancela e nao envia', async () => {
      const supabase = criarSupabaseFake({ mensagensAtivas: false })
      criarFilaDeRetry(supabase)
      envioMocks.verificarTicketRoboReutilizavel.mockResolvedValue({ reutilizavel: true, ticket: TICKET_ROBO })
      envioMocks.buscarTicketAbertoContato.mockResolvedValue({ id: 'ticket-aberto-pelo-cliente' })

      const resultado = await processar(supabase)

      expect(resultado.totalCancelado).toBe(1)
      expect(supabase.state.filas[0]).toMatchObject({ status: 'cancelado', motivo_cancelamento: 'chamado_aberto_na_conexao_destino' })
      expect(envioMocks.enviarMensagemResgateHubVendas).not.toHaveBeenCalled()
    })

    it('contato do retry diferente do contato do ticket anterior: nao reaproveita, abre ticket proprio para o contato atual', async () => {
      const supabase = criarSupabaseFake({ mensagensAtivas: false })
      criarFilaDeRetry(supabase)
      supabase.state.filas[0].digisac_contact_id = 'contact-antigo'
      envioMocks.verificarTicketRoboReutilizavel.mockResolvedValue({ reutilizavel: true, ticket: TICKET_ROBO })

      await processar(supabase)

      expect(envioMocks.abrirTicketResgateHubVendas).toHaveBeenCalledTimes(1)
    })

    it('primeira tentativa (sem ticket gravado) nao consulta ticket anterior e abre o ticket normalmente', async () => {
      const supabase = criarSupabaseFake({ mensagensAtivas: true })

      await processar(supabase)

      expect(envioMocks.verificarTicketRoboReutilizavel).not.toHaveBeenCalled()
      expect(envioMocks.abrirTicketResgateHubVendas).toHaveBeenCalledTimes(1)
    })

    it('fluxo completo do caso Hauer: falha no envio (500) agenda retry com ticket gravado; o retry reaproveita o ticket e envia UMA vez', async () => {
      const supabase = criarSupabaseFake({ mensagensAtivas: true })
      envioMocks.abrirTicketResgateHubVendas.mockResolvedValue({ ticketId: 'ticket-robo', protocolo: '2026091976548', transferido: true })
      envioMocks.enviarMensagemResgateHubVendas.mockResolvedValueOnce({
        ok: false,
        status: 500,
        erro: 'mensagem_api_erro status=500 body={"error":"HttpError","message":"[sendMessageToId] Message came out falsy"}',
        resultadoIncerto: true,
      })
      // Ticket do robo so com eventos de sistema: falha confirmada (nada foi entregue).
      envioMocks.consultarEntregaAposFalhaHttp.mockResolvedValueOnce('ausente')

      const primeira = await processar(supabase)

      expect(primeira.totalRetryAgendado).toBe(1)
      // O ID do ticket ficou gravado na fila (antes da correcao ficava nulo e o retry nao o reconhecia).
      expect(supabase.state.filas[0]).toMatchObject({ status: 'agendado', digisac_ticket_id: 'ticket-robo', digisac_contact_id: 'contact-1' })

      envioMocks.verificarTicketRoboReutilizavel.mockResolvedValue({ reutilizavel: true, ticket: { ...TICKET_ROBO } })
      envioMocks.buscarTicketAbertoContato.mockResolvedValue({ id: 'ticket-robo' })
      const segunda = await processar(supabase)

      expect(segunda.totalEnviado).toBe(1)
      expect(segunda.totalCancelado).toBe(0)
      expect(supabase.state.filas[0].status).toBe('enviado')
      // Um unico ticket aberto; a mensagem so foi entregue na 2a chamada (a 1a falhou antes da entrega).
      expect(envioMocks.abrirTicketResgateHubVendas).toHaveBeenCalledTimes(1)
      expect(envioMocks.enviarMensagemResgateHubVendas).toHaveBeenCalledTimes(2)
      expect(supabase.state.rpcCalls.filter((call) => call.fn === 'hub_vendas_confirmar_fila_enviada')).toHaveLength(1)
    })
  })

  describe('classificacao no fluxo: contato invalido, pre-envio e pos-envio', () => {
    const ERRO_FALSY = 'mensagem_api_erro status=500 body={"error":"HttpError","message":"[sendMessageToId] Message came out falsy for contact"}'

    async function processar(supabase: ReturnType<typeof criarSupabaseFake>) {
      return processarFilaRecuperacaoHubVendas({
        supabase: supabase as never,
        filaId: FILA_ID,
        modoTeste: true,
        workerId: 'worker-teste',
      })
    }

    function chamadaRegistroErro(supabase: ReturnType<typeof criarSupabaseFake>) {
      return supabase.state.rpcCalls.find((call) => call.fn === 'hub_vendas_registrar_erro_fila')
    }

    it('caso Hauer: 500 + contato com valid=false + ticket sem mensagens => erro DEFINITIVO contato_invalido, sem retry e sem afetar a conexao', async () => {
      envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: false, status: 500, erro: ERRO_FALSY, resultadoIncerto: true })
      envioMocks.consultarEntregaAposFalhaHttp.mockResolvedValue('ausente')
      envioMocks.contatoDigisacMarcadoInvalido.mockResolvedValue(true)
      const supabase = criarSupabaseFake({ mensagensAtivas: true })

      const resultado = await processar(supabase)

      expect(envioMocks.contatoDigisacMarcadoInvalido).toHaveBeenCalledWith('contact-1')
      expect(resultado).toMatchObject({ totalErro: 1, totalRetryAgendado: 0, totalResultadoIncerto: 0 })
      expect(supabase.state.filas[0]).toMatchObject({ status: 'erro', categoria_erro: 'contato_invalido' })
      expect(chamadaRegistroErro(supabase)?.params).toMatchObject({
        p_categoria: 'contato_invalido',
        p_retentavel: false,
        p_incrementa_erro_conexao: false,
      })
      expect(alertarErroEnvio).toHaveBeenCalledWith(expect.objectContaining({ retryAgendado: false, proximoRetry: null }))
      expect(envioMocks.enviarMensagemResgateHubVendas).toHaveBeenCalledTimes(1)
    })

    it('contato com valid=false tambem e definitivo quando a entrega ficou desconhecida (nao vira incerto)', async () => {
      envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: false, status: 500, erro: ERRO_FALSY, resultadoIncerto: true })
      envioMocks.consultarEntregaAposFalhaHttp.mockResolvedValue('desconhecida')
      envioMocks.contatoDigisacMarcadoInvalido.mockResolvedValue(true)
      const supabase = criarSupabaseFake({ mensagensAtivas: true })

      const resultado = await processar(supabase)

      expect(resultado).toMatchObject({ totalErro: 1, totalResultadoIncerto: 0 })
      expect(supabase.state.filas[0].categoria_erro).toBe('contato_invalido')
    })

    it('HTTP 4xx com contato valid=false: definitivo contato_invalido', async () => {
      envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: false, status: 422, erro: 'mensagem_api_erro status=422', resultadoIncerto: false })
      envioMocks.contatoDigisacMarcadoInvalido.mockResolvedValue(true)
      const supabase = criarSupabaseFake({ mensagensAtivas: true })

      await processar(supabase)

      expect(supabase.state.filas[0]).toMatchObject({ status: 'erro', categoria_erro: 'contato_invalido' })
    })

    it('mensagem de chat ja presente no ticket: continua INCERTO mesmo com contato valid=false (nunca afirma nao-entrega)', async () => {
      envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: false, status: 500, erro: ERRO_FALSY, resultadoIncerto: true })
      envioMocks.consultarEntregaAposFalhaHttp.mockResolvedValue('presente')
      envioMocks.contatoDigisacMarcadoInvalido.mockResolvedValue(true)
      const supabase = criarSupabaseFake({ mensagensAtivas: true })

      const resultado = await processar(supabase)

      expect(envioMocks.contatoDigisacMarcadoInvalido).not.toHaveBeenCalled()
      expect(resultado.totalResultadoIncerto).toBe(1)
      expect(supabase.state.filas[0].status).toBe('resultado_incerto')
    })

    it('mesmo erro 500 SEM evidencia de contato invalido (valid ausente/true): nao e contato_invalido; retry como erro de mensagem', async () => {
      envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: false, status: 500, erro: ERRO_FALSY, resultadoIncerto: true })
      envioMocks.consultarEntregaAposFalhaHttp.mockResolvedValue('ausente')
      envioMocks.contatoDigisacMarcadoInvalido.mockResolvedValue(false)
      const supabase = criarSupabaseFake({ mensagensAtivas: true })

      const resultado = await processar(supabase)

      expect(resultado.totalRetryAgendado).toBe(1)
      expect(supabase.state.filas[0]).toMatchObject({ status: 'agendado', categoria_erro: 'mensagem' })
      expect(chamadaRegistroErro(supabase)?.params).toMatchObject({ p_retentavel: true, p_incrementa_erro_conexao: true })
    })

    it('502/503/504 nao consultam validade do contato (resultado incerto direto)', async () => {
      envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: false, status: 503, erro: 'mensagem_api_erro status=503', resultadoIncerto: true })
      envioMocks.contatoDigisacMarcadoInvalido.mockResolvedValue(true)
      const supabase = criarSupabaseFake({ mensagensAtivas: true })

      const resultado = await processar(supabase)

      expect(envioMocks.contatoDigisacMarcadoInvalido).not.toHaveBeenCalled()
      expect(resultado.totalResultadoIncerto).toBe(1)
    })

    it('serverPod is not set na criacao do contato continua com retry (caso Bigorrilho 07/09)', async () => {
      envioMocks.garantirContatoResgateHubVendas.mockRejectedValue(
        new Error('contato_criacao_falhou status=500 body={"error":"HttpError","message":"[0973f84b] serverPod is not set.","status":500}'),
      )
      const supabase = criarSupabaseFake({ mensagensAtivas: true })

      const resultado = await processar(supabase)

      expect(resultado).toMatchObject({ totalRetryAgendado: 1, totalErro: 0 })
      expect(supabase.state.filas[0]).toMatchObject({ status: 'agendado', categoria_erro: 'indisponibilidade' })
      expect(chamadaRegistroErro(supabase)?.params).toMatchObject({ p_retentavel: true, p_incrementa_erro_conexao: false })
      expect(envioMocks.abrirTicketResgateHubVendas).not.toHaveBeenCalled()
    })

    it('rede/timeout ANTES do envio agenda retry e nao tenta gravar resultado incerto (o RPC so aceita fila em enviando)', async () => {
      envioMocks.garantirContatoResgateHubVendas.mockRejectedValue(new Error('fetch failed'))
      const supabase = criarSupabaseFake({ mensagensAtivas: true })

      const resultado = await processar(supabase)

      expect(resultado).toMatchObject({ totalRetryAgendado: 1, totalResultadoIncerto: 0 })
      expect(supabase.state.rpcCalls.map((call) => call.fn)).not.toContain('hub_vendas_registrar_resultado_incerto')
      expect(supabase.state.filas[0].status).toBe('agendado')
    })

    it('falha ao gravar a confirmacao DEPOIS de o POST ter sido aceito: resultado incerto (sem retry), com o messageId no registro', async () => {
      const supabase = criarSupabaseFake({ mensagensAtivas: true })
      const rpcOriginal = supabase.rpc.bind(supabase)
      supabase.rpc = ((fn: string, params: Record<string, unknown>) => (
        fn === 'hub_vendas_confirmar_fila_enviada'
          ? Promise.resolve({ data: null, error: { message: 'connection terminated unexpectedly' } })
          : rpcOriginal(fn, params)
      )) as typeof supabase.rpc

      const resultado = await processar(supabase)

      expect(resultado).toMatchObject({ totalResultadoIncerto: 1, totalRetryAgendado: 0, totalEnviado: 0 })
      expect(supabase.state.filas[0].status).toBe('resultado_incerto')
      expect(alertarResultadoIncerto).toHaveBeenCalledWith(expect.objectContaining({ erro: expect.stringContaining('message-1') }))
      expect(supabase.state.rpcCalls.map((call) => call.fn)).not.toContain('hub_vendas_registrar_erro_fila')
    })

    it('autenticacao invalida no envio: definitivo (sem retry) e conta contra a conexao', async () => {
      envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue({ ok: false, status: 401, erro: 'mensagem_api_erro status=401', resultadoIncerto: false })
      const supabase = criarSupabaseFake({ mensagensAtivas: true })

      const resultado = await processar(supabase)

      expect(resultado).toMatchObject({ totalErro: 1, totalRetryAgendado: 0 })
      expect(chamadaRegistroErro(supabase)?.params).toMatchObject({ p_categoria: 'autenticacao', p_retentavel: false, p_incrementa_erro_conexao: true })
    })
  })

  describe('POST /messages com erro HTTP: falha confirmada x resultado incerto', () => {
    async function processarComEnvio(envio: Record<string, unknown>) {
      envioMocks.enviarMensagemResgateHubVendas.mockResolvedValue(envio)
      const supabase = criarSupabaseFake({ mensagensAtivas: true })
      const resultado = await processarFilaRecuperacaoHubVendas({
        supabase: supabase as never,
        filaId: FILA_ID,
        modoTeste: true,
        workerId: 'worker-teste',
      })
      return { supabase, resultado }
    }

    const erro500 = { ok: false, status: 500, erro: 'mensagem_api_erro status=500', resultadoIncerto: true }

    it('500 com ticket sem nenhuma mensagem de chat: falha CONFIRMADA (retry permitido), nunca incerto', async () => {
      envioMocks.consultarEntregaAposFalhaHttp.mockResolvedValue('ausente')

      const { supabase, resultado } = await processarComEnvio(erro500)

      expect(envioMocks.consultarEntregaAposFalhaHttp).toHaveBeenCalledWith({ ticketId: 'ticket-1' })
      expect(resultado.totalResultadoIncerto).toBe(0)
      expect(resultado.totalRetryAgendado).toBe(1)
      expect(supabase.state.filas[0].status).toBe('agendado')
    })

    it('500 com mensagem de chat ja presente no ticket: resultado INCERTO, sem retry, com alerta', async () => {
      envioMocks.consultarEntregaAposFalhaHttp.mockResolvedValue('presente')

      const { supabase, resultado } = await processarComEnvio(erro500)

      expect(resultado.totalResultadoIncerto).toBe(1)
      expect(resultado.totalRetryAgendado).toBe(0)
      expect(supabase.state.filas[0].status).toBe('resultado_incerto')
      expect(alertarResultadoIncerto).toHaveBeenCalledTimes(1)
      expect(alertarErroEnvio).not.toHaveBeenCalled()
    })

    it('500 sem como confirmar (consulta falhou/ticket desconhecido): resultado INCERTO', async () => {
      envioMocks.consultarEntregaAposFalhaHttp.mockResolvedValue('desconhecida')

      const { supabase, resultado } = await processarComEnvio(erro500)

      expect(resultado.totalResultadoIncerto).toBe(1)
      expect(supabase.state.filas[0].status).toBe('resultado_incerto')
    })

    it.each([502, 503, 504, 408])('HTTP %i: resultado INCERTO direto, sem consultar (o backend pode ainda estar processando)', async (status) => {
      const { supabase, resultado } = await processarComEnvio({ ok: false, status, erro: `mensagem_api_erro status=${status}`, resultadoIncerto: true })

      expect(envioMocks.consultarEntregaAposFalhaHttp).not.toHaveBeenCalled()
      expect(resultado.totalResultadoIncerto).toBe(1)
      expect(supabase.state.filas[0].status).toBe('resultado_incerto')
    })

    it.each([400, 401, 403, 404, 422, 429])('HTTP %i (requisicao rejeitada): falha confirmada, nao e incerto e nao consulta', async (status) => {
      const { resultado } = await processarComEnvio({ ok: false, status, erro: `mensagem_api_erro status=${status}`, resultadoIncerto: false })

      expect(envioMocks.consultarEntregaAposFalhaHttp).not.toHaveBeenCalled()
      expect(resultado.totalResultadoIncerto).toBe(0)
      expect(alertarResultadoIncerto).not.toHaveBeenCalled()
    })

    it('fila em resultado_incerto nao e reservada de novo: sem 2o envio (sem duplicidade)', async () => {
      envioMocks.consultarEntregaAposFalhaHttp.mockResolvedValue('presente')
      const { supabase } = await processarComEnvio(erro500)
      expect(supabase.state.filas[0].status).toBe('resultado_incerto')

      const segunda = await processarFilaRecuperacaoHubVendas({
        supabase: supabase as never,
        filaId: FILA_ID,
        modoTeste: true,
        workerId: 'worker-teste-2',
      })

      expect(segunda.totalReservado).toBe(0)
      expect(envioMocks.enviarMensagemResgateHubVendas).toHaveBeenCalledTimes(1)
    })
  })

  it('alerta de erro informa retry agendado com o horario gravado pelo banco', async () => {
    envioMocks.garantirContatoResgateHubVendas.mockRejectedValue(new Error('contato_criacao_falhou status=429'))
    const supabase = criarSupabaseFake({ mensagensAtivas: true })

    await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(alertarErroEnvio).toHaveBeenCalledWith(expect.objectContaining({
      filaId: FILA_ID,
      retryAgendado: true,
      proximoRetry: supabase.state.filas[0].programado_para,
    }))
  })

  it('alerta de erro definitivo nao informa retry nem horario', async () => {
    const supabase = criarSupabaseFake({ mensagensAtivas: false })

    await processarFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      filaId: FILA_ID,
      modoTeste: true,
      workerId: 'worker-teste',
    })

    expect(alertarErroEnvio).toHaveBeenCalledWith(expect.objectContaining({
      filaId: FILA_ID,
      retryAgendado: false,
      proximoRetry: null,
    }))
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
