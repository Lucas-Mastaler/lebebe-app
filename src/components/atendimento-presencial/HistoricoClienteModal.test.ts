import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { formatarVendaFechadaHistorico, HistoricoAtendimentoCard, montarUrlHistoricoCliente, situacaoAtendimentoHistorico } from './HistoricoClienteModal'
import type { HistoricoAtendimentoClienteDTO } from '@/lib/atendimento-presencial/historico-cliente'

describe('HistoricoClienteModal helpers', () => {
  it('monta a URL do historico sem atendimento atual quando nao informado', () => {
    expect(montarUrlHistoricoCliente('cliente-1')).toBe('/api/atendimento-presencial/clientes/cliente-1/historico')
  })

  it('inclui atendimentoAtualId apenas quando informado', () => {
    expect(montarUrlHistoricoCliente('cliente-1', 'atendimento-2')).toBe(
      '/api/atendimento-presencial/clientes/cliente-1/historico?atendimentoAtualId=atendimento-2'
    )
  })

  it('formata o resultado do atendimento como resposta clara para venda fechada', () => {
    expect(formatarVendaFechadaHistorico('sim')).toBe('Sim')
    expect(formatarVendaFechadaHistorico('nao')).toBe('Nao')
    expect(formatarVendaFechadaHistorico('negociacao')).toBe('Em negociacao')
    expect(formatarVendaFechadaHistorico(null)).toBe('Nao informado')
  })
})

describe('apresentação dos atendimentos no histórico', () => {
  const item: HistoricoAtendimentoClienteDTO = {
    id: 'historico', data: '2026-10-21T02:30:00Z', unidade: 'BIGORRILHO', consultora: 'AMANDA', resultado: 'Sim',
    departamentos: ['ROUPINHAS'], produtosInteresse: ['Lembrancinha para uma funcionária'], numeroLancamento: 30225,
  }
  it('interpreta os rótulos da API e as chaves legadas com tons semânticos', () => {
    expect(situacaoAtendimentoHistorico('Sim')).toEqual({ label: 'Venda fechada', tone: 'success' })
    expect(situacaoAtendimentoHistorico('Nao')).toEqual({ label: 'Venda perdida', tone: 'danger' })
    expect(situacaoAtendimentoHistorico('Ainda em negociacao')).toEqual({ label: 'Em negociação', tone: 'warning' })
    expect(situacaoAtendimentoHistorico('negociacao')).toEqual({ label: 'Em negociação', tone: 'warning' })
    expect(situacaoAtendimentoHistorico(null)).toEqual({ label: 'Não informada', tone: 'neutral' })
  })
  it('mantém dados históricos desconhecidos sem presumir quantidade, venda ou PV zero', () => {
    const html = renderToStaticMarkup(createElement(HistoricoAtendimentoCard, { item }))
    for (const texto of ['20/10/2026', 'BIGORRILHO', 'AMANDA', '30225', 'Departamentos de interesse', 'Venda fechada', 'Quantidade', 'Não informada', 'PV não informado', 'Informação histórica incompleta.']) expect(html).toContain(texto)
    expect(html).not.toContain('PV: 0')
    expect(html).toContain('independentes dos itens oficiais do SGI')
  })
  it('preserva quantidades e situação dos produtos sem confundir interesse com venda', () => {
    const html = renderToStaticMarkup(createElement(HistoricoAtendimentoCard, { item: { ...item, versaoProdutos: 2, produtosInteresse: [
      { descricao: 'MACACÃO', quantidade: 3, vendido: true }, { descricao: 'MANTA', quantidade: 2, vendido: false },
    ] } }))
    for (const texto of ['MACACÃO', 'MANTA', 'Vendido', 'Não vendido', 'PV: 3']) expect(html).toContain(texto)
  })
  it('apresenta ausência de dados e marcador de produto sem inventar venda', () => {
    const vazio = renderToStaticMarkup(createElement(HistoricoAtendimentoCard, { item: { ...item, consultora: null, unidade: null, resultado: null, numeroLancamento: null, produtosInteresse: [], departamentos: [] } }))
    expect(vazio).toContain('Nenhum produto de interesse informado.')
    expect(vazio).not.toContain('Venda fechada')
    const marcador = renderToStaticMarkup(createElement(HistoricoAtendimentoCard, { item: { ...item, produtosInteresse: ['PRODUTO QUE NÃO TRABALHAMOS'] } }))
    expect(marcador).toContain('Não entra no cálculo de peças vendidas.')
  })
})
