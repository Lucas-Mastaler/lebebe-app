import { describe, expect, it } from 'vitest'
import {
  CONTEXTO_CONTATO_MAX_MENSAGENS_PROMPT,
  JANELA_FALLBACK_DIAS_CONTATO,
  JANELA_HISTORICO_AMPLIADO_DIAS_CONTATO,
  buscarContextoComplementarContatoIA,
  calcularJanelaComercialContato,
  montarContextoComplementarContato,
} from './contexto-complementar-contato'
import type { BuscarMensagensContatoResultado } from '@/lib/digisac/mensagens-contato'
import type { DigisacMensagem } from '@/lib/digisac/sgi-sync'

const vendaAtual = '2026-07-07T20:59:26Z'
const vendaAnterior = '2026-06-22T15:44:50Z'
const ticketAtual = 'cf445253-edce-4b2d-a561-c9d9ee626b07'
const contactId = '67e15f97-a406-445b-9e6d-ae8ecc1f8a55'

function msg(overrides: Partial<DigisacMensagem> = {}): DigisacMensagem {
  return {
    id: 'm1',
    contactId,
    ticketId: null,
    timestamp: '2026-07-07T10:00:00Z',
    type: 'chat',
    text: 'cliente quer preco do berco e link de pagamento',
    visible: true,
    isComment: false,
    isFromMe: false,
    ...overrides,
  }
}

function fetcher(mensagens: DigisacMensagem[], extra: Partial<BuscarMensagensContatoResultado> = {}) {
  return async (_contactId: string, options: { inicioISO: string; fimISO: string }): Promise<BuscarMensagensContatoResultado> => {
    const inicioMs = Date.parse(options.inicioISO)
    const fimMs = Date.parse(options.fimISO)
    const naJanela = mensagens.filter((m) => {
      const ms = Date.parse(String(m.timestamp))
      return Number.isFinite(ms) && ms >= inicioMs && ms <= fimMs
    })
    return {
      mensagens: naJanela,
      totalApi: mensagens.length,
      paginasBuscadas: 1,
      totalColetado: naJanela.length,
      truncado: false,
      ...extra,
    }
  }
}

async function contexto(mensagens: DigisacMensagem[], extra: Partial<Parameters<typeof buscarContextoComplementarContatoIA>[0]> = {}) {
  return buscarContextoComplementarContatoIA({
    contactIds: [contactId],
    ticketIdsPrincipais: [ticketAtual],
    dataFechamentoVenda: vendaAtual,
    dataInicioPeriodoValido: vendaAnterior,
    dataFechamentoVendaAnterior: vendaAnterior,
    fetcher: fetcher(mensagens),
    ...extra,
  })
}

describe('contexto complementar do contato IA', () => {
  it('calcula janela maxima exata de 90 dias antes da abertura do periodo valido', () => {
    const janela = calcularJanelaComercialContato(vendaAtual, vendaAnterior, null)
    const diffDias = (Date.parse(vendaAnterior) - Date.parse(janela?.inicioMaximoISO ?? '')) / (24 * 60 * 60 * 1000)

    expect(diffDias).toBe(JANELA_HISTORICO_AMPLIADO_DIAS_CONTATO)
    expect(janela?.fimISO).toBe('2026-07-07T20:59:26.000Z')
    expect(janela?.origem).toBe('periodo_valido')
  })

  it('exclui mensagem com 91 dias antes da abertura do periodo valido', async () => {
    const result = await contexto([
      msg({ id: '91d', timestamp: '2026-03-23T15:44:49Z' }),
      msg({ id: 'dentro', timestamp: '2026-03-24T15:44:50Z' }),
    ])

    expect(result.totalNaJanela).toBe(1)
    expect(result.mensagensHistoricoAmpliado).toBe(1)
  })

  it('inclui mensagem no limite de 90 dias antes da abertura do periodo valido', async () => {
    const result = await contexto([msg({ id: 'limite', timestamp: '2026-03-24T15:44:50Z' })])

    expect(result.totalNaJanela).toBe(1)
    expect(result.mensagensHistoricoAmpliado).toBe(1)
  })

  it('com venda anterior separa contexto proximo e ampliado', async () => {
    const result = await contexto([
      msg({ id: 'antes-anterior', timestamp: '2026-06-10T10:00:00Z' }),
      msg({ id: 'depois-anterior', timestamp: '2026-06-23T10:00:00Z' }),
    ])

    expect(result.mensagensHistoricoAmpliado).toBe(1)
    expect(result.mensagensContextoProximo).toBe(1)
  })

  it('sem venda anterior usa fallback curto como contexto proximo e restante como historico', async () => {
    const result = await contexto([
      msg({ id: 'historico', timestamp: '2026-05-01T10:00:00Z' }),
      msg({ id: 'proximo', timestamp: '2026-06-20T10:00:00Z' }),
    ], { dataInicioPeriodoValido: null, dataFechamentoVendaAnterior: null })

    expect(result.janelaOrigem).toBe('fallback_30_dias')
    expect(result.mensagensHistoricoAmpliado).toBe(1)
    expect(result.mensagensContextoProximo).toBe(1)
  })

  it('mantem o fallback curto em 30 dias quando nao ha venda anterior', () => {
    const janela = calcularJanelaComercialContato(vendaAtual, null, null)
    const diffDias = (Date.parse(vendaAtual) - Date.parse(janela?.inicioContextoProximoISO ?? '')) / (24 * 60 * 60 * 1000)

    expect(diffDias).toBe(JANELA_FALLBACK_DIAS_CONTATO)
  })

  it('remove mensagens do ticket principal do prompt sem duplicar a venda atual', async () => {
    const result = await contexto([
      msg({ id: 'principal', ticketId: ticketAtual }),
      msg({ id: 'sem-ticket', ticketId: null }),
    ])

    expect(result.mensagensTicketAtual).toBe(1)
    expect(result.mensagensSemTicket).toBe(1)
    expect(result.mensagensSemTicketPrompt.map((m) => m.id)).toEqual(['sem-ticket'])
  })

  it('identifica mensagem relacionada a venda anterior', async () => {
    const result = await contexto([msg({ id: 'hist', timestamp: '2026-06-10T10:00:00Z' })], {
      vendasAnteriores: [{ numeroLancamento: '65295', dataFechamento: vendaAnterior }],
    })

    expect(result.mensagensHistoricoAmpliadoPrompt[0]?.relacaoVendaAnterior).toBe('antes da venda anterior #65295')
  })

  it('nao trata produto historico como oportunidade atual no bloco', async () => {
    const result = await contexto([msg({ id: 'berco', timestamp: '2026-06-10T10:00:00Z', text: 'sobre o berco comprado' })], {
      vendasAnteriores: [{ numeroLancamento: '65295', dataFechamento: vendaAnterior, produtos: [{ produto: 'BERCO ZUPY NEW MATIC' }] }],
    })

    expect(montarContextoComplementarContato(result)).toContain('Produtos, valores, pagamentos e dados desta venda pertencem a venda atual')
  })

  it('interesse antigo sem continuidade fica no historico ampliado', async () => {
    const result = await contexto([msg({ id: 'antigo', timestamp: '2026-04-20T10:00:00Z', text: 'bom dia' })])

    expect(result.mensagensHistoricoAmpliado).toBe(1)
    expect(result.mensagensContextoProximo).toBe(0)
  })

  it('interesse antigo com retomada explicita preserva historico e contexto proximo', async () => {
    const result = await contexto([
      msg({ id: 'antigo', timestamp: '2026-05-10T10:00:00Z', text: 'orcamento do carrinho Romanzo' }),
      msg({ id: 'retomada', timestamp: '2026-07-01T10:00:00Z', text: 'retomando aquele carrinho Romanzo para pagar' }),
    ])

    expect(result.mensagensHistoricoAmpliado).toBe(1)
    expect(result.mensagensContextoProximo).toBe(1)
  })

  it('prioriza comparacao de produto semanas antes', async () => {
    const result = await contexto([
      msg({ id: 'generica', timestamp: '2026-05-10T10:00:00Z', text: 'oi' }),
      msg({ id: 'comparacao', timestamp: '2026-05-11T10:00:00Z', text: 'comparando carrinho Romanzo com outro modelo' }),
    ], { maxMensagensPrompt: 1, palavrasChaveProdutos: ['CARRINHO TS ROMANZO DUO'] })

    expect(result.mensagensHistoricoAmpliadoPrompt.map((m) => m.id)).toEqual(['comparacao'])
  })

  it('preserva objecao antiga superada depois', async () => {
    const result = await contexto([
      msg({ id: 'objecao', timestamp: '2026-05-20T10:00:00Z', text: 'achei o frete caro' }),
      msg({ id: 'superada', timestamp: '2026-07-01T10:00:00Z', text: 'pode mandar o link de pagamento' }),
    ])

    expect(result.mensagensHistoricoAmpliadoPrompt.some((m) => m.id === 'objecao')).toBe(true)
    expect(result.mensagensContextoProximoPrompt.some((m) => m.id === 'superada')).toBe(true)
  })

  it('limita mais de 300 mensagens relevantes', async () => {
    const mensagens = Array.from({ length: 305 }, (_, i) => msg({
      id: `m-${i}`,
      text: `valor carrinho ${i}`,
      timestamp: `2026-07-01T10:${String(i % 60).padStart(2, '0')}:00Z`,
    }))

    const result = await contexto(mensagens, { maxCharsPrompt: 100000 })

    expect(result.enviadasPrompt).toBe(CONTEXTO_CONTATO_MAX_MENSAGENS_PROMPT)
    expect(result.truncado).toBe(true)
  })

  it('prioriza sinais comerciais no historico ampliado', async () => {
    const result = await contexto([
      msg({ id: 'baixa', timestamp: '2026-05-01T10:00:00Z', text: 'boa tarde' }),
      msg({ id: 'alta', timestamp: '2026-05-02T10:00:00Z', text: 'valor desconto parcelamento carrinho Romanzo' }),
    ], { maxMensagensPrompt: 1 })

    expect(result.mensagensHistoricoAmpliadoPrompt.map((m) => m.id)).toEqual(['alta'])
  })

  it('truncamento preserva contexto proximo antes do historico ampliado', async () => {
    const result = await contexto([
      msg({ id: 'historico-forte', timestamp: '2026-05-02T10:00:00Z', text: 'valor desconto parcelamento carrinho Romanzo' }),
      msg({ id: 'proximo', timestamp: '2026-07-02T10:00:00Z', text: 'mensagem proxima' }),
    ], { maxMensagensPrompt: 1 })

    expect(result.mensagensContextoProximoPrompt.map((m) => m.id)).toEqual(['proximo'])
  })

  it('inclui historico sem ticket', async () => {
    const result = await contexto([msg({ id: 'sem-ticket-hist', ticketId: null, timestamp: '2026-05-01T10:00:00Z' })])

    expect(result.mensagensSemTicket).toBe(1)
    expect(result.mensagensHistoricoAmpliado).toBe(1)
  })

  it('inclui historico com outros tickets', async () => {
    const result = await contexto([msg({ id: 'outro-ticket-hist', ticketId: 'outro-ticket', timestamp: '2026-05-01T10:00:00Z' })])

    expect(result.mensagensOutrosTickets).toBe(1)
    expect(result.mensagensHistoricoAmpliadoPrompt[0]?.ticketId).toBe('outro-ticket')
  })

  it('descarta eventos tecnicos', async () => {
    const result = await contexto([
      msg({ id: 'ticket', type: 'ticket' }),
      msg({ id: 'transfer', data: { ticketTransfer: true } }),
      msg({ id: 'reaction', type: 'reaction' }),
      msg({ id: 'invisivel', visible: false }),
      msg({ id: 'comentario', isComment: true }),
    ])

    expect(result.mensagensDescartadas).toBe(5)
    expect(result.enviadasPrompt).toBe(0)
  })

  it('nao quebra analise quando API Digisac falha', async () => {
    const result = await buscarContextoComplementarContatoIA({
      contactIds: [contactId],
      ticketIdsPrincipais: [ticketAtual],
      dataFechamentoVenda: vendaAtual,
      fetcher: async () => {
        throw new Error('timeout')
      },
    })

    expect(result.disponivel).toBe(false)
    expect(result.motivoIndisponivel).toBe('erro_api_digisac')
  })

  it('usa um fetch por contactId e permite reutilizacao pelo chamador dentro do job', async () => {
    const calls: string[] = []
    await buscarContextoComplementarContatoIA({
      contactIds: ['c1', 'c1', 'c2'],
      ticketIdsPrincipais: [ticketAtual],
      dataFechamentoVenda: vendaAtual,
      fetcher: async (id) => {
        calls.push(id)
        return { mensagens: [], totalApi: 0, paginasBuscadas: 1, totalColetado: 0, truncado: false }
      },
    })

    expect(calls).toEqual(['c1', 'c2'])
  })

  it('cobre fixture comercial da venda 65431 sem regressao', async () => {
    const principais = Array.from({ length: 11 }, (_, i) => msg({
      id: `principal-${i}`,
      ticketId: ticketAtual,
      timestamp: `2026-07-07T09:${String(i).padStart(2, '0')}:00Z`,
    }))
    const semTicket = Array.from({ length: 78 }, (_, i) => msg({
      id: `sem-ticket-${i}`,
      ticketId: null,
      text: i === 0 ? 'cliente pediu valor do carrinho Romanzo e link de pagamento' : `continuidade comercial ${i}`,
      timestamp: `2026-07-07T10:${String(i % 60).padStart(2, '0')}:00Z`,
    }))

    const result = await buscarContextoComplementarContatoIA({
      contactIds: [contactId],
      ticketIdsPrincipais: [ticketAtual],
      dataFechamentoVenda: vendaAtual,
      dataFechamentoVendaAnterior: vendaAnterior,
      fetcher: fetcher([...principais, ...semTicket], { totalApi: 90 }),
    })

    expect(result.contactIdsConsultados).toEqual([contactId])
    expect(result.totalApi).toBe(90)
    expect(result.mensagensTicketAtual).toBe(11)
    expect(result.mensagensSemTicket).toBe(78)
    expect(result.mensagensContextoProximo).toBe(78)
    expect(result.mensagensSemTicketPrompt.some((m) => m.conteudo.includes('Romanzo'))).toBe(true)
  })

  it('deduplica multiplos contactId com a mesma mensagem', async () => {
    const result = await buscarContextoComplementarContatoIA({
      contactIds: ['c1', 'c2'],
      ticketIdsPrincipais: [ticketAtual],
      dataFechamentoVenda: vendaAtual,
      fetcher: fetcher([msg({ id: 'dup' })]),
    })

    expect(result.deduplicadas).toBe(1)
    expect(result.mensagensSemTicket).toBe(1)
  })

  it('deduplica por fallback quando nao ha id', async () => {
    const result = await contexto([
      msg({ id: undefined, text: 'preco do berco' }),
      msg({ id: undefined, text: 'preco do berco' }),
    ])

    expect(result.deduplicadas).toBe(1)
    expect(result.mensagensSemTicket).toBe(1)
  })

  it('exclui mensagens posteriores ao fechamento', async () => {
    const result = await contexto([
      msg({ id: 'antes', timestamp: '2026-07-07T20:59:26Z' }),
      msg({ id: 'depois', timestamp: '2026-07-07T20:59:27Z' }),
    ])

    expect(result.totalNaJanela).toBe(1)
    expect(result.mensagensSemTicketPrompt.map((m) => m.id)).toEqual(['antes'])
  })

  it('mascara URLs no prompt sem remover evidencia de link', async () => {
    const result = await contexto([msg({ text: 'segue link https://pagamento.exemplo/abc para pagar' })])
    const bloco = montarContextoComplementarContato(result)

    expect(bloco).toContain('[link]')
    expect(bloco).not.toContain('https://pagamento.exemplo/abc')
  })

  it('mantem midia interpretavel como contexto', async () => {
    const result = await contexto([msg({ text: '', type: 'image', file: { id: 'file-1' } })])

    expect(result.mensagensSemTicketPrompt[0]?.conteudo).toBe('[imagem enviada sem legenda]')
  })
})
