import { describe, expect, it, vi } from 'vitest'
import { prepararFilaRecuperacaoHubVendas } from './preparar-fila'

vi.mock('@/lib/digisac/clienteDigisac', () => ({
  fetchDigisac: vi.fn().mockResolvedValue({ data: [] }),
}))

type LeadRow = {
  id: string
  telefone_normalizado_ddi: string
  data_entrada_hub: string
  status: string
  conexao_recuperacao_id: string | null
  data_recuperacao_enviada?: string | null
  data_recuperacao_respondida?: string | null
  data_encerrado?: string | null
  data_fila_manual?: string | null
}

type FilaRow = {
  id: string
  lead_id: string
  conexao_destino_id: string
  conexao_destino_nome: string
  status: string
  programado_para: string
  quantidade_reconciliacoes: number
}

const LEAD_TESTE_ID = 'da772a09-dcf0-4476-a81d-86983d7ac624'
const OUTRO_LEAD_ID = '7b836f0d-64b9-4a0a-98d5-1f92f37763fb'
const PORTAO_ID = 'c60d720f-5ad5-4a1b-bedb-e51495dee686'

function criarLead(id: string, dataEntradaHub: string): LeadRow {
  return {
    id,
    telefone_normalizado_ddi: id === LEAD_TESTE_ID ? '5541999999161' : '5541999999000',
    data_entrada_hub: dataEntradaHub,
    status: 'aguardando_conversao',
    conexao_recuperacao_id: null,
  }
}

function criarSupabaseFake(leadsIniciais: LeadRow[], filasIniciais: FilaRow[] = []) {
  const state = {
    leads: leadsIniciais,
    filas: filasIniciais,
    rpcCalls: [] as Array<{ fn: string; params: Record<string, unknown> }>,
    config: [
      {
        chave: 'automacao',
        valor: { ativa: false, pausada: true, motivo: 'Fase 1: base estrutural criada sem ativar envios' },
      },
      {
        chave: 'parametros',
        valor: {
          timezone: 'America/Sao_Paulo',
          dias_semana: [1, 2, 3, 4, 5, 6],
          horario_inicio: '09:00',
          horario_fim: '18:00',
          limite_diario: 15,
          intervalo_min_seg: 180,
          intervalo_max_seg: 180,
          janela_conversao_horas: 24,
          elegibilidade_horas: 48,
        },
      },
      {
        chave: 'pausas_conexoes',
        valor: {
          [PORTAO_ID]: { nome: 'Portao', pausada: false, erros_consecutivos: 0 },
          '0973f84b-8294-4615-9657-ba95b6346246': { nome: 'Bigorrilho', pausada: false, erros_consecutivos: 0 },
          '1352c41b-80a9-4e74-b9d9-4c5e7aed060e': { nome: 'Hauer/Marechal', pausada: false, erros_consecutivos: 0 },
        },
      },
      {
        chave: 'rodizio',
        valor: {
          ultima_posicao: null,
          ultima_conexao_id: null,
          ordem: [
            PORTAO_ID,
            '0973f84b-8294-4615-9657-ba95b6346246',
            '1352c41b-80a9-4e74-b9d9-4c5e7aed060e',
          ],
        },
      },
    ],
  }

  class Builder {
    private filters: Record<string, unknown> = {}
    private inFilters: Record<string, unknown[]> = {}
    private isNullFilters: Record<string, boolean> = {}
    private updateValues: Record<string, unknown> | null = null
    private headCount = false
    private selectCalled = false

    constructor(private table: string) {}

    select(_columns?: string, options?: { count?: string; head?: boolean }) {
      this.selectCalled = true
      this.headCount = options?.head === true
      return this
    }

    update(values: Record<string, unknown>) {
      this.updateValues = values
      return this
    }

    eq(column: string, value: unknown) {
      this.filters[column] = value
      return this
    }

    lte(column: string, value: unknown) {
      this.filters[`${column}__lte`] = value
      return this
    }

    gt(column: string, value: unknown) {
      this.filters[`${column}__gt`] = value
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

    is(column: string, value: unknown) {
      this.isNullFilters[column] = value === null
      return this
    }

    in(column: string, values: unknown[]) {
      this.inFilters[column] = values
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
        const data = keys ? state.config.filter((row) => keys.includes(row.chave)) : state.config
        return { data, error: null }
      }

      if (this.table === 'hub_vendas_leads') {
        if (this.updateValues) {
          const afetados: LeadRow[] = []
          for (const lead of state.leads) {
            if (this.filters.id && lead.id !== this.filters.id) continue
            if (this.filters.status && lead.status !== this.filters.status) continue
            if (this.filters.data_recuperacao_enviada__lt) {
              const limite = String(this.filters.data_recuperacao_enviada__lt)
              if (!lead.data_recuperacao_enviada || !(lead.data_recuperacao_enviada < limite)) continue
            }
            if (this.isNullFilters.data_recuperacao_respondida) {
              if (lead.data_recuperacao_respondida != null) continue
            }
            Object.assign(lead, this.updateValues)
            afetados.push(lead)
          }
          return this.selectCalled ? { data: afetados.map((lead) => ({ id: lead.id })), error: null } : { error: null }
        }

        let data = [...state.leads]
        if (this.filters.id) data = data.filter((lead) => lead.id === this.filters.id)
        if (this.filters.status) data = data.filter((lead) => lead.status === this.filters.status)
        if (this.filters.data_entrada_hub__lte) {
          const limite = String(this.filters.data_entrada_hub__lte)
          data = data.filter((lead) => lead.data_entrada_hub <= limite)
        }
        if (this.filters.data_entrada_hub__gt) {
          const limite = String(this.filters.data_entrada_hub__gt)
          data = data.filter((lead) => lead.data_entrada_hub > limite)
        }
        return { data, error: null }
      }

      if (this.table === 'hub_vendas_recuperacao_fila') {
        if (this.updateValues) {
          for (const fila of state.filas) {
            if (this.filters.lead_id && fila.lead_id !== this.filters.lead_id) continue
            Object.assign(fila, this.updateValues)
          }
          return { error: null }
        }

        let data = [...state.filas]
        if (this.filters.lead_id) data = data.filter((fila) => fila.lead_id === this.filters.lead_id)
        if (this.filters.conexao_destino_id) {
          data = data.filter((fila) => fila.conexao_destino_id === this.filters.conexao_destino_id)
        }
        if (this.inFilters.status) data = data.filter((fila) => this.inFilters.status.includes(fila.status))
        if (this.filters.programado_para__gte) {
          const limite = String(this.filters.programado_para__gte)
          data = data.filter((fila) => fila.programado_para >= limite)
        }
        if (this.filters.programado_para__lt) {
          const limite = String(this.filters.programado_para__lt)
          data = data.filter((fila) => fila.programado_para < limite)
        }
        if (this.headCount) return { data: null, count: data.length, error: null }
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

      if (fn === 'hub_vendas_fechar_aguardando_expirados') {
        const limite = String(params.p_limite_elegibilidade)
        const afetados = state.leads.filter((lead) => {
          if (lead.status !== 'aguardando_conversao') return false
          if (!(lead.data_entrada_hub <= limite)) return false
          return !state.filas.some((fila) => fila.lead_id === lead.id)
        })
        for (const lead of afetados) {
          lead.status = 'fila_manual'
          lead.data_fila_manual = lead.data_fila_manual ?? '2026-08-01T00:00:00.000Z'
        }
        return Promise.resolve({ data: afetados.map((lead) => ({ lead_id: lead.id })), error: null })
      }

      if (fn !== 'hub_vendas_preparar_fila_recuperacao') return Promise.resolve({ data: null, error: null })

      const leadId = params.p_lead_id as string
      const existente = state.filas.find((fila) => fila.lead_id === leadId)
      if (existente) {
        existente.quantidade_reconciliacoes += 1
        return Promise.resolve({ data: { lead_id: leadId, fila_id: null, criado: false, motivo: 'fila_ja_existente' }, error: null })
      }

      const conexaoId = (params.p_conexoes_elegiveis as string[])[0]
      const programadoPara = (params.p_programados_por_conexao as Record<string, string>)[conexaoId]
      const fila: FilaRow = {
        id: `fila-${state.filas.length + 1}`,
        lead_id: leadId,
        conexao_destino_id: conexaoId,
        conexao_destino_nome: (params.p_nomes_por_conexao as Record<string, string>)[conexaoId],
        status: 'agendado',
        programado_para: programadoPara,
        quantidade_reconciliacoes: 1,
      }
      state.filas.push(fila)
      const lead = state.leads.find((item) => item.id === leadId)
      if (lead) {
        lead.status = 'encaminhado_recuperacao'
        lead.conexao_recuperacao_id = conexaoId
      }
      return Promise.resolve({
        data: {
          lead_id: leadId,
          fila_id: fila.id,
          criado: true,
          motivo: 'fila_criada',
          conexao_destino_id: conexaoId,
          programado_para: programadoPara,
        },
        error: null,
      })
    },
  }
}

describe('prepararFilaRecuperacaoHubVendas - modo teste', () => {
  const agora = new Date('2026-07-30T20:00:00.000Z')
  const entradaElegivel = '2026-07-29T19:00:00.000Z'

  it('mantem automacao global inativa sem leadId', async () => {
    const supabase = criarSupabaseFake([criarLead(LEAD_TESTE_ID, entradaElegivel)])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora })

    expect(resultado).toMatchObject({ ok: true, automacaoAtiva: false, pausada: true, totalCandidatos: 0 })
    expect(supabase.state.filas).toHaveLength(0)
    // O fechamento de fila_manual roda independente da automacao (nao cria fila nova, so
    // formaliza um estado ja verdadeiro), entao a RPC e chamada mesmo com automacao inativa.
    expect(supabase.state.rpcCalls).toEqual([
      { fn: 'hub_vendas_fechar_aguardando_expirados', params: { p_limite_elegibilidade: expect.any(String) } },
    ])
  })

  it('simula somente o lead informado sem criar fila nem alterar lead', async () => {
    const leadTeste = criarLead(LEAD_TESTE_ID, entradaElegivel)
    const outroLead = criarLead(OUTRO_LEAD_ID, entradaElegivel)
    const supabase = criarSupabaseFake([leadTeste, outroLead])

    const resultado = await prepararFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      agora,
      leadId: LEAD_TESTE_ID,
      modoTeste: true,
      modoSimulacao: true,
    })

    expect(resultado).toMatchObject({
      ok: true,
      automacaoAtiva: false,
      pausada: true,
      modoTeste: true,
      modoSimulacao: true,
      leadId: LEAD_TESTE_ID,
      totalCandidatos: 1,
      detalheTeste: {
        leadEncontrado: true,
        elegivelTemporal: true,
        resultadoReconciliacao: 'ignorado',
        conexaoSimuladaId: PORTAO_ID,
        statusFinalSimulado: 'fila_criada',
      },
    })
    expect(resultado.detalheTeste?.programadoPara).toBeTruthy()
    expect(supabase.state.filas).toHaveLength(0)
    expect(supabase.state.rpcCalls).toHaveLength(0)
    expect(leadTeste.status).toBe('aguardando_conversao')
    expect(outroLead.status).toBe('aguardando_conversao')
  })

  it('prepara fila real somente para o lead informado e permanece idempotente', async () => {
    const leadTeste = criarLead(LEAD_TESTE_ID, entradaElegivel)
    const outroLead = criarLead(OUTRO_LEAD_ID, entradaElegivel)
    const supabase = criarSupabaseFake([leadTeste, outroLead])

    const primeira = await prepararFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      agora,
      leadId: LEAD_TESTE_ID,
      modoTeste: true,
    })
    const segunda = await prepararFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      agora,
      leadId: LEAD_TESTE_ID,
      modoTeste: true,
    })

    expect(primeira.totalFilaCriada).toBe(1)
    expect(segunda.totalFilaExistente).toBe(1)
    expect(supabase.state.filas).toHaveLength(1)
    expect(supabase.state.filas[0]).toMatchObject({ lead_id: LEAD_TESTE_ID, status: 'agendado' })
    expect(leadTeste).toMatchObject({ status: 'encaminhado_recuperacao', conexao_recuperacao_id: PORTAO_ID })
    expect(outroLead).toMatchObject({ status: 'aguardando_conversao', conexao_recuperacao_id: null })
  })

  it('bloqueia lead especifico antes de 24h e depois de 48h', async () => {
    const antes24h = criarSupabaseFake([criarLead(LEAD_TESTE_ID, '2026-07-30T00:00:00.000Z')])
    const depois48h = criarSupabaseFake([criarLead(LEAD_TESTE_ID, '2026-07-28T19:00:00.000Z')])

    await expect(prepararFilaRecuperacaoHubVendas({
      supabase: antes24h as never,
      agora,
      leadId: LEAD_TESTE_ID,
      modoTeste: true,
      modoSimulacao: true,
    })).resolves.toMatchObject({ detalheTeste: { elegivelTemporal: false, motivoBloqueio: 'antes_janela_24h' } })

    await expect(prepararFilaRecuperacaoHubVendas({
      supabase: depois48h as never,
      agora,
      leadId: LEAD_TESTE_ID,
      modoTeste: true,
      modoSimulacao: true,
    })).resolves.toMatchObject({ detalheTeste: { elegivelTemporal: false, motivoBloqueio: 'apos_janela_48h' } })

    expect(antes24h.state.filas).toHaveLength(0)
    expect(depois48h.state.filas).toHaveLength(0)
  })
})

describe('encerrarRecuperacoesExpiradasHubVendas (via prepararFilaRecuperacaoHubVendas)', () => {
  const agora = new Date('2026-07-30T20:00:00.000Z')

  function criarLeadRecuperacao(
    id: string,
    dataRecuperacaoEnviada: string,
    dataRecuperacaoRespondida: string | null = null,
    status = 'recuperacao_enviada'
  ): LeadRow {
    return {
      id,
      telefone_normalizado_ddi: '5541999999161',
      data_entrada_hub: '2026-07-28T10:00:00.000Z',
      status,
      conexao_recuperacao_id: PORTAO_ID,
      data_recuperacao_enviada: dataRecuperacaoEnviada,
      data_recuperacao_respondida: dataRecuperacaoRespondida,
    }
  }

  it('encerra lead recuperacao_enviada com mais de 24h sem resposta', async () => {
    const expirado = criarLeadRecuperacao(LEAD_TESTE_ID, '2026-07-29T19:00:00.000Z')
    const supabase = criarSupabaseFake([expirado])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora })

    expect(resultado.totalRecuperacoesEncerradas).toBe(1)
    expect(expirado.status).toBe('encerrado')
    expect(expirado.data_encerrado).toBe(agora.toISOString())

    const segundaExecucao = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: new Date('2026-07-31T20:00:00.000Z') })
    expect(segundaExecucao.totalRecuperacoesEncerradas).toBe(0)
    expect(expirado.data_encerrado).toBe(agora.toISOString())
  })

  it('nao encerra lead recuperacao_enviada ainda dentro das 24h', async () => {
    const dentroDaJanela = criarLeadRecuperacao(LEAD_TESTE_ID, '2026-07-30T10:00:00.000Z')
    const supabase = criarSupabaseFake([dentroDaJanela])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora })

    expect(resultado.totalRecuperacoesEncerradas).toBe(0)
    expect(dentroDaJanela.status).toBe('recuperacao_enviada')
  })

  it('nunca encerra um lead ja recuperado, mesmo apos 24h de data_recuperacao_enviada', async () => {
    const recuperado = criarLeadRecuperacao(
      LEAD_TESTE_ID,
      '2026-07-29T19:00:00.000Z',
      '2026-07-29T20:30:00.000Z',
      'recuperado'
    )
    const supabase = criarSupabaseFake([recuperado])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora })

    expect(resultado.totalRecuperacoesEncerradas).toBe(0)
    expect(recuperado.status).toBe('recuperado')
  })

  it('nao roda a expiracao em massa quando leadId especifico e informado (modo teste)', async () => {
    const expirado = criarLeadRecuperacao(OUTRO_LEAD_ID, '2026-07-29T19:00:00.000Z')
    const leadTeste = criarLead(LEAD_TESTE_ID, '2026-07-29T19:00:00.000Z')
    const supabase = criarSupabaseFake([leadTeste, expirado])

    await prepararFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      agora,
      leadId: LEAD_TESTE_ID,
      modoTeste: true,
      modoSimulacao: true,
    })

    expect(expirado.status).toBe('recuperacao_enviada')
  })
})

describe('fecharLeadsAguardandoExpiradosHubVendas (via prepararFilaRecuperacaoHubVendas)', () => {
  const agora = new Date('2026-08-01T00:00:00.000Z')

  function criarLeadComStatus(id: string, dataEntradaHub: string, status: string): LeadRow {
    return { ...criarLead(id, dataEntradaHub), status }
  }

  it('lead dentro da janela de elegibilidade continua aguardando_conversao', async () => {
    const dentroDaJanela = criarLead(LEAD_TESTE_ID, '2026-07-30T12:00:00.000Z') // 36h antes de `agora`
    const supabase = criarSupabaseFake([dentroDaJanela])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora })

    expect(resultado.totalMovidosFilaManual).toBe(0)
    expect(dentroDaJanela.status).toBe('aguardando_conversao')
  })

  it('lead expirado (>=48h) sem fila associada vira fila_manual', async () => {
    const expirado = criarLead(LEAD_TESTE_ID, '2026-07-29T20:00:00.000Z') // 52h antes de `agora`
    const supabase = criarSupabaseFake([expirado])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora })

    expect(resultado.totalMovidosFilaManual).toBe(1)
    expect(expirado.status).toBe('fila_manual')
    expect(expirado.data_fila_manual).toBe('2026-08-01T00:00:00.000Z')

    await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora: new Date('2026-08-02T00:00:00.000Z') })
    expect(expirado.data_fila_manual).toBe('2026-08-01T00:00:00.000Z')
  })

  it('lead expirado mas com fila associada nao vira fila_manual', async () => {
    const expirado = criarLead(LEAD_TESTE_ID, '2026-07-29T20:00:00.000Z')
    const filaDoLead: FilaRow = {
      id: 'fila-existente',
      lead_id: LEAD_TESTE_ID,
      conexao_destino_id: PORTAO_ID,
      conexao_destino_nome: 'Portao',
      status: 'agendado',
      programado_para: '2026-07-30T09:00:00.000Z',
      quantidade_reconciliacoes: 0,
    }
    const supabase = criarSupabaseFake([expirado], [filaDoLead])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora })

    expect(resultado.totalMovidosFilaManual).toBe(0)
    expect(expirado.status).toBe('aguardando_conversao')
  })

  it('leads em outros status (convertido, recuperacao_enviada, recuperado, encerrado) nunca viram fila_manual', async () => {
    const convertido = criarLeadComStatus('lead-convertido', '2026-07-29T20:00:00.000Z', 'convertido_organicamente')
    const recuperacaoEnviada = criarLeadComStatus('lead-recuperacao', '2026-07-29T20:00:00.000Z', 'recuperacao_enviada')
    const recuperado = criarLeadComStatus('lead-recuperado', '2026-07-29T20:00:00.000Z', 'recuperado')
    const encerrado = criarLeadComStatus('lead-encerrado', '2026-07-29T20:00:00.000Z', 'encerrado')
    const supabase = criarSupabaseFake([convertido, recuperacaoEnviada, recuperado, encerrado])

    const resultado = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora })

    expect(resultado.totalMovidosFilaManual).toBe(0)
    expect(convertido.status).toBe('convertido_organicamente')
    expect(recuperacaoEnviada.status).toBe('recuperacao_enviada')
    expect(recuperado.status).toBe('recuperado')
    expect(encerrado.status).toBe('encerrado')
  })

  it('execucao repetida e idempotente', async () => {
    const expirado = criarLead(LEAD_TESTE_ID, '2026-07-29T20:00:00.000Z')
    const supabase = criarSupabaseFake([expirado])

    const primeira = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora })
    const segunda = await prepararFilaRecuperacaoHubVendas({ supabase: supabase as never, agora })

    expect(primeira.totalMovidosFilaManual).toBe(1)
    expect(segunda.totalMovidosFilaManual).toBe(0)
    expect(expirado.status).toBe('fila_manual')
  })

  it('nao roda a expiracao em massa quando leadId especifico e informado (modo teste)', async () => {
    const expirado = criarLead(OUTRO_LEAD_ID, '2026-07-29T20:00:00.000Z')
    const leadTeste = criarLead(LEAD_TESTE_ID, '2026-07-30T12:00:00.000Z')
    const supabase = criarSupabaseFake([leadTeste, expirado])

    await prepararFilaRecuperacaoHubVendas({
      supabase: supabase as never,
      agora,
      leadId: LEAD_TESTE_ID,
      modoTeste: true,
      modoSimulacao: true,
    })

    expect(expirado.status).toBe('aguardando_conversao')
  })
})
