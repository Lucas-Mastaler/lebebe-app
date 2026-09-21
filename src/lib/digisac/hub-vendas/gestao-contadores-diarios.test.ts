import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { obterStatusGestaoHubVendas } from './gestao'

const PORTAO = 'c60d720f-5ad5-4a1b-bedb-e51495dee686'
const BIGORRILHO = '0973f84b-8294-4615-9657-ba95b6346246'
const HAUER = '1352c41b-80a9-4e74-b9d9-4c5e7aed060e'

type FilaFake = { conexao_destino_id: string; status: string; programado_para: string; enviado_em?: string | null }

// "Hoje" = 21/09/2026, 12:00 em America/Sao_Paulo. Janela local: 21/09 03:00Z a 22/09 03:00Z.
const AGORA = new Date('2026-09-21T15:00:00.000Z')
const INICIO_HOJE = '2026-09-21T03:00:00.000Z'
const FIM_HOJE = '2026-09-22T03:00:00.000Z'
const HOJE = '2026-09-21T13:00:00.000Z'
const ONTEM_23H30_LOCAL = '2026-09-21T02:30:00.000Z'
const ANTIGO_HAUER = '2026-09-02T13:33:04.000Z'
const ANTIGO_BIGORRILHO = '2026-09-07T13:33:04.000Z'

function criarSupabaseFake(filas: FilaFake[]) {
  class Builder {
    private filtros: Array<(f: FilaFake) => boolean> = []
    private head = false

    constructor(private tabela: string) {}

    select(_colunas?: string, opcoes?: { head?: boolean }) {
      this.head = Boolean(opcoes?.head)
      return this
    }

    eq(coluna: string, valor: unknown) {
      this.filtros.push((f) => (f as Record<string, unknown>)[coluna] === valor)
      return this
    }

    in(coluna: string, valores: unknown[]) {
      this.filtros.push((f) => valores.includes((f as Record<string, unknown>)[coluna]))
      return this
    }

    gte(coluna: string, valor: string) {
      this.filtros.push((f) => String((f as Record<string, unknown>)[coluna]) >= valor)
      return this
    }

    lt(coluna: string, valor: string) {
      this.filtros.push((f) => String((f as Record<string, unknown>)[coluna]) < valor)
      return this
    }

    order() {
      return this
    }

    limit() {
      return this
    }

    then(resolve: (valor: unknown) => void, reject: (motivo?: unknown) => void) {
      Promise.resolve(this.executar()).then(resolve, reject)
    }

    private executar() {
      if (this.tabela === 'hub_vendas_config') {
        return {
          data: [
            { chave: 'automacao', valor: { ativa: true, pausada: false, motivo: null }, updated_at: null },
            { chave: 'parametros', valor: { timezone: 'America/Sao_Paulo', limite_diario_por_conexao: 6 }, updated_at: null },
            { chave: 'pausas_conexoes', valor: {}, updated_at: null },
          ],
          error: null,
        }
      }
      if (this.tabela === 'hub_vendas_leads') return { data: [], error: null }
      const linhas = filas.filter((f) => this.filtros.every((filtro) => filtro(f)))
      return this.head
        ? { data: null, count: linhas.length, error: null }
        : { data: linhas, count: linhas.length, error: null }
    }
  }

  return {
    from: (tabela: string) => new Builder(tabela),
    // Espelha hub_vendas_status_contadores: contagem acumulada por status + enviado_hoje.
    rpc: async (fn: string) => {
      if (fn !== 'hub_vendas_status_contadores') return { data: [], error: null }
      const porStatus = new Map<string, number>()
      for (const f of filas) porStatus.set(f.status, (porStatus.get(f.status) ?? 0) + 1)
      const enviadoHoje = filas.filter((f) => (
        f.status === 'enviado' && (f.enviado_em ?? '') >= INICIO_HOJE && (f.enviado_em ?? '') < FIM_HOJE
      )).length
      return {
        data: [...porStatus.entries()].map(([status, total]) => ({ status, total })).concat([{ status: 'enviado_hoje', total: enviadoHoje }]),
        error: null,
      }
    },
  }
}

const cenarioBase: FilaFake[] = [
  // Caso real do painel: 1 erro antigo na Hauer e 1 no Bigorrilho, nenhum de hoje.
  { conexao_destino_id: HAUER, status: 'erro', programado_para: ANTIGO_HAUER },
  { conexao_destino_id: BIGORRILHO, status: 'erro', programado_para: ANTIGO_BIGORRILHO },
  // Envios de hoje (1 por loja).
  { conexao_destino_id: PORTAO, status: 'enviado', programado_para: HOJE, enviado_em: HOJE },
  { conexao_destino_id: BIGORRILHO, status: 'enviado', programado_para: HOJE, enviado_em: HOJE },
  { conexao_destino_id: HAUER, status: 'enviado', programado_para: HOJE, enviado_em: HOJE },
  // Envio de ontem nao entra em "hoje".
  { conexao_destino_id: PORTAO, status: 'enviado', programado_para: ONTEM_23H30_LOCAL, enviado_em: ONTEM_23H30_LOCAL },
  // Demais estados.
  { conexao_destino_id: PORTAO, status: 'agendado', programado_para: HOJE },
  { conexao_destino_id: PORTAO, status: 'resultado_incerto', programado_para: ANTIGO_HAUER },
  { conexao_destino_id: HAUER, status: 'analise_manual', programado_para: ANTIGO_HAUER },
  { conexao_destino_id: HAUER, status: 'cancelado', programado_para: HOJE },
]

type Status = Awaited<ReturnType<typeof obterStatusGestaoHubVendas>>

function loja(status: Status, serviceId: string) {
  const encontrada = status.lojas.find((l) => l.serviceId === serviceId)
  if (!encontrada) throw new Error('loja_nao_encontrada')
  return encontrada
}

describe('obterStatusGestaoHubVendas — contadores diarios x acumulados', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(AGORA)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('erro antigo nao aparece como erro de hoje (caso Hauer/Bigorrilho)', async () => {
    const status = await obterStatusGestaoHubVendas(undefined, {}, criarSupabaseFake(cenarioBase) as never)

    expect(loja(status, HAUER).filas.erroHoje).toBe(0)
    expect(loja(status, BIGORRILHO).filas.erroHoje).toBe(0)
    expect(loja(status, PORTAO).filas.erroHoje).toBe(0)
    expect(status.resumo.erroHoje).toBe(0)
  })

  it('preserva o acumulado de erros pendentes (nada some do painel)', async () => {
    const status = await obterStatusGestaoHubVendas(undefined, {}, criarSupabaseFake(cenarioBase) as never)

    expect(loja(status, HAUER).filas.erro).toBe(1)
    expect(loja(status, BIGORRILHO).filas.erro).toBe(1)
    expect(loja(status, PORTAO).filas.erro).toBe(0)
    expect(status.resumo.erro).toBe(2)
  })

  it('erro de hoje aparece em erroHoje e tambem no acumulado', async () => {
    const status = await obterStatusGestaoHubVendas(
      undefined,
      {},
      criarSupabaseFake([...cenarioBase, { conexao_destino_id: HAUER, status: 'erro', programado_para: HOJE }]) as never,
    )

    expect(loja(status, HAUER).filas.erroHoje).toBe(1)
    expect(loja(status, HAUER).filas.erro).toBe(2)
    expect(loja(status, BIGORRILHO).filas.erroHoje).toBe(0)
    expect(status.resumo.erroHoje).toBe(1)
    expect(status.resumo.erro).toBe(3)
  })

  it('erro das 23h30 de ontem (horario local) nao conta como hoje', async () => {
    const status = await obterStatusGestaoHubVendas(
      undefined,
      {},
      criarSupabaseFake([{ conexao_destino_id: HAUER, status: 'erro', programado_para: ONTEM_23H30_LOCAL }]) as never,
    )

    expect(loja(status, HAUER).filas.erroHoje).toBe(0)
    expect(loja(status, HAUER).filas.erro).toBe(1)
  })

  it('enviados hoje e saldo continuam corretos (limite 6)', async () => {
    const status = await obterStatusGestaoHubVendas(undefined, {}, criarSupabaseFake(cenarioBase) as never)

    for (const serviceId of [BIGORRILHO, HAUER]) {
      expect(loja(status, serviceId)).toMatchObject({ enviadosHoje: 1, limiteDiario: 6, saldoRestante: 5 })
    }
    // Portao: 1 enviado + 1 agendado hoje contam no limite; o enviado de ontem nao.
    expect(loja(status, PORTAO)).toMatchObject({ enviadosHoje: 2, saldoRestante: 4 })
    expect(status.resumo.enviadaHoje).toBe(3)
  })

  it('demais estados continuam corretos', async () => {
    const status = await obterStatusGestaoHubVendas(undefined, {}, criarSupabaseFake(cenarioBase) as never)

    expect(status.resumo).toMatchObject({ agendada: 1, resultadoIncerto: 1, analiseManual: 1, cancelada: 1, reservada: 0, enviando: 0 })
    expect(loja(status, PORTAO).filas).toMatchObject({ agendada: 1, resultadoIncerto: 1 })
    expect(loja(status, HAUER).filas).toMatchObject({ analiseManual: 1 })
  })

  it('sem parte operacional (somenteHistorico) nao consulta erros de fila', async () => {
    const status = await obterStatusGestaoHubVendas(undefined, { incluirOperacional: false }, criarSupabaseFake(cenarioBase) as never)

    expect(status.lojas).toEqual([])
    expect(status.resumo.erroHoje).toBe(0)
  })
})
