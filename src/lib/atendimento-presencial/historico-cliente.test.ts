import { describe, expect, it, vi } from 'vitest'
import { buscarVendasSgiPorTelefone, gerarVariacoesTelefoneHistorico } from './historico-cliente'

function builder(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function mockSupabase(queues: Record<string, unknown[]>) {
  return {
    from: vi.fn((table: string) => {
      const queue = queues[table]
      if (!queue || queue.length === 0) throw new Error(`Sem mock para tabela ${table}`)
      return builder(queue.shift())
    }),
  }
}

describe('historico cliente atendimento presencial', () => {
  it('gera variantes historicas com e sem nono digito e DDI', () => {
    expect(gerarVariacoesTelefoneHistorico('4196246875')).toEqual(expect.arrayContaining([
      '4196246875',
      '41996246875',
      '554196246875',
      '5541996246875',
    ]))
  })

  it('busca vendas SGI por todas as variantes e deduplica documentos encontrados por mais de um contato', async () => {
    const supabase = mockSupabase({
      sgi_documentos_saida_contatos: [
        {
          data: [
            { documento_saida_id: 'doc-64685', numero_lancamento: '64685' },
            { documento_saida_id: 'doc-64196', numero_lancamento: '64196' },
          ],
          error: null,
        },
        {
          data: [
            { documento_saida_id: 'doc-64685', numero_lancamento: '64685' },
            { documento_saida_id: 'doc-64196', numero_lancamento: '64196' },
          ],
          error: null,
        },
      ],
      sgi_documentos_saida: [
        {
          data: [
            { id: 'doc-64685', numero_lancamento: '64685', data_fechamento: '2026-04-25T15:19:13.000Z', filial: 'LEBEBE PORTAO', vendedor: 'Sharon Kauana Guedes Ferre', status: 'FATURADO', valor_total: 2170.05 },
            { id: 'doc-64196', numero_lancamento: '64196', data_fechamento: '2026-03-14T17:45:36.000Z', filial: 'LEBEBE PORTAO', vendedor: 'Sharon Kauana Guedes Ferre', status: 'FATURADO', valor_total: 6943.56 },
          ],
          error: null,
        },
      ],
      sgi_documentos_saida_produtos: [
        {
          data: [
            { documento_saida_id: 'doc-64685', produto: 'Berco', quantidade: 1, valor_total: 2170.05, departamento_classificado: 'Moveis', subgrupo_classificado: 'Berco' },
            { documento_saida_id: 'doc-64196', produto: 'Carrinho', quantidade: 1, valor_total: 6943.56, departamento_classificado: 'Puericultura leve', subgrupo_classificado: 'Carrinho' },
          ],
          error: null,
        },
      ],
      sgi_documentos_saida_pagamentos: [
        {
          data: [
            { documento_saida_id: 'doc-64685', forma_pagamento: 'Cartao' },
            { documento_saida_id: 'doc-64196', forma_pagamento: 'Pix' },
          ],
          error: null,
        },
      ],
    })

    const resultado = await buscarVendasSgiPorTelefone(supabase, {
      telefoneNormalizado: '4196246875',
      limit: 10,
    })

    expect(resultado.telefoneDisponivel).toBe(true)
    expect(resultado.vendas.map((venda) => venda.numeroLancamento)).toEqual(['64685', '64196'])
    expect(resultado.vendas[0]).toMatchObject({
      vendedor: 'Sharon Kauana Guedes Ferre',
      status: 'FATURADO',
      departamentos: ['Moveis'],
      formasPagamento: ['Cartao'],
      produtos: [
        {
          nome: 'Berco',
          quantidade: 1,
          valorTotal: 2170.05,
          departamento: 'Moveis',
          subgrupo: 'Berco',
        },
      ],
    })
    expect(resultado.vendas).toHaveLength(2)
    expect(supabase.from).toHaveBeenCalledWith('sgi_documentos_saida_contatos')
  })
})
