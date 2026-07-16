import {
  buscarMensagensContatoPaginado,
  MENSAGENS_CONTATO_MAX_MESSAGES,
  MENSAGENS_CONTATO_MAX_PAGES,
  MENSAGENS_CONTATO_PER_PAGE,
  type BuscarMensagensContatoResultado,
} from '@/lib/digisac/mensagens-contato'
import type { DigisacMensagem } from '@/lib/digisac/sgi-sync'

export const JANELA_FALLBACK_DIAS_CONTATO = 30
export const JANELA_HISTORICO_AMPLIADO_DIAS_CONTATO = 90
export const CONTEXTO_CONTATO_MAX_MENSAGENS_PROMPT = 300
export const CONTEXTO_CONTATO_MAX_CHARS = 28000

export type GrupoMensagemComplementar = 'ticket_atual' | 'outro_ticket' | 'sem_ticket'
export type CamadaContextoContato = 'contexto_proximo' | 'historico_ampliado'

export type VendaAnteriorReferenciaContato = {
  numeroLancamento: string
  dataFechamento: string | null
  produtos?: Array<{
    produto?: string | null
    departamento?: string | null
    subgrupo?: string | null
  }>
}

export type MensagemComplementarIA = {
  id: string | null
  ticketId: string | null
  contactId: string | null
  timestampMs: number
  autor: 'Atendente' | 'Cliente'
  tipo: string | null
  conteudo: string
  grupo: GrupoMensagemComplementar
  camada: CamadaContextoContato
  relacaoVendaAnterior: string | null
  scoreComercial: number
}

export type ContextoComplementarContatoIA = {
  disponivel: boolean
  motivoIndisponivel: string | null
  contactIdsConsultados: string[]
  janelaInicio: string | null
  janelaInicioMaxima90d: string | null
  janelaInicioContextoProximo: string | null
  janelaFim: string | null
  janelaOrigem: 'periodo_valido' | 'venda_anterior' | 'fallback_30_dias' | null
  totalApi: number
  totalNaJanela: number
  mensagensTicketAtual: number
  mensagensOutrosTickets: number
  mensagensSemTicket: number
  mensagensContextoProximo: number
  mensagensHistoricoAmpliado: number
  mensagensDescartadas: number
  deduplicadas: number
  priorizadas: number
  enviadasPrompt: number
  truncado: boolean
  mensagensSemTicketPrompt: MensagemComplementarIA[]
  mensagensOutrosTicketsPrompt: MensagemComplementarIA[]
  mensagensContextoProximoPrompt: MensagemComplementarIA[]
  mensagensHistoricoAmpliadoPrompt: MensagemComplementarIA[]
}

export type BuscarContextoComplementarContatoOptions = {
  contactIds: Array<string | null | undefined>
  ticketIdsPrincipais: string[]
  dataFechamentoVenda: string | null | undefined
  dataInicioPeriodoValido?: string | null | undefined
  dataFechamentoVendaAnterior?: string | null | undefined
  vendasAnteriores?: VendaAnteriorReferenciaContato[]
  palavrasChaveProdutos?: string[]
  perPage?: number
  maxPages?: number
  maxMessages?: number
  maxMensagensPrompt?: number
  maxCharsPrompt?: number
  fetcher?: (
    contactId: string,
    options: {
      perPage: number
      maxPages: number
      maxMessages: number
      inicioISO: string
      fimISO: string
    }
  ) => Promise<BuscarMensagensContatoResultado>
}

type JanelaContato = {
  inicioISO: string
  inicioMaximoISO: string
  inicioContextoProximoISO: string
  fimISO: string
  origem: 'periodo_valido' | 'venda_anterior' | 'fallback_30_dias'
  inicioContextoProximoMs: number
}

function parseMs(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null
  const ms = typeof raw === 'number' ? raw * 1000 : Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

function formatarDataHora(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function calcularJanelaComercialContato(
  dataFechamentoVenda: string | null | undefined,
  dataInicioPeriodoValido?: string | null | undefined,
  dataFechamentoVendaAnterior?: string | null | undefined
): JanelaContato | null {
  const fimMs = parseMs(dataFechamentoVenda)
  if (fimMs == null) return null

  const inicioPeriodoMs = parseMs(dataInicioPeriodoValido)
  const anteriorMs = parseMs(dataFechamentoVendaAnterior)
  const fallbackMs = fimMs - JANELA_FALLBACK_DIAS_CONTATO * 24 * 60 * 60 * 1000
  const origem =
    inicioPeriodoMs != null && inicioPeriodoMs < fimMs
      ? 'periodo_valido'
      : anteriorMs != null && anteriorMs < fimMs
      ? 'venda_anterior'
      : 'fallback_30_dias'
  const inicioContextoProximoMs =
    origem === 'periodo_valido'
      ? inicioPeriodoMs as number
      : origem === 'venda_anterior'
      ? anteriorMs as number
      : fallbackMs
  const inicioMaximoMs = inicioContextoProximoMs - JANELA_HISTORICO_AMPLIADO_DIAS_CONTATO * 24 * 60 * 60 * 1000

  return {
    inicioISO: new Date(inicioMaximoMs).toISOString(),
    inicioMaximoISO: new Date(inicioMaximoMs).toISOString(),
    inicioContextoProximoISO: new Date(inicioContextoProximoMs).toISOString(),
    fimISO: new Date(fimMs).toISOString(),
    origem,
    inicioContextoProximoMs,
  }
}

function normalizarTexto(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function normalizarBusca(raw: string): string {
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function mascararUrls(raw: string): string {
  return raw.replace(/https?:\/\/\S+/gi, '[link]')
}

function extrairTextoQuoted(quotedMessage: unknown): string | null {
  if (!quotedMessage || typeof quotedMessage !== 'object') return null
  const text = (quotedMessage as { text?: unknown }).text
  return typeof text === 'string' && text.trim() ? normalizarTexto(text).slice(0, 180) : null
}

export function extrairConteudoMensagemComplementar(msg: DigisacMensagem): string | null {
  const texto = typeof msg.text === 'string' ? normalizarTexto(mascararUrls(msg.text)) : ''
  const citacao = extrairTextoQuoted(msg.quotedMessage)
  const partes: string[] = []

  if (texto) partes.push(texto)
  if (citacao) partes.push(`citacao: ${mascararUrls(citacao)}`)

  if (partes.length > 0) return partes.join(' | ').slice(0, 900)

  if (msg.file || msg.preview || msg.thumbnail) {
    const tipo = msg.type ?? 'midia'
    if (tipo.includes('audio') || tipo === 'ptt') return '[audio enviado sem transcricao]'
    if (tipo.includes('image')) return '[imagem enviada sem legenda]'
    if (tipo.includes('video')) return '[video enviado sem legenda]'
    return '[arquivo enviado sem texto]'
  }

  return null
}

function deveDescartarMensagem(msg: DigisacMensagem): boolean {
  if (msg.visible !== true) return true
  if (!msg.id && !msg.timestamp) return true
  if (msg.isComment === true) return true
  if (msg.type === 'reaction' || msg.type === 'ticket') return true
  if (msg.data?.ticketTransfer === true) return true
  if (msg.deletedAt) return true
  if (!extrairConteudoMensagemComplementar(msg)) return true
  return false
}

function chaveDedup(msg: DigisacMensagem, conteudo: string): string {
  if (msg.id) return `id:${msg.id}`
  return [
    'fallback',
    msg.timestamp ?? '',
    msg.isFromMe ? 'from_me' : 'from_client',
    msg.type ?? '',
    normalizarTexto(conteudo).toLowerCase(),
  ].join('|')
}

function termosProdutosDinamicos(palavras: string[]): string[] {
  const termos = new Set<string>()
  for (const palavra of palavras) {
    const limpa = normalizarBusca(palavra).replace(/[^a-z0-9\s]/g, ' ')
    for (const parte of limpa.split(/\s+/)) {
      if (parte.length >= 4) termos.add(parte)
    }
  }
  return Array.from(termos)
}

function scoreComercial(conteudo: string, palavrasChaveProdutos: string[]): number {
  const texto = normalizarBusca(conteudo)
  const termos = [
    'preco', 'valor', 'orcamento', 'desconto', 'promocao', 'pagamento', 'pix', 'cartao', 'parcel',
    'link', 'boleto', 'compr', 'fechar', 'pagar', 'loja', 'visita', 'separad', 'pronto',
    'entrega', 'retirada', 'frete', 'prazo', 'reserva', 'disponivel', 'disponibilidade',
    'modelo', 'cor', 'versao', 'medida', 'montagem', 'obje', 'reprovad', 'antifraude',
    'berco', 'comoda', 'roupeiro', 'cama', 'poltrona', 'colchao', 'carrinho', 'base',
    'romanzo', 'infanti', 'moises',
    ...termosProdutosDinamicos(palavrasChaveProdutos),
  ]
  return termos.reduce((total, termo) => total + (texto.includes(termo) ? 1 : 0), 0)
}

function relacaoComVendaAnterior(ms: number, vendas: VendaAnteriorReferenciaContato[]): string | null {
  const refs = vendas
    .map((v) => ({ numero: v.numeroLancamento, ms: parseMs(v.dataFechamento) }))
    .filter((v): v is { numero: string; ms: number } => Boolean(v.numero) && v.ms != null)
    .sort((a, b) => a.ms - b.ms)

  const anteriorOuIgual = [...refs].reverse().find((v) => v.ms <= ms)
  if (anteriorOuIgual) return `apos venda anterior #${anteriorOuIgual.numero}`

  const proxima = refs.find((v) => v.ms > ms)
  if (proxima) return `antes da venda anterior #${proxima.numero}`

  return null
}

function mensagemParaIA(
  msg: DigisacMensagem,
  conteudo: string,
  grupo: GrupoMensagemComplementar,
  camada: CamadaContextoContato,
  relacaoVendaAnterior: string | null,
  palavrasChaveProdutos: string[]
): MensagemComplementarIA | null {
  const ms = parseMs(msg.timestamp)
  if (ms == null) return null
  return {
    id: msg.id ?? null,
    ticketId: msg.ticketId ?? null,
    contactId: msg.contactId ?? null,
    timestampMs: ms,
    autor: msg.isFromMe ? 'Atendente' : 'Cliente',
    tipo: msg.type ?? null,
    conteudo,
    grupo,
    camada,
    relacaoVendaAnterior,
    scoreComercial: scoreComercial(conteudo, palavrasChaveProdutos),
  }
}

function selecionarMensagensPrompt(
  semTicket: MensagemComplementarIA[],
  outrosTickets: MensagemComplementarIA[],
  maxMensagens: number,
  maxChars: number
): { semTicket: MensagemComplementarIA[]; outrosTickets: MensagemComplementarIA[]; truncado: boolean } {
  const ordenacaoPrioridade = (a: MensagemComplementarIA, b: MensagemComplementarIA) =>
    b.scoreComercial - a.scoreComercial || b.timestampMs - a.timestampMs
  const candidatas = [
    ...semTicket.map((m) => ({ ...m, prioridadeGrupo: 1, prioridadeCamada: m.camada === 'contexto_proximo' ? 2 : 1 })),
    ...outrosTickets.map((m) => ({ ...m, prioridadeGrupo: 0, prioridadeCamada: m.camada === 'contexto_proximo' ? 2 : 1 })),
  ].sort((a, b) =>
    b.prioridadeCamada - a.prioridadeCamada ||
    b.prioridadeGrupo - a.prioridadeGrupo ||
    ordenacaoPrioridade(a, b)
  )

  const escolhidas: MensagemComplementarIA[] = []
  let totalChars = 0
  let truncado = false

  for (const msg of candidatas) {
    const custo = msg.conteudo.length + 100
    if (escolhidas.length >= maxMensagens || totalChars + custo > maxChars) {
      truncado = true
      continue
    }
    escolhidas.push(msg)
    totalChars += custo
  }

  escolhidas.sort((a, b) => a.timestampMs - b.timestampMs)
  return {
    semTicket: escolhidas.filter((m) => m.grupo === 'sem_ticket'),
    outrosTickets: escolhidas.filter((m) => m.grupo === 'outro_ticket'),
    truncado,
  }
}

function contextoVazio(
  motivo: string,
  contactIds: string[] = [],
  janela: JanelaContato | null = null
): ContextoComplementarContatoIA {
  return {
    disponivel: false,
    motivoIndisponivel: motivo,
    contactIdsConsultados: contactIds,
    janelaInicio: janela?.inicioISO ?? null,
    janelaInicioMaxima90d: janela?.inicioMaximoISO ?? null,
    janelaInicioContextoProximo: janela?.inicioContextoProximoISO ?? null,
    janelaFim: janela?.fimISO ?? null,
    janelaOrigem: janela?.origem ?? null,
    totalApi: 0,
    totalNaJanela: 0,
    mensagensTicketAtual: 0,
    mensagensOutrosTickets: 0,
    mensagensSemTicket: 0,
    mensagensContextoProximo: 0,
    mensagensHistoricoAmpliado: 0,
    mensagensDescartadas: 0,
    deduplicadas: 0,
    priorizadas: 0,
    enviadasPrompt: 0,
    truncado: false,
    mensagensSemTicketPrompt: [],
    mensagensOutrosTicketsPrompt: [],
    mensagensContextoProximoPrompt: [],
    mensagensHistoricoAmpliadoPrompt: [],
  }
}

export async function buscarContextoComplementarContatoIA(
  options: BuscarContextoComplementarContatoOptions
): Promise<ContextoComplementarContatoIA> {
  const contactIds = Array.from(new Set(options.contactIds.map((id) => String(id ?? '').trim()).filter(Boolean)))
  const ticketIdsPrincipais = new Set(options.ticketIdsPrincipais.map((id) => id.trim()).filter(Boolean))
  const janela = calcularJanelaComercialContato(
    options.dataFechamentoVenda ?? null,
    options.dataInicioPeriodoValido ?? null,
    options.dataFechamentoVendaAnterior ?? null
  )

  if (contactIds.length === 0) return contextoVazio('sem_contact_id')
  if (!janela) return contextoVazio('sem_data_fechamento_venda', contactIds)

  const fetcher = options.fetcher ?? buscarMensagensContatoPaginado
  const perPage = options.perPage ?? MENSAGENS_CONTATO_PER_PAGE
  const maxPages = options.maxPages ?? MENSAGENS_CONTATO_MAX_PAGES
  const maxMessages = options.maxMessages ?? MENSAGENS_CONTATO_MAX_MESSAGES
  const maxMensagensPrompt = options.maxMensagensPrompt ?? CONTEXTO_CONTATO_MAX_MENSAGENS_PROMPT
  const maxCharsPrompt = options.maxCharsPrompt ?? CONTEXTO_CONTATO_MAX_CHARS
  const vendasAnteriores = options.vendasAnteriores ?? []
  const palavrasChaveProdutos = [
    ...(options.palavrasChaveProdutos ?? []),
    ...vendasAnteriores.flatMap((v) => v.produtos ?? []).flatMap((p) => [p.produto, p.departamento, p.subgrupo].filter(Boolean) as string[]),
  ]

  let totalApi = 0
  let totalNaJanela = 0
  let truncadoColeta = false
  const semTicket: MensagemComplementarIA[] = []
  const outrosTickets: MensagemComplementarIA[] = []
  let mensagensTicketAtual = 0
  let mensagensContextoProximo = 0
  let mensagensHistoricoAmpliado = 0
  let mensagensDescartadas = 0
  let deduplicadas = 0
  const dedup = new Set<string>()

  try {
    for (const contactId of contactIds) {
      const resultado = await fetcher(contactId, {
        perPage,
        maxPages,
        maxMessages,
        inicioISO: janela.inicioMaximoISO,
        fimISO: janela.fimISO,
      })
      totalApi += resultado.totalApi
      totalNaJanela += resultado.totalColetado
      truncadoColeta = truncadoColeta || resultado.truncado

      for (const msg of resultado.mensagens) {
        const conteudo = extrairConteudoMensagemComplementar(msg)
        if (!conteudo || deveDescartarMensagem(msg)) {
          mensagensDescartadas++
          continue
        }
        const chave = chaveDedup(msg, conteudo)
        if (dedup.has(chave)) {
          deduplicadas++
          continue
        }
        dedup.add(chave)

        const msgMs = parseMs(msg.timestamp)
        if (msgMs == null) {
          mensagensDescartadas++
          continue
        }

        const ticketId = msg.ticketId ?? null
        const grupo: GrupoMensagemComplementar = !ticketId
          ? 'sem_ticket'
          : ticketIdsPrincipais.has(ticketId)
          ? 'ticket_atual'
          : 'outro_ticket'
        const camada: CamadaContextoContato = msgMs >= janela.inicioContextoProximoMs ? 'contexto_proximo' : 'historico_ampliado'
        const ia = mensagemParaIA(msg, conteudo, grupo, camada, relacaoComVendaAnterior(msgMs, vendasAnteriores), palavrasChaveProdutos)
        if (!ia) {
          mensagensDescartadas++
          continue
        }

        if (grupo === 'ticket_atual') {
          mensagensTicketAtual++
        } else if (grupo === 'sem_ticket') {
          semTicket.push(ia)
          if (camada === 'contexto_proximo') mensagensContextoProximo++
          else mensagensHistoricoAmpliado++
        } else {
          outrosTickets.push(ia)
          if (camada === 'contexto_proximo') mensagensContextoProximo++
          else mensagensHistoricoAmpliado++
        }
      }
    }
  } catch {
    return contextoVazio('erro_api_digisac', contactIds, janela)
  }

  const selecionadas = selecionarMensagensPrompt(semTicket, outrosTickets, maxMensagensPrompt, maxCharsPrompt)
  const enviadasPrompt = selecionadas.semTicket.length + selecionadas.outrosTickets.length
  const todasSelecionadas = [...selecionadas.semTicket, ...selecionadas.outrosTickets]

  return {
    disponivel: true,
    motivoIndisponivel: null,
    contactIdsConsultados: contactIds,
    janelaInicio: janela.inicioISO,
    janelaInicioMaxima90d: janela.inicioMaximoISO,
    janelaInicioContextoProximo: janela.inicioContextoProximoISO,
    janelaFim: janela.fimISO,
    janelaOrigem: janela.origem,
    totalApi,
    totalNaJanela,
    mensagensTicketAtual,
    mensagensOutrosTickets: outrosTickets.length,
    mensagensSemTicket: semTicket.length,
    mensagensContextoProximo,
    mensagensHistoricoAmpliado,
    mensagensDescartadas,
    deduplicadas,
    priorizadas: enviadasPrompt,
    enviadasPrompt,
    truncado: truncadoColeta || selecionadas.truncado,
    mensagensSemTicketPrompt: selecionadas.semTicket,
    mensagensOutrosTicketsPrompt: selecionadas.outrosTickets,
    mensagensContextoProximoPrompt: todasSelecionadas.filter((m) => m.camada === 'contexto_proximo'),
    mensagensHistoricoAmpliadoPrompt: todasSelecionadas.filter((m) => m.camada === 'historico_ampliado'),
  }
}

function formatarLinhaMensagem(msg: MensagemComplementarIA, origem: string): string {
  const relacao = msg.relacaoVendaAnterior ? `; ${msg.relacaoVendaAnterior}` : ''
  return `[${formatarDataHora(msg.timestampMs)}] ${msg.autor} (${origem}${relacao}): ${msg.conteudo}`
}

export function montarContextoComplementarContato(contexto: ContextoComplementarContatoIA): string {
  if (!contexto.disponivel) {
    return `## CONTEXTO COMPLEMENTAR DO CONTATO - MENSAGENS FORA DO TICKET PRINCIPAL

Nao disponivel: ${contexto.motivoIndisponivel ?? 'motivo nao informado'}.
Nao use ausencia deste bloco como evidencia contra influencia comercial.`
  }

  const linhasProximo = contexto.mensagensContextoProximoPrompt.length > 0
    ? contexto.mensagensContextoProximoPrompt.map((m) => formatarLinhaMensagem(m, m.grupo === 'sem_ticket' ? 'sem ticket' : 'outro ticket no periodo')).join('\n')
    : '(nenhuma mensagem util no contexto complementar proximo)'

  const linhasHistorico = contexto.mensagensHistoricoAmpliadoPrompt.length > 0
    ? contexto.mensagensHistoricoAmpliadoPrompt.map((m) => formatarLinhaMensagem(m, m.grupo === 'sem_ticket' ? 'sem ticket' : 'outro ticket historico')).join('\n')
    : '(nenhuma mensagem util no historico ampliado)'

  return `## CONTEXTO COMPLEMENTAR DO CONTATO - MENSAGENS FORA DO TICKET PRINCIPAL

VENDA ATUAL
Esta e a venda que esta sendo analisada. Produtos, valores, pagamentos e dados desta venda pertencem a venda atual.

CHAMADOS DO CICLO ATUAL
O transcript principal e os chamados do ciclo atual continuam sendo a fonte principal para classificar influencia.

CONTEXTO COMPLEMENTAR PROXIMO
Mensagens do mesmo contato dentro do periodo valido da venda, ou a janela curta de fallback quando nao ha abertura de periodo. Podem estar sem ticket ou vinculadas a outros tickets. Use para reconstruir a continuidade imediata da jornada.

CONTEXTO HISTORICO AMPLIADO - ATE 90 DIAS
Mensagens anteriores ao contexto proximo, dentro dos 90 dias anteriores a abertura do periodo valido da venda.
Use somente para identificar origem do interesse, retomadas, comparacao de produtos, objecoes antigas e continuidade da jornada.
Nao trate automaticamente esse historico como parte da venda atual. Nao atribua influencia sem evidencia de continuidade.

Janela historica adicional: ${contexto.janelaInicioMaxima90d ?? contexto.janelaInicio ?? 'nao informada'} ate ${contexto.janelaInicioContextoProximo ?? 'nao informado'}.
Periodo considerado ate a venda: ${contexto.janelaInicioContextoProximo ?? 'nao informado'} ate ${contexto.janelaFim ?? 'nao informada'} (${contexto.janelaOrigem ?? 'origem desconhecida'}).
Contatos consultados: ${contexto.contactIdsConsultados.length}. Total API: ${contexto.totalApi}. Na janela 90d: ${contexto.totalNaJanela}. Ticket principal removido: ${contexto.mensagensTicketAtual}. Contexto proximo: ${contexto.mensagensContextoProximo}. Historico ampliado: ${contexto.mensagensHistoricoAmpliado}. Outros tickets: ${contexto.mensagensOutrosTickets}. Sem ticket: ${contexto.mensagensSemTicket}. Descartadas: ${contexto.mensagensDescartadas}. Deduplicadas: ${contexto.deduplicadas}. Priorizadas: ${contexto.priorizadas}. Enviadas ao prompt: ${contexto.enviadasPrompt}. Truncado: ${contexto.truncado ? 'sim' : 'nao'}.

### CONTEXTO COMPLEMENTAR PROXIMO
${linhasProximo}

### CONTEXTO HISTORICO AMPLIADO - ATE 90 DIAS
${linhasHistorico}`
}

export function montarResumoLogContextoContato(contexto: ContextoComplementarContatoIA): string {
  return `inicio=${contexto.janelaInicioMaxima90d ?? contexto.janelaInicio ?? 'null'} fim=${contexto.janelaFim ?? 'null'} contatos=${contexto.contactIdsConsultados.length} totalApi=${contexto.totalApi} naJanela90d=${contexto.totalNaJanela} contextoPrincipal=${contexto.mensagensTicketAtual} contextoProximo=${contexto.mensagensContextoProximo} historicoAmpliado=${contexto.mensagensHistoricoAmpliado} outrosTickets=${contexto.mensagensOutrosTickets} semTicket=${contexto.mensagensSemTicket} descartadas=${contexto.mensagensDescartadas} deduplicadas=${contexto.deduplicadas} priorizadas=${contexto.priorizadas} enviadasPrompt=${contexto.enviadasPrompt} truncado=${contexto.truncado ? 'true' : 'false'}`
}
