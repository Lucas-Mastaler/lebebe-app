import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/digisac/clienteDigisac', () => ({
  fetchDigisac: vi.fn(),
}))
vi.mock('./envio', () => ({
  verificarTicketRoboReutilizavel: vi.fn().mockResolvedValue({ reutilizavel: false, motivo: 'nao_configurado_no_teste' }),
}))

const { fetchDigisac } = await import('@/lib/digisac/clienteDigisac')
const { prepararFilaRecuperacaoHubVendas } = await import('./preparar-fila')

const PORTAO = 'c60d720f-5ad5-4a1b-bedb-e51495dee686'
const AGORA = new Date('2026-09-21T15:00:00.000Z') // segunda-feira, 12:00 em America/Sao_Paulo

// Colunas REAIS de public.hub_vendas_leads (confirmadas via MCP do Supabase). Note que NAO existem
// digisac_contact_id nem digisac_ticket_id: so as versoes *_hub (contato/ticket do Hub).
const COLUNAS_LEADS = new Set([
  'id', 'telefone_normalizado_ddi', 'telefone_normalizado', 'ciclo_numero', 'data_entrada_hub',
  'digisac_message_id_saudacao', 'digisac_contact_id_hub', 'digisac_ticket_id_hub', 'nome_contato_hub', 'status',
  'loja_principal', 'lojas_chamadas', 'chamou_mais_de_uma_loja', 'data_conversao', 'data_cliente_em_atendimento',
  'motivo_bloqueio_recuperacao', 'conexao_recuperacao_id', 'data_recuperacao_enviada', 'data_recuperacao_respondida',
  'created_at', 'updated_at', 'data_encerrado', 'data_fila_manual', 'digisac_protocolo_hub',
])
const COLUNAS_FILAS = new Set([
  'id', 'lead_id', 'conexao_destino_id', 'conexao_destino_nome', 'status', 'programado_para', 'reservado_em', 'reservado_por',
  'requisicao_iniciada_em', 'requisicao_finalizada_em', 'enviado_em', 'resultado', 'erro', 'categoria_erro', 'motivo_cancelamento',
  'versao_mensagem', 'texto_enviado', 'hash_texto_enviado', 'digisac_message_id', 'digisac_contact_id', 'digisac_ticket_id',
  'digisac_protocolo', 'ultima_reconciliacao_em', 'quantidade_reconciliacoes', 'tentativas_envio', 'created_at', 'updated_at',
])

type Linha = Record<string, unknown>

function criarLead(id: string, overrides: Linha = {}): Linha {
  return {
    id,
    telefone_normalizado_ddi: '5541996246875',
    telefone_normalizado: '41996246875',
    ciclo_numero: 1,
    data_entrada_hub: '2026-09-20T12:00:00.000Z', // 27h antes de AGORA: dentro da janela de 24h a 48h
    status: 'aguardando_conversao',
    nome_contato_hub: 'Cliente Teste',
    digisac_contact_id_hub: 'contato-do-hub',
    digisac_ticket_id_hub: 'ticket-do-hub',
    digisac_protocolo_hub: '2026092000001',
    conexao_recuperacao_id: null,
    loja_principal: null,
    lojas_chamadas: [],
    chamou_mais_de_uma_loja: false,
    data_conversao: null,
    data_cliente_em_atendimento: null,
    motivo_bloqueio_recuperacao: null,
    data_fila_manual: null,
    ...overrides,
  }
}

function criarSupabaseFakeEstrito(leads: Linha[], filas: Linha[] = []) {
  const atualizacoesDeLeads: Array<Record<string, unknown>> = []
  const rpcCalls: Array<{ fn: string; params: Record<string, unknown> }> = []
  const config = [
    { chave: 'automacao', valor: { ativa: true, pausada: false, motivo: 'teste' } },
    {
      chave: 'parametros',
      valor: {
        timezone: 'America/Sao_Paulo', dias_semana: [1, 2, 3, 4, 5, 6], horario_inicio: '09:00', horario_fim: '18:00',
        limite_diario_por_conexao: 6, limite_por_execucao: 5, intervalo_min_segundos: 180, intervalo_max_segundos: 180,
        elegibilidade_horas: 48, janela_conversao_horas: 24,
      },
    },
    { chave: 'pausas_conexoes', valor: {} },
    { chave: 'rodizio', valor: { ordem: [PORTAO], ultima_posicao: null, ultima_conexao_id: null } },
  ]

  class Builder {
    private filtros: Array<(linha: Linha) => boolean> = []
    private valores: Linha | null = null
    private head = false
    private retornaLinhas = false

    constructor(private tabela: string) {}

    select(_colunas?: string, opcoes?: { head?: boolean }) {
      this.head = opcoes?.head === true
      this.retornaLinhas = true
      return this
    }

    update(valores: Linha) {
      this.valores = valores
      this.retornaLinhas = false
      return this
    }

    eq(coluna: string, valor: unknown) { this.filtros.push((l) => l[coluna] === valor); return this }
    in(coluna: string, valores: unknown[]) { this.filtros.push((l) => valores.includes(l[coluna])); return this }
    lte(coluna: string, valor: string) { this.filtros.push((l) => String(l[coluna]) <= valor); return this }
    lt(coluna: string, valor: string) { this.filtros.push((l) => String(l[coluna]) < valor); return this }
    gt(coluna: string, valor: string) { this.filtros.push((l) => String(l[coluna]) > valor); return this }
    gte(coluna: string, valor: string) { this.filtros.push((l) => String(l[coluna]) >= valor); return this }
    is(coluna: string, valor: unknown) { this.filtros.push((l) => (valor === null ? l[coluna] == null : l[coluna] === valor)); return this }
    order() { return this }
    limit() { return this }

    then(resolve: (valor: unknown) => void, reject: (motivo?: unknown) => void) {
      Promise.resolve(this.executar()).then(resolve, reject)
    }

    private executar() {
      if (this.tabela === 'hub_vendas_config') return { data: config, error: null }
      const origem = this.tabela === 'hub_vendas_leads' ? leads : this.tabela === 'hub_vendas_recuperacao_fila' ? filas : []
      const colunasReais = this.tabela === 'hub_vendas_leads' ? COLUNAS_LEADS : COLUNAS_FILAS

      if (this.valores) {
        // Igual ao PostgREST: coluna inexistente => 400 PGRST204, mesmo sem nenhuma linha afetada.
        const invalida = Object.keys(this.valores).find((coluna) => !colunasReais.has(coluna))
        if (invalida) {
          return { data: null, error: { code: 'PGRST204', message: `Could not find the '${invalida}' column of '${this.tabela}' in the schema cache` } }
        }
        const alvo = origem.filter((linha) => this.filtros.every((filtro) => filtro(linha)))
        // So registra escritas que de fato afetam linhas (updates sem correspondencia nao contam).
        if (this.tabela === 'hub_vendas_leads' && alvo.length > 0) atualizacoesDeLeads.push({ ...this.valores })
        for (const linha of alvo) Object.assign(linha, this.valores)
        return { data: this.retornaLinhas ? alvo.map((l) => ({ id: l.id })) : null, error: null }
      }

      const alvo = origem.filter((linha) => this.filtros.every((filtro) => filtro(linha)))
      if (this.head) return { data: null, count: alvo.length, error: null }
      return { data: alvo.map((linha) => ({ ...linha })), error: null }
    }
  }

  return {
    leads, filas, atualizacoesDeLeads, rpcCalls,
    from: (tabela: string) => new Builder(tabela),
    rpc: async (fn: string, params: Record<string, unknown>) => {
      rpcCalls.push({ fn, params })
      if (fn === 'hub_vendas_fechar_aguardando_expirados') return { data: [], error: null }
      if (fn === 'hub_vendas_registrar_conversao') {
        const lead = leads.find((l) => l.id === params.p_lead_id)
        if (lead) Object.assign(lead, { status: 'convertido_organicamente', loja_principal: params.p_loja, data_conversao: params.p_timestamp_evento })
        return { data: [{ lead_id: params.p_lead_id, atualizado: true }], error: null }
      }
      if (fn === 'hub_vendas_preparar_fila_recuperacao') {
        const conexao = (params.p_conexoes_elegiveis as string[])[0]
        filas.push({
          id: `fila-${filas.length + 1}`, lead_id: params.p_lead_id, conexao_destino_id: conexao, status: 'agendado',
          programado_para: (params.p_programados_por_conexao as Record<string, string>)[conexao], quantidade_reconciliacoes: 1,
        })
        const lead = leads.find((l) => l.id === params.p_lead_id)
        if (lead) Object.assign(lead, { status: 'encaminhado_recuperacao', conexao_recuperacao_id: conexao })
        return { data: { lead_id: params.p_lead_id, criado: true, motivo: 'fila_criada' }, error: null }
      }
      return { data: null, error: null }
    },
  }
}

function simularTickets(tickets: Array<{ id: string; isOpen: boolean; startedAt: string }>) {
  vi.mocked(fetchDigisac).mockResolvedValue({
    data: tickets.map((ticket) => ({ ...ticket, contact: { id: 'contato-da-loja', service: { id: PORTAO } } })),
  })
}

const ATENDIMENTO_ABERTO = { id: 'ticket-portao', isOpen: true, startedAt: '2026-09-21T10:30:00.000Z' }

describe('marcarClienteEmAtendimento (via prepararFilaRecuperacaoHubVendas)', () => {
  beforeEach(() => {
    vi.mocked(fetchDigisac).mockReset()
    simularTickets([])
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('o fake estrito reproduz o bug original: gravar digisac_contact_id/digisac_ticket_id em hub_vendas_leads falha (PGRST204)', async () => {
    const supabase = criarSupabaseFakeEstrito([criarLead('lead-1')])

    const resposta = await supabase.from('hub_vendas_leads')
      .update({ status: 'cliente_em_atendimento', digisac_contact_id: 'x', digisac_ticket_id: 'y' })
      .eq('id', 'lead-1')

    expect(resposta).toMatchObject({ error: { code: 'PGRST204', message: expect.stringContaining("'digisac_contact_id'") } })
    expect(supabase.leads[0].status).toBe('aguardando_conversao')
  })

  it('lead valido com ticket aberto numa loja: atualiza sem erro para cliente_em_atendimento, com a data e o motivo corretos', async () => {
    const lead = criarLead('lead-1')
    const supabase = criarSupabaseFakeEstrito([lead])
    simularTickets([ATENDIMENTO_ABERTO])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: AGORA })

    expect(resultado).toMatchObject({ totalCandidatos: 1, totalClienteEmAtendimento: 1, totalErros: 0, totalFilaCriada: 0 })
    expect(lead).toMatchObject({
      status: 'cliente_em_atendimento',
      data_cliente_em_atendimento: '2026-09-21T10:30:00.000Z', // data do ticket, como o fluxo ja definia
      motivo_bloqueio_recuperacao: 'chamado_aberto_portao',
    })
  })

  it('nao tenta gravar colunas inexistentes: o update usa somente colunas reais de hub_vendas_leads', async () => {
    const supabase = criarSupabaseFakeEstrito([criarLead('lead-1')])
    simularTickets([ATENDIMENTO_ABERTO])

    await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: AGORA })

    expect(supabase.atualizacoesDeLeads).toHaveLength(1)
    const colunasGravadas = Object.keys(supabase.atualizacoesDeLeads[0])
    expect(colunasGravadas.sort()).toEqual(['data_cliente_em_atendimento', 'motivo_bloqueio_recuperacao', 'status', 'updated_at'])
    expect(colunasGravadas).not.toContain('digisac_contact_id')
    expect(colunasGravadas).not.toContain('digisac_ticket_id')
    expect(colunasGravadas.every((coluna) => COLUNAS_LEADS.has(coluna))).toBe(true)
  })

  it('preserva os demais dados do lead (telefone, entrada, nome, ids e protocolo do Hub, ciclo)', async () => {
    const lead = criarLead('lead-1')
    const antes = { ...lead }
    const supabase = criarSupabaseFakeEstrito([lead])
    simularTickets([ATENDIMENTO_ABERTO])

    await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: AGORA })

    for (const campo of [
      'telefone_normalizado_ddi', 'telefone_normalizado', 'data_entrada_hub', 'nome_contato_hub', 'ciclo_numero',
      'digisac_contact_id_hub', 'digisac_ticket_id_hub', 'digisac_protocolo_hub', 'loja_principal', 'data_conversao', 'data_fila_manual',
    ]) {
      expect(lead[campo]).toEqual(antes[campo])
    }
    // O ticket da LOJA nao e gravado nas colunas *_hub (que pertencem ao contato/ticket do Hub).
    expect(lead.digisac_ticket_id_hub).toBe('ticket-do-hub')
  })

  it('cancela filas pendentes do lead como cliente_em_atendimento, preservando o restante do historico da fila', async () => {
    const lead = criarLead('lead-1')
    const filaPendente = { id: 'fila-a', lead_id: 'lead-1', status: 'agendado', conexao_destino_id: PORTAO, quantidade_reconciliacoes: 1, erro: null }
    const filaAntiga = { id: 'fila-b', lead_id: 'lead-1', status: 'erro', conexao_destino_id: PORTAO, quantidade_reconciliacoes: 1, erro: 'falha antiga' }
    const supabase = criarSupabaseFakeEstrito([lead], [filaPendente, filaAntiga])
    simularTickets([ATENDIMENTO_ABERTO])

    await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: AGORA })

    expect(filaPendente).toMatchObject({ status: 'cancelado', motivo_cancelamento: 'cliente_em_atendimento' })
    expect(filaAntiga).toMatchObject({ status: 'erro', erro: 'falha antiga' })
  })

  it('lead em cliente_em_atendimento nao volta para recuperacao: nao e selecionado de novo e nenhuma fila e criada', async () => {
    const lead = criarLead('lead-1')
    const supabase = criarSupabaseFakeEstrito([lead])
    simularTickets([ATENDIMENTO_ABERTO])
    await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: AGORA })
    supabase.rpcCalls.length = 0

    // Mesmo com o atendimento encerrado depois (nenhum ticket aberto), o lead nao e reselecionado.
    simularTickets([])
    const segunda = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: new Date('2026-09-21T15:30:00.000Z') })

    expect(segunda).toMatchObject({ totalCandidatos: 0, totalFilaCriada: 0 })
    expect(supabase.rpcCalls.map((call) => call.fn)).not.toContain('hub_vendas_preparar_fila_recuperacao')
    expect(supabase.filas).toHaveLength(0)
    expect(lead.status).toBe('cliente_em_atendimento')
  })

  it('lead em cliente_em_atendimento nao e encerrado/expirado pela rotina de limpeza, mesmo fora da janela e com fila cancelada', async () => {
    const lead = criarLead('lead-1', {
      status: 'cliente_em_atendimento',
      data_entrada_hub: '2026-08-24T19:06:25.851Z',
      data_cliente_em_atendimento: '2026-08-24T13:29:33.157Z',
      motivo_bloqueio_recuperacao: 'chamado_aberto_portao',
    })
    const fila = { id: 'fila-1', lead_id: 'lead-1', status: 'cancelado', motivo_cancelamento: 'cliente_em_atendimento', conexao_destino_id: PORTAO, quantidade_reconciliacoes: 1 }
    const supabase = criarSupabaseFakeEstrito([lead], [fila])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: AGORA })

    expect(resultado.totalLeadsSemAcaoEncerrados).toBe(0)
    expect(lead).toMatchObject({ status: 'cliente_em_atendimento', motivo_bloqueio_recuperacao: 'chamado_aberto_portao', data_fila_manual: null })
    expect(fila).toMatchObject({ status: 'cancelado', motivo_cancelamento: 'cliente_em_atendimento' })
  })

  it('leads em fila_manual e convertido_organicamente permanecem intactos numa execucao normal', async () => {
    const filaManual = criarLead('lead-fm', { status: 'fila_manual', data_fila_manual: '2026-09-10T10:00:00.000Z', data_entrada_hub: '2026-09-05T10:00:00.000Z' })
    const convertido = criarLead('lead-cv', { status: 'convertido_organicamente', loja_principal: 'portao', data_conversao: '2026-09-20T13:00:00.000Z' })
    const supabase = criarSupabaseFakeEstrito([filaManual, convertido])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: AGORA })

    expect(resultado).toMatchObject({ totalCandidatos: 0, totalErros: 0 })
    expect(filaManual.status).toBe('fila_manual')
    expect(convertido).toMatchObject({ status: 'convertido_organicamente', loja_principal: 'portao' })
    expect(supabase.atualizacoesDeLeads).toHaveLength(0)
  })

  it('fluxo normal de convertido_organicamente continua intacto (ticket fechado dentro de 24h da entrada)', async () => {
    const lead = criarLead('lead-1')
    const supabase = criarSupabaseFakeEstrito([lead])
    // Ticket ja fechado, iniciado dentro da janela de conversao (24h apos a entrada): conversao organica.
    simularTickets([{ id: 'ticket-conversao', isOpen: false, startedAt: '2026-09-20T15:00:00.000Z' }])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: AGORA })

    expect(resultado).toMatchObject({ totalConvertidosReconciliacao: 1, totalClienteEmAtendimento: 0, totalErros: 0, totalFilaCriada: 0 })
    expect(supabase.rpcCalls.filter((call) => call.fn === 'hub_vendas_registrar_conversao')).toHaveLength(1)
    expect(lead).toMatchObject({ status: 'convertido_organicamente', loja_principal: 'portao' })
    // Nao passa pelo caminho de atendimento: nenhuma coluna de atendimento foi gravada.
    expect(supabase.atualizacoesDeLeads).toHaveLength(0)
    expect(lead.data_cliente_em_atendimento).toBeNull()
  })

  it('fluxo normal de novo lead sem ticket continua intacto: cria a fila e encaminha para recuperacao', async () => {
    const lead = criarLead('lead-1')
    const supabase = criarSupabaseFakeEstrito([lead])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: AGORA })

    expect(resultado).toMatchObject({ totalCandidatos: 1, totalFilaCriada: 1, totalClienteEmAtendimento: 0, totalErros: 0 })
    expect(lead.status).toBe('encaminhado_recuperacao')
    expect(supabase.filas).toHaveLength(1)
    expect(supabase.atualizacoesDeLeads).toHaveLength(0)
  })

  it('cada lead e tratado de forma independente: um em atendimento e outro sem ticket na mesma execucao', async () => {
    const emAtendimento = criarLead('lead-1', { telefone_normalizado_ddi: '5541996246875', telefone_normalizado: '41996246875' })
    const normal = criarLead('lead-2', { telefone_normalizado_ddi: '5541988887777', telefone_normalizado: '41988887777' })
    const supabase = criarSupabaseFakeEstrito([emAtendimento, normal])
    // Somente o telefone do primeiro lead tem ticket aberto.
    vi.mocked(fetchDigisac).mockImplementation(async (endpoint: string) => {
      const consulta = decodeURIComponent(endpoint)
      const doPrimeiro = /9624-?6875|996246875|41996246875|4196246875/.test(consulta)
      return {
        data: doPrimeiro ? [{ ...ATENDIMENTO_ABERTO, contact: { id: 'c', service: { id: PORTAO } } }] : [],
      }
    })

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: AGORA })

    expect(resultado).toMatchObject({ totalClienteEmAtendimento: 1, totalFilaCriada: 1, totalErros: 0 })
    expect(emAtendimento.status).toBe('cliente_em_atendimento')
    expect(normal.status).toBe('encaminhado_recuperacao')
  })
})
