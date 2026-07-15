import { describe, expect, it } from 'vitest'
import {
  buscarContextoChamadosAnterioresIA,
  calcularContextoTemporalChamado,
  montarBlocoChamadosAnterioresIA,
  montarBlocoTemporalChamadoIA,
} from './contexto-temporal-chamados'
import type { DigisacMensagem } from '@/lib/digisac/sgi-sync'

type Row = Record<string, unknown>
type Db = Record<string, Row[]>

class FakeQuery implements PromiseLike<{ data: Row[]; error: null }> {
  private eqFilters: Array<{ column: string; value: unknown }> = []
  private inFilters: Array<{ column: string; values: unknown[] }> = []
  private ltFilters: Array<{ column: string; value: string }> = []
  private orderColumn: string | null = null
  private orderAscending = true
  private maxRows: number | null = null

  constructor(private readonly rows: Row[]) {}

  select(): FakeQuery {
    return this
  }

  eq(column: string, value: unknown): FakeQuery {
    this.eqFilters.push({ column, value })
    return this
  }

  in(column: string, values: unknown[]): FakeQuery {
    this.inFilters.push({ column, values })
    return this
  }

  lt(column: string, value: string): FakeQuery {
    this.ltFilters.push({ column, value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }): FakeQuery {
    this.orderColumn = column
    this.orderAscending = options?.ascending ?? true
    return this
  }

  limit(count: number): FakeQuery {
    this.maxRows = count
    return this
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.exec(), error: null }).then(onfulfilled, onrejected)
  }

  private exec(): Row[] {
    let result = [...this.rows]
    for (const f of this.eqFilters) {
      result = result.filter((row) => row[f.column] === f.value)
    }
    for (const f of this.inFilters) {
      result = result.filter((row) => f.values.includes(row[f.column]))
    }
    for (const f of this.ltFilters) {
      const limite = new Date(f.value).getTime()
      result = result.filter((row) => new Date(String(row[f.column] ?? '')).getTime() < limite)
    }
    if (this.orderColumn) {
      const column = this.orderColumn
      result.sort((a, b) => {
        const av = String(a[column] ?? '')
        const bv = String(b[column] ?? '')
        return this.orderAscending ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    if (this.maxRows != null) {
      result = result.slice(0, this.maxRows)
    }
    return result
  }
}

function fakeSupabase(db: Db) {
  return {
    from(table: string) {
      return new FakeQuery(db[table] ?? [])
    },
  }
}

function msg(id: string, timestamp: string, text = 'texto'): DigisacMensagem {
  return {
    id,
    timestamp,
    text,
    type: 'chat',
    isFromMe: false,
  } as DigisacMensagem
}

function contextoBase(mensagens: DigisacMensagem[], overrides: Partial<Parameters<typeof calcularContextoTemporalChamado>[0]> = {}) {
  return calcularContextoTemporalChamado({
    dataFechamentoVenda: '2026-07-07T20:59:26Z',
    emissaoVenda: '07/07/2026 17:59:26',
    inicioChamado: '2026-07-07T15:00:00Z',
    inicioCiclo: '2026-07-01T12:00:00Z',
    fimCiclo: '2026-07-07T20:59:26Z',
    mensagens,
    ...overrides,
  })
}

const dbHistorico: Db = {
  venda_conversa_vinculos: [
    {
      numero_lancamento: '65431',
      digisac_ticket_id: 'atual',
      data_conversa: '2026-07-06T15:44:49.111Z',
      data_inicio_ciclo_venda: '2026-06-22T15:44:50Z',
      data_fim_ciclo_venda: '2026-07-07T20:59:26Z',
      considerada_no_ciclo_venda: true,
    },
    { numero_lancamento: '65001', digisac_ticket_id: 'ant-1', considerada_no_ciclo_venda: true },
    { numero_lancamento: '65002', digisac_ticket_id: 'ant-2', considerada_no_ciclo_venda: true },
    { numero_lancamento: '65003', digisac_ticket_id: 'ant-3', considerada_no_ciclo_venda: true },
    { numero_lancamento: '65004', digisac_ticket_id: 'ant-4', considerada_no_ciclo_venda: true },
  ],
  sgi_documentos_saida_contatos: [
    { numero_lancamento: '65431', telefone_normalizado: '4192569293', telefone_normalizado_ddi: '554192569293' },
  ],
  digisac_conversas_resumo: [
    { digisac_ticket_id: 'atual', protocolo: '2026070671185', telefone_normalizado: '4192569293', telefone_normalizado_ddi: '554192569293', started_at: '2026-07-06T15:44:49.111Z' },
    { digisac_ticket_id: 'ant-1', protocolo: '1', telefone_normalizado: '4192569293', telefone_normalizado_ddi: '554192569293', started_at: '2026-06-21T12:00:00Z', comments: 'orcamento anterior', department_nome: 'PORTAO', user_nome: 'CAROL' },
    { digisac_ticket_id: 'ant-2', protocolo: '2', telefone_normalizado: '4192569293', telefone_normalizado_ddi: '554192569293', started_at: '2026-06-20T12:00:00Z', comments: 'visita anterior' },
    { digisac_ticket_id: 'ant-3', protocolo: '3', telefone_normalizado: '4192569293', telefone_normalizado_ddi: '554192569293', started_at: '2026-06-19T12:00:00Z', comments: 'retomada anterior' },
    { digisac_ticket_id: 'ant-4', protocolo: '4', telefone_normalizado: '4192569293', telefone_normalizado_ddi: '554192569293', started_at: '2026-06-18T12:00:00Z', comments: 'fora do limite' },
  ],
  digisac_chamados_analise_ia: [
    { digisac_ticket_id: 'ant-1', numero_lancamento: '65001', status: 'concluido', resumo_chamado: 'Cliente avaliou berco.' },
  ],
}

describe('contexto temporal e chamados anteriores IA', () => {
  it('calcula convite a loja seguido de fechamento no mesmo dia', () => {
    const contexto = contextoBase([msg('1', '2026-07-07T16:00:00Z', 'venha na loja')])

    expect(contexto.chamadoComecouAntesFechamento).toBe(true)
    expect(contexto.mensagensAntesFechamento).toBe(1)
  })

  it('calcula cliente que confirma ida a loja no dia seguinte', () => {
    const contexto = contextoBase([msg('1', '2026-07-06T18:00:00Z', 'vou amanha')], {
      inicioChamado: '2026-07-06T17:00:00Z',
    })

    expect(contexto.intervaloUltimaMensagemAteFechamento).toContain('1 dia')
  })

  it('mantem produto deixado pronto antes da venda como mensagem pre-fechamento', () => {
    const contexto = contextoBase([msg('1', '2026-07-07T19:00:00Z', 'deixei pronto')])

    expect(contexto.houveMensagemAntesFechamento).toBe(true)
  })

  it('separa conversa logistica antes do fechamento', () => {
    const contexto = contextoBase([msg('1', '2026-07-07T20:00:00Z', 'retirada combinada')])

    expect(contexto.mensagensAntesFechamento).toBe(1)
    expect(contexto.mensagensDepoisFechamento).toBe(0)
  })

  it('separa conversa logistica depois do fechamento', () => {
    const contexto = contextoBase([msg('1', '2026-07-07T21:30:00Z', 'retirada combinada')])

    expect(contexto.mensagensAntesFechamento).toBe(0)
    expect(contexto.mensagensDepoisFechamento).toBe(1)
  })

  it('calcula ultima mensagem poucas horas antes da venda', () => {
    const contexto = contextoBase([msg('1', '2026-07-07T18:59:26Z', 'ate mais tarde')])

    expect(contexto.intervaloUltimaMensagemAteFechamento).toBe('aproximadamente 2 horas')
  })

  it('inclui chamado antigo apenas como contexto historico', async () => {
    const contexto = await buscarContextoChamadosAnterioresIA(fakeSupabase(dbHistorico), '65431', {
      limiteChamados: 1,
      transcriptFetcher: async () => ({ transcript: '[20/06/2026 09:00] Cliente: gostei do berco', mensagens: [] }),
    })
    const bloco = montarBlocoChamadosAnterioresIA(contexto)

    expect(contexto.chamados).toHaveLength(1)
    expect(bloco).toContain('Nao os trate automaticamente como chamados pertencentes a venda atual')
  })

  it('limita tres chamados anteriores mostrando continuidade', async () => {
    const contexto = await buscarContextoChamadosAnterioresIA(fakeSupabase(dbHistorico), '65431', {
      transcriptFetcher: async () => ({ transcript: 'sem trecho', mensagens: [] }),
    })

    expect(contexto.chamados.map((c) => c.ticketId)).toEqual(['ant-1', 'ant-2', 'ant-3'])
    expect(contexto.totalCandidatosAntesLimite).toBe(4)
  })

  it('retorna bloco sem historico para cliente sem chamados anteriores', async () => {
    const contexto = await buscarContextoChamadosAnterioresIA(fakeSupabase({
      venda_conversa_vinculos: dbHistorico.venda_conversa_vinculos.slice(0, 1),
      sgi_documentos_saida_contatos: dbHistorico.sgi_documentos_saida_contatos,
      digisac_conversas_resumo: dbHistorico.digisac_conversas_resumo.slice(0, 1),
    }), '65431')
    const bloco = montarBlocoChamadosAnterioresIA(contexto)

    expect(contexto.chamados).toHaveLength(0)
    expect(bloco).toContain('Nenhum chamado anterior')
  })

  it('mantem historico anterior contraditorio sem causalidade automatica', async () => {
    const contexto = await buscarContextoChamadosAnterioresIA(fakeSupabase(dbHistorico), '65431', {
      limiteChamados: 1,
      transcriptFetcher: async () => ({ transcript: '[20/06/2026 09:00] Cliente: nao quero comprar agora', mensagens: [] }),
    })
    const bloco = montarBlocoChamadosAnterioresIA(contexto)

    expect(bloco).toContain('Nao transforme qualquer conversa antiga em influencia')
  })

  it('marca chamado posterior a venda', () => {
    const contexto = contextoBase([msg('1', '2026-07-08T12:00:00Z')], {
      inicioChamado: '2026-07-08T12:00:00Z',
    })

    expect(contexto.chamadoComecouAntesFechamento).toBe(false)
  })

  it('explicita venda sem hora de fechamento disponivel', () => {
    const contexto = contextoBase([msg('1', '2026-07-07T12:00:00Z')], {
      dataFechamentoVenda: '2026-07-07',
    })
    const bloco = montarBlocoTemporalChamadoIA(contexto)

    expect(contexto.fechamentoVendaTemHora).toBe(false)
    expect(bloco).toContain('hora nao disponivel')
  })

  it('representa a venda 65431 com chamado iniciado antes e ultima mensagem antes do fechamento', () => {
    const contexto = calcularContextoTemporalChamado({
      dataFechamentoVenda: '2026-07-07T20:59:26Z',
      emissaoVenda: '07/07/2026 17:59:26',
      inicioChamado: '2026-07-06T15:44:49.111Z',
      inicioCiclo: '2026-06-22T15:44:50Z',
      fimCiclo: '2026-07-07T20:59:26Z',
      mensagens: [
        msg('1', '2026-07-06T15:44:50Z', 'primeiro contato'),
        msg('2', '2026-07-07T15:43:00Z', 'pode ir na loja'),
      ],
    })

    expect(contexto.chamadoComecouAntesFechamento).toBe(true)
    expect(contexto.mensagensAntesFechamento).toBe(2)
    expect(contexto.intervaloUltimaMensagemAteFechamento).toContain('5 horas')
  })
})
