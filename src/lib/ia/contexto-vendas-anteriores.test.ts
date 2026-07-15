import { describe, expect, it } from 'vitest'
import {
  buscarContextoVendasAnterioresIA,
  montarBlocoVendasAnterioresIA,
  type ContextoVendasAnterioresIA,
} from './contexto-vendas-anteriores'

type Row = Record<string, unknown>
type Db = Record<string, Row[]>

class FakeQuery implements PromiseLike<{ data: Row[] | Row | null; error: null }> {
  private eqFilters: Array<{ column: string; value: unknown }> = []
  private inFilters: Array<{ column: string; values: unknown[] }> = []
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

  order(column: string, options?: { ascending?: boolean }): FakeQuery {
    this.orderColumn = column
    this.orderAscending = options?.ascending ?? true
    return this
  }

  limit(count: number): FakeQuery {
    this.maxRows = count
    return this
  }

  async maybeSingle(): Promise<{ data: Row | null; error: null }> {
    return { data: this.exec()[0] ?? null, error: null }
  }

  async single(): Promise<{ data: Row | null; error: null }> {
    return this.maybeSingle()
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

const baseDb: Db = {
  sgi_documentos_saida: [
    {
      numero_lancamento: '65431',
      data_fechamento: '2026-07-10T12:00:00Z',
      numero_documento: 'N65431',
      cliente: 'Cliente Teste',
      filial: 'LEBEBE PORTAO',
      vendedor: 'Venda Atual',
      operacao: 'VENDA',
      status: 'Finalizado',
      valor_total: 400,
      valor_total_texto: 'R$ 400,00',
    },
    {
      numero_lancamento: '65295',
      data_fechamento: '2026-06-22T12:00:00Z',
      numero_documento: 'N65295',
      emissao_texto: '22/06/2026',
      cliente: 'Cliente Teste',
      filial: 'LEBEBE PORTAO',
      vendedor: 'Sharon Kauana Guedes Ferre',
      operacao: 'VENDA',
      status: 'Finalizado',
      valor_total: 1469.8,
      valor_total_texto: 'R$ 1.469,80',
    },
    {
      numero_lancamento: '65200',
      data_fechamento: '2026-06-01T12:00:00Z',
      numero_documento: 'N65200',
      cliente: 'Cliente Teste',
      filial: 'LEBEBE PORTAO',
      vendedor: 'Outra Vendedora',
      operacao: 'VENDA',
      status: 'Cancelado',
      valor_total: 900,
      valor_total_texto: 'R$ 900,00',
    },
    {
      numero_lancamento: '65440',
      data_fechamento: '2026-07-12T12:00:00Z',
      numero_documento: 'N65440',
      cliente: 'Cliente Teste',
      status: 'Finalizado',
    },
  ],
  sgi_documentos_saida_contatos: [
    { numero_lancamento: '65431', telefone_normalizado: '41997546390', telefone_normalizado_ddi: '5541997546390' },
    { numero_lancamento: '65295', telefone_normalizado: '41997546390', telefone_normalizado_ddi: '5541997546390' },
    { numero_lancamento: '65200', telefone_normalizado: '41997546390', telefone_normalizado_ddi: '5541997546390' },
    { numero_lancamento: '65440', telefone_normalizado: '41997546390', telefone_normalizado_ddi: '5541997546390' },
  ],
  sgi_documentos_saida_produtos: [
    {
      numero_lancamento: '65431',
      codigo: 'CAR-1',
      produto: 'CARRINHO',
      quantidade: 1,
      valor_total_texto: 'R$ 400,00',
      departamento_classificado: 'PUERICULTURA',
      subgrupo_classificado: 'CARRINHOS',
    },
    {
      numero_lancamento: '65295',
      codigo: 'BER-1',
      produto: 'BERCO PRIME',
      quantidade: 1,
      valor_total_texto: 'R$ 1.469,80',
      departamento_classificado: 'MOVEIS',
      subgrupo_classificado: 'BERCOS',
    },
    {
      numero_lancamento: '65200',
      codigo: 'ROU-1',
      produto: 'ROUPEIRO',
      quantidade: 1,
      valor_total_texto: 'R$ 900,00',
      departamento_classificado: 'MOVEIS',
      subgrupo_classificado: 'ROUPEIROS',
    },
  ],
}

describe('contexto-vendas-anteriores IA', () => {
  it('carrega produto citado e comprado em venda anterior confirmada', async () => {
    const contexto = await buscarContextoVendasAnterioresIA(fakeSupabase(baseDb), '65431')

    expect(contexto.vendas[0].numeroLancamento).toBe('65295')
    expect(contexto.vendas[0].compraConfirmada).toBe(true)
    expect(contexto.vendas[0].produtos[0].produto).toBe('BERCO PRIME')
  })

  it('nao mistura produto comprado na venda atual dentro do historico', async () => {
    const contexto = await buscarContextoVendasAnterioresIA(fakeSupabase(baseDb), '65431')

    expect(contexto.vendas.flatMap((v) => v.produtos).map((p) => p.produto)).not.toContain('CARRINHO')
  })

  it('retorna bloco sem historico quando o cliente nao tem venda anterior', async () => {
    const db: Db = {
      ...baseDb,
      sgi_documentos_saida_contatos: [
        { numero_lancamento: '65431', telefone_normalizado: '41997546390', telefone_normalizado_ddi: '5541997546390' },
      ],
    }

    const contexto = await buscarContextoVendasAnterioresIA(fakeSupabase(db), '65431')
    const bloco = montarBlocoVendasAnterioresIA(contexto)

    expect(contexto.vendas).toHaveLength(0)
    expect(bloco).toContain('Nenhuma venda anterior')
  })

  it('mantem venda cancelada no contexto, mas sem compra confirmada', async () => {
    const contexto = await buscarContextoVendasAnterioresIA(fakeSupabase(baseDb), '65431')
    const cancelada = contexto.vendas.find((v) => v.numeroLancamento === '65200')

    expect(cancelada?.status).toBe('Cancelado')
    expect(cancelada?.compraConfirmada).toBe(false)
  })

  it('ignora venda posterior a venda atual', async () => {
    const contexto = await buscarContextoVendasAnterioresIA(fakeSupabase(baseDb), '65431')

    expect(contexto.vendas.map((v) => v.numeroLancamento)).not.toContain('65440')
  })

  it('respeita limite de vendas historicas', async () => {
    const contexto = await buscarContextoVendasAnterioresIA(fakeSupabase(baseDb), '65431', 1)

    expect(contexto.vendas).toHaveLength(1)
    expect(contexto.limiteVendas).toBe(1)
  })

  it('explicita que produto historico nao e oportunidade nao convertida', async () => {
    const contexto = await buscarContextoVendasAnterioresIA(fakeSupabase(baseDb), '65431')
    const bloco = montarBlocoVendasAnterioresIA(contexto)

    expect(bloco).toContain('Nao classifique automaticamente produtos dessas vendas como oportunidade nao fechada')
    expect(bloco).toContain('BERCO PRIME')
  })

  it('orienta correspondencia historica sem inventar igualdade exata', () => {
    const contexto: ContextoVendasAnterioresIA = {
      criterioIdentificacao: 'telefone',
      limiteVendas: 5,
      totalProdutosHistoricos: 1,
      vendas: [{
        numeroLancamento: '1',
        numeroDocumento: null,
        dataEmissao: null,
        dataFechamento: '2026-01-01T12:00:00Z',
        cliente: null,
        filial: null,
        vendedor: null,
        operacao: null,
        status: 'Finalizado',
        valorTotal: null,
        valorTotalTexto: null,
        compraConfirmada: true,
        produtos: [{
          codigo: null,
          produto: 'BERCO CLASSICO 3 EM 1',
          quantidade: 1,
          quantidadeTexto: null,
          valorTotal: null,
          valorTotalTexto: null,
          departamento: 'MOVEIS',
          subgrupo: 'BERCOS',
        }],
      }],
    }

    const bloco = montarBlocoVendasAnterioresIA(contexto)

    expect(bloco).toContain('Se houver duvida de correspondencia')
    expect(bloco).toContain('BERCO CLASSICO 3 EM 1')
  })

  it('inclui campos comerciais exigidos de cada venda anterior', async () => {
    const contexto = await buscarContextoVendasAnterioresIA(fakeSupabase(baseDb), '65431')
    const bloco = montarBlocoVendasAnterioresIA(contexto)

    expect(bloco).toContain('Numero do documento: N65295')
    expect(bloco).toContain('Data de emissao: 22/06/2026')
    expect(bloco).toContain('Filial: LEBEBE PORTAO')
    expect(bloco).toContain('Vendedor: Sharon Kauana Guedes Ferre')
    expect(bloco).toContain('Operacao: VENDA')
    expect(bloco).toContain('Status: Finalizado')
    expect(bloco).toContain('Valor total: R$ 1.469,80')
  })

  it('permite reanalise substituir consolidado sem mudar schema persistido', () => {
    const bloco = montarBlocoVendasAnterioresIA({
      criterioIdentificacao: 'telefone',
      limiteVendas: 5,
      vendas: [],
      totalProdutosHistoricos: 0,
    })

    expect(bloco).not.toContain('produtos_interesse_nao_fechados')
    expect(bloco).toContain('CONTEXTO HISTORICO')
  })
})
