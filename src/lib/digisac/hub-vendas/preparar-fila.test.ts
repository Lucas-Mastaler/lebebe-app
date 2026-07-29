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
    private updateValues: Record<string, unknown> | null = null
    private headCount = false

    constructor(private table: string) {}

    select(_columns?: string, options?: { count?: string; head?: boolean }) {
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
          for (const lead of state.leads) {
            if (this.filters.id && lead.id !== this.filters.id) continue
            if (this.filters.status && lead.status !== this.filters.status) continue
            Object.assign(lead, this.updateValues)
          }
          return { error: null }
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
    expect(supabase.state.rpcCalls).toHaveLength(0)
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
