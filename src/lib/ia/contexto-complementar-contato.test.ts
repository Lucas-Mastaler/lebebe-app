import { describe, expect, it } from 'vitest'
import {
  JANELA_FALLBACK_DIAS_CONTATO,
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
  return async (): Promise<BuscarMensagensContatoResultado> => ({
    mensagens,
    totalApi: mensagens.length,
    paginasBuscadas: 1,
    totalColetado: mensagens.length,
    truncado: false,
    ...extra,
  })
}

async function contexto(mensagens: DigisacMensagem[], extra: Partial<Parameters<typeof buscarContextoComplementarContatoIA>[0]> = {}) {
  return buscarContextoComplementarContatoIA({
    contactIds: [contactId],
    ticketIdsPrincipais: [ticketAtual],
    dataFechamentoVenda: vendaAtual,
    dataFechamentoVendaAnterior: vendaAnterior,
    fetcher: fetcher(mensagens),
    ...extra,
  })
}

describe('contexto complementar do contato IA', () => {
  it('remove mensagens do ticket principal do prompt', async () => {
    const result = await contexto([
      msg({ id: 'principal', ticketId: ticketAtual }),
      msg({ id: 'sem-ticket', ticketId: null }),
    ])

    expect(result.mensagensTicketAtual).toBe(1)
    expect(result.mensagensSemTicket).toBe(1)
    expect(result.mensagensSemTicketPrompt.map((m) => m.id)).toEqual(['sem-ticket'])
  })

  it('inclui mensagens sem ticket', async () => {
    const result = await contexto([msg({ ticketId: null })])

    expect(result.mensagensSemTicket).toBe(1)
    expect(montarContextoComplementarContato(result)).toContain('MENSAGENS SEM TICKET')
  })

  it('separa mensagens de outros tickets', async () => {
    const result = await contexto([msg({ ticketId: 'outro-ticket' })])

    expect(result.mensagensOutrosTickets).toBe(1)
    expect(result.mensagensOutrosTicketsPrompt[0]?.ticketId).toBe('outro-ticket')
  })

  it('descarta eventos type ticket', async () => {
    const result = await contexto([msg({ type: 'ticket' })])

    expect(result.mensagensDescartadas).toBe(1)
    expect(result.enviadasPrompt).toBe(0)
  })

  it('descarta transferencias tecnicas de ticket', async () => {
    const result = await contexto([msg({ data: { ticketTransfer: true } })])

    expect(result.mensagensDescartadas).toBe(1)
  })

  it('descarta reactions', async () => {
    const result = await contexto([msg({ type: 'reaction' })])

    expect(result.mensagensDescartadas).toBe(1)
  })

  it('descarta mensagens invisiveis', async () => {
    const result = await contexto([msg({ visible: false })])

    expect(result.mensagensDescartadas).toBe(1)
  })

  it('descarta mensagens sem visible true', async () => {
    const result = await contexto([msg({ visible: undefined })])

    expect(result.mensagensDescartadas).toBe(1)
  })

  it('descarta comentarios internos', async () => {
    const result = await contexto([msg({ isComment: true })])

    expect(result.mensagensDescartadas).toBe(1)
  })

  it('descarta registros apagados ou vazios', async () => {
    const result = await contexto([
      msg({ id: 'apagada', deletedAt: '2026-07-07T10:01:00Z' }),
      msg({ id: 'vazia', text: '', file: null, preview: null, thumbnail: null }),
    ])

    expect(result.mensagensDescartadas).toBe(2)
  })

  it('deduplica por id', async () => {
    const result = await contexto([
      msg({ id: 'dup', text: 'preco do berco' }),
      msg({ id: 'dup', text: 'preco do berco' }),
    ])

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

  it('calcula janela pela venda anterior quando existe', () => {
    const janela = calcularJanelaComercialContato(vendaAtual, vendaAnterior)

    expect(janela?.inicioISO).toBe('2026-06-22T15:44:50.000Z')
    expect(janela?.fimISO).toBe('2026-07-07T20:59:26.000Z')
    expect(janela?.origem).toBe('venda_anterior')
  })

  it('calcula fallback de 30 dias quando nao ha venda anterior', () => {
    const janela = calcularJanelaComercialContato(vendaAtual, null)
    const diffDias = (Date.parse(vendaAtual) - Date.parse(janela?.inicioISO ?? '')) / (24 * 60 * 60 * 1000)

    expect(diffDias).toBe(JANELA_FALLBACK_DIAS_CONTATO)
    expect(janela?.origem).toBe('fallback_30_dias')
  })

  it('retorna indisponivel sem contactId', async () => {
    const result = await buscarContextoComplementarContatoIA({
      contactIds: [],
      ticketIdsPrincipais: [ticketAtual],
      dataFechamentoVenda: vendaAtual,
      fetcher: fetcher([]),
    })

    expect(result.disponivel).toBe(false)
    expect(result.motivoIndisponivel).toBe('sem_contact_id')
  })

  it('retorna indisponivel sem data de fechamento', async () => {
    const result = await buscarContextoComplementarContatoIA({
      contactIds: [contactId],
      ticketIdsPrincipais: [ticketAtual],
      dataFechamentoVenda: null,
      fetcher: fetcher([]),
    })

    expect(result.disponivel).toBe(false)
    expect(result.motivoIndisponivel).toBe('sem_data_fechamento_venda')
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

  it('prioriza sinais comerciais quando trunca prompt', async () => {
    const mensagens = Array.from({ length: 8 }, (_, i) => msg({
      id: `generica-${i}`,
      text: `mensagem generica ${i}`,
      timestamp: `2026-07-07T10:0${i}:00Z`,
    }))
    mensagens.push(msg({
      id: 'comercial',
      text: 'cliente pediu valor, desconto e link de pagamento do berco',
      timestamp: '2026-07-07T10:09:00Z',
    }))

    const result = await contexto(mensagens, { maxMensagensPrompt: 2 })

    expect(result.truncado).toBe(true)
    expect(result.mensagensSemTicketPrompt.map((m) => m.id)).toContain('comercial')
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

  it('cobre fixture comercial da venda 65431', async () => {
    const principais = Array.from({ length: 11 }, (_, i) => msg({
      id: `principal-${i}`,
      ticketId: ticketAtual,
      timestamp: `2026-07-07T09:${String(i).padStart(2, '0')}:00Z`,
    }))
    const semTicket = Array.from({ length: 78 }, (_, i) => msg({
      id: `sem-ticket-${i}`,
      ticketId: null,
      text: i === 0 ? 'cliente pediu valor do berco Romanzo e link de pagamento' : `continuidade comercial ${i}`,
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
    expect(result.mensagensSemTicketPrompt.some((m) => m.conteudo.includes('Romanzo'))).toBe(true)
  })
})
