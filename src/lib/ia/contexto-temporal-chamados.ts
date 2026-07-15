import { gerarVariacoesTelefone, type DigisacMensagem } from '@/lib/digisac/sgi-sync'
import { extrairTrechosFatuais } from '@/lib/ia/extrair-trechos-fatuais'
import { montarTranscriptChamado } from '@/lib/ia/transcript'

export const LIMITE_CHAMADOS_ANTERIORES_IA = 3
const TIME_ZONE = 'America/Sao_Paulo'

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

type ConversaRow = {
  digisac_ticket_id?: string | null
  protocolo?: string | null
  telefone_normalizado?: string | null
  telefone_normalizado_ddi?: string | null
  comments?: string | null
  started_at?: string | null
  ended_at?: string | null
  inicio_chamado?: string | null
  department_nome?: string | null
  user_nome?: string | null
}

type VinculoRow = {
  numero_lancamento?: string | null
  digisac_ticket_id?: string | null
  data_conversa?: string | null
  considerada_no_ciclo_venda?: boolean | null
  data_inicio_ciclo_venda?: string | null
  data_fim_ciclo_venda?: string | null
  numero_lancamento_venda_anterior?: string | null
}

type ContatoRow = {
  telefone_normalizado?: string | null
  telefone_normalizado_ddi?: string | null
}

type AnaliseRow = {
  digisac_ticket_id?: string | null
  numero_lancamento?: string | null
  resumo_chamado?: string | null
  status?: string | null
}

export type ContextoTemporalChamadoIA = {
  fechamentoVenda: string | null
  fechamentoVendaTemHora: boolean
  emissaoVenda: string | null
  inicioCiclo: string | null
  fimCiclo: string | null
  inicioChamado: string | null
  ultimaMensagemAntesFechamento: string | null
  primeiraMensagemDepoisFechamento: string | null
  intervaloInicioAteFechamento: string | null
  intervaloUltimaMensagemAteFechamento: string | null
  mensagensAntesFechamento: number
  mensagensDepoisFechamento: number
  chamadoComecouAntesFechamento: boolean | null
  houveMensagemAntesFechamento: boolean
  houveMensagemDepoisFechamento: boolean
}

export type ChamadoAnteriorIA = {
  ticketId: string
  protocolo: string | null
  inicio: string | null
  ultimaMensagem: string | null
  tipoInicio: string | null
  departamento: string | null
  consultora: string | null
  resumo: string | null
  trechosRelevantes: string[]
  vinculoVendaAnterior: string | null
}

export type ContextoChamadosAnterioresIA = {
  criterioIdentificacao: 'telefone'
  limiteChamados: number
  inicioCicloAtual: string | null
  chamados: ChamadoAnteriorIA[]
  totalCandidatosAntesLimite: number
  tamanhoContextoChars: number
}

function parseDataMs(raw: string | null | undefined): number | null {
  if (!raw) return null
  const ms = new Date(raw).getTime()
  return Number.isNaN(ms) ? null : ms
}

function temHoraExplicita(raw: string | null | undefined): boolean {
  if (!raw) return false
  return /(?:T|\s)\d{1,2}:\d{2}/.test(raw)
}

export function extrairTimestampMensagemMs(msg: Pick<DigisacMensagem, 'timestamp'>): number | null {
  const raw = msg.timestamp
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isNaN(n) && n > 0) {
    return n > 10_000_000_000 ? n : n * 1000
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

function formatarDataHora(raw: string | number | null | undefined, incluirSegundos = true): string {
  const ms = typeof raw === 'number' ? raw : parseDataMs(raw)
  if (ms == null) return 'Nao informado'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: incluirSegundos ? '2-digit' : undefined,
    hour12: false,
  }).format(new Date(ms))
}

function descreverIntervalo(ms: number): string {
  const abs = Math.abs(ms)
  const totalMin = Math.floor(abs / 60_000)
  const dias = Math.floor(totalMin / (60 * 24))
  const horas = Math.floor((totalMin - dias * 60 * 24) / 60)
  const minutos = totalMin % 60
  const partes: string[] = []
  if (dias > 0) partes.push(`${dias} dia${dias === 1 ? '' : 's'}`)
  if (horas > 0) partes.push(`${horas} hora${horas === 1 ? '' : 's'}`)
  if (minutos > 0 || partes.length === 0) partes.push(`${minutos} minuto${minutos === 1 ? '' : 's'}`)
  return `aproximadamente ${partes.join(' e ')}`
}

function mensagensValidas(mensagens: DigisacMensagem[]): Array<{ msg: DigisacMensagem; ms: number }> {
  return mensagens
    .map((msg) => ({ msg, ms: extrairTimestampMensagemMs(msg) }))
    .filter((item): item is { msg: DigisacMensagem; ms: number } => item.ms != null)
    .sort((a, b) => a.ms - b.ms)
}

export function calcularContextoTemporalChamado(params: {
  dataFechamentoVenda: string | null
  emissaoVenda?: string | null
  inicioChamado: string | null
  inicioCiclo?: string | null
  fimCiclo?: string | null
  mensagens: DigisacMensagem[]
}): ContextoTemporalChamadoIA {
  const fechamentoMs = parseDataMs(params.dataFechamentoVenda)
  const inicioChamadoMs = parseDataMs(params.inicioChamado)
  const mensagensComTempo = mensagensValidas(params.mensagens)

  const antes = fechamentoMs == null ? [] : mensagensComTempo.filter((m) => m.ms <= fechamentoMs)
  const depois = fechamentoMs == null ? [] : mensagensComTempo.filter((m) => m.ms > fechamentoMs)
  const ultimaAntes = antes.at(-1) ?? null
  const primeiraDepois = depois[0] ?? null

  return {
    fechamentoVenda: params.dataFechamentoVenda,
    fechamentoVendaTemHora: temHoraExplicita(params.dataFechamentoVenda),
    emissaoVenda: params.emissaoVenda ?? null,
    inicioCiclo: params.inicioCiclo ?? null,
    fimCiclo: params.fimCiclo ?? null,
    inicioChamado: params.inicioChamado,
    ultimaMensagemAntesFechamento: ultimaAntes ? new Date(ultimaAntes.ms).toISOString() : null,
    primeiraMensagemDepoisFechamento: primeiraDepois ? new Date(primeiraDepois.ms).toISOString() : null,
    intervaloInicioAteFechamento:
      fechamentoMs != null && inicioChamadoMs != null ? descreverIntervalo(fechamentoMs - inicioChamadoMs) : null,
    intervaloUltimaMensagemAteFechamento:
      fechamentoMs != null && ultimaAntes ? descreverIntervalo(fechamentoMs - ultimaAntes.ms) : null,
    mensagensAntesFechamento: antes.length,
    mensagensDepoisFechamento: depois.length,
    chamadoComecouAntesFechamento:
      fechamentoMs != null && inicioChamadoMs != null ? inicioChamadoMs <= fechamentoMs : null,
    houveMensagemAntesFechamento: antes.length > 0,
    houveMensagemDepoisFechamento: depois.length > 0,
  }
}

export function montarBlocoTemporalChamadoIA(contexto: ContextoTemporalChamadoIA): string {
  const fechamento = contexto.fechamentoVenda
    ? `${formatarDataHora(contexto.fechamentoVenda)}${contexto.fechamentoVendaTemHora ? '' : ' (hora nao disponivel no dado original)'}`
    : 'Nao informado'

  return `## CONTEXTO TEMPORAL DA VENDA E DO CHAMADO

VENDA ATUAL
- Fechamento no sistema: ${fechamento}
- Emissao no sistema: ${contexto.emissaoVenda ?? 'Nao informada'}
- Inicio do ciclo da venda: ${formatarDataHora(contexto.inicioCiclo)}
- Fim do ciclo da venda: ${formatarDataHora(contexto.fimCiclo)}

CHAMADO ANALISADO
- Inicio do chamado: ${formatarDataHora(contexto.inicioChamado)}
- O chamado comecou antes do fechamento: ${contexto.chamadoComecouAntesFechamento == null ? 'nao confirmado' : contexto.chamadoComecouAntesFechamento ? 'sim' : 'nao'}
- Ultima mensagem antes da venda: ${formatarDataHora(contexto.ultimaMensagemAntesFechamento, false)}
- Primeira mensagem depois da venda: ${formatarDataHora(contexto.primeiraMensagemDepoisFechamento, false)}
- Intervalo entre o inicio do chamado e o fechamento: ${contexto.intervaloInicioAteFechamento ?? 'nao calculado'}
- Intervalo entre a ultima mensagem anterior ao fechamento e a venda: ${contexto.intervaloUltimaMensagemAteFechamento ?? 'nao calculado'}
- Mensagens antes do fechamento: ${contexto.mensagensAntesFechamento}
- Mensagens depois do fechamento: ${contexto.mensagensDepoisFechamento}

Use estes dados temporais para diferenciar atendimento antes da venda, atendimento depois da venda e logistica que ajudou a conduzir a finalizacao. Nunca afirme que a venda ja estava registrada antes do chamado sem comparar estes horarios.`
}

function coletarVariacoesTelefones(contatos: ContatoRow[]): string[] {
  const variacoes = new Set<string>()
  for (const contato of contatos) {
    if (contato.telefone_normalizado) {
      gerarVariacoesTelefone(contato.telefone_normalizado).forEach((v) => variacoes.add(v))
    }
    if (contato.telefone_normalizado_ddi) {
      gerarVariacoesTelefone(contato.telefone_normalizado_ddi).forEach((v) => variacoes.add(v))
    }
  }
  return Array.from(variacoes)
}

function limitarTrechos(trechos: string[]): string[] {
  return trechos.slice(0, 8).map((t) => t.slice(0, 220))
}

async function buscarTrechosHistoricos(ticketId: string, transcriptFetcher: (ticketId: string) => Promise<{ transcript: string; mensagens?: DigisacMensagem[] }>): Promise<{ trechos: string[]; ultimaMensagem: string | null }> {
  try {
    const { transcript, mensagens } = await transcriptFetcher(ticketId)
    const trechos = limitarTrechos(extrairTrechosFatuais(transcript))
    const ultima = mensagens && mensagens.length > 0
      ? mensagensValidas(mensagens).at(-1)?.ms ?? null
      : null
    return {
      trechos,
      ultimaMensagem: ultima ? new Date(ultima).toISOString() : null,
    }
  } catch {
    return { trechos: [], ultimaMensagem: null }
  }
}

export async function buscarContextoChamadosAnterioresIA(
  supabase: SupabaseLike,
  numeroLancamento: string,
  options: {
    limiteChamados?: number
    transcriptFetcher?: (ticketId: string) => Promise<{ transcript: string; mensagens?: DigisacMensagem[] }>
  } = {}
): Promise<ContextoChamadosAnterioresIA> {
  const limiteChamados = options.limiteChamados ?? LIMITE_CHAMADOS_ANTERIORES_IA
  const transcriptFetcher = options.transcriptFetcher ?? montarTranscriptChamado
  const numeroAtual = numeroLancamento.trim()

  const { data: vinculosRaw } = await supabase
    .from('venda_conversa_vinculos')
    .select('digisac_ticket_id, data_conversa, considerada_no_ciclo_venda, data_inicio_ciclo_venda, data_fim_ciclo_venda')
    .eq('numero_lancamento', numeroAtual)

  const vinculos = (vinculosRaw ?? []) as VinculoRow[]
  const idsCicloAtual = new Set(vinculos.map((v) => v.digisac_ticket_id).filter(Boolean) as string[])
  const inicioCicloAtual =
    vinculos.map((v) => v.data_inicio_ciclo_venda).filter(Boolean).sort()[0] ??
    vinculos.map((v) => v.data_conversa).filter(Boolean).sort()[0] ??
    null

  if (!inicioCicloAtual) {
    return {
      criterioIdentificacao: 'telefone',
      limiteChamados,
      inicioCicloAtual: null,
      chamados: [],
      totalCandidatosAntesLimite: 0,
      tamanhoContextoChars: 0,
    }
  }

  const { data: contatosRaw } = await supabase
    .from('sgi_documentos_saida_contatos')
    .select('telefone_normalizado, telefone_normalizado_ddi')
    .eq('numero_lancamento', numeroAtual)

  const variacoes = coletarVariacoesTelefones((contatosRaw ?? []) as ContatoRow[])
  if (variacoes.length === 0) {
    return {
      criterioIdentificacao: 'telefone',
      limiteChamados,
      inicioCicloAtual,
      chamados: [],
      totalCandidatosAntesLimite: 0,
      tamanhoContextoChars: 0,
    }
  }

  const [porTelefone, porDdi] = await Promise.all([
    supabase
      .from('digisac_conversas_resumo')
      .select('digisac_ticket_id, protocolo, telefone_normalizado, telefone_normalizado_ddi, comments, started_at, ended_at, inicio_chamado, department_nome, user_nome')
      .in('telefone_normalizado', variacoes)
      .lt('started_at', inicioCicloAtual)
      .order('started_at', { ascending: false })
      .limit(20),
    supabase
      .from('digisac_conversas_resumo')
      .select('digisac_ticket_id, protocolo, telefone_normalizado, telefone_normalizado_ddi, comments, started_at, ended_at, inicio_chamado, department_nome, user_nome')
      .in('telefone_normalizado_ddi', variacoes)
      .lt('started_at', inicioCicloAtual)
      .order('started_at', { ascending: false })
      .limit(20),
  ])

  const dedup = new Map<string, ConversaRow>()
  for (const row of [...((porTelefone.data ?? []) as ConversaRow[]), ...((porDdi.data ?? []) as ConversaRow[])]) {
    const ticketId = row.digisac_ticket_id
    if (!ticketId || idsCicloAtual.has(ticketId)) continue
    dedup.set(ticketId, row)
  }

  const candidatos = [...dedup.values()]
    .sort((a, b) => (parseDataMs(b.started_at) ?? 0) - (parseDataMs(a.started_at) ?? 0))

  const selecionados = candidatos.slice(0, limiteChamados)
  const ticketIds = selecionados.map((c) => c.digisac_ticket_id).filter(Boolean) as string[]

  const vinculoMap = new Map<string, string | null>()
  const resumoMap = new Map<string, string | null>()

  if (ticketIds.length > 0) {
    const [{ data: vinculosAnterioresRaw }, { data: analisesRaw }] = await Promise.all([
      supabase
        .from('venda_conversa_vinculos')
        .select('digisac_ticket_id, numero_lancamento, considerada_no_ciclo_venda')
        .in('digisac_ticket_id', ticketIds),
      supabase
        .from('digisac_chamados_analise_ia')
        .select('digisac_ticket_id, numero_lancamento, resumo_chamado, status')
        .in('digisac_ticket_id', ticketIds)
        .eq('status', 'concluido'),
    ])

    for (const v of (vinculosAnterioresRaw ?? []) as VinculoRow[]) {
      const ticketId = v.digisac_ticket_id
      if (!ticketId || v.numero_lancamento === numeroAtual) continue
      if (!vinculoMap.has(ticketId) || v.considerada_no_ciclo_venda) {
        vinculoMap.set(ticketId, v.numero_lancamento ?? null)
      }
    }

    for (const a of (analisesRaw ?? []) as AnaliseRow[]) {
      if (a.digisac_ticket_id && a.resumo_chamado && !resumoMap.has(a.digisac_ticket_id)) {
        resumoMap.set(a.digisac_ticket_id, a.resumo_chamado)
      }
    }
  }

  const chamados = await Promise.all(selecionados.map(async (c) => {
    const ticketId = c.digisac_ticket_id as string
    const historico = await buscarTrechosHistoricos(ticketId, transcriptFetcher)
    return {
      ticketId,
      protocolo: c.protocolo ?? null,
      inicio: c.started_at ?? null,
      ultimaMensagem: historico.ultimaMensagem ?? c.ended_at ?? null,
      tipoInicio: c.inicio_chamado ?? null,
      departamento: c.department_nome ?? null,
      consultora: c.user_nome ?? null,
      resumo: resumoMap.get(ticketId) ?? c.comments ?? null,
      trechosRelevantes: historico.trechos,
      vinculoVendaAnterior: vinculoMap.get(ticketId) ?? null,
    }
  }))

  const bloco = montarBlocoChamadosAnterioresIA({
    criterioIdentificacao: 'telefone',
    limiteChamados,
    inicioCicloAtual,
    chamados,
    totalCandidatosAntesLimite: candidatos.length,
    tamanhoContextoChars: 0,
  })

  return {
    criterioIdentificacao: 'telefone',
    limiteChamados,
    inicioCicloAtual,
    chamados,
    totalCandidatosAntesLimite: candidatos.length,
    tamanhoContextoChars: bloco.length,
  }
}

export function montarBlocoChamadosAnterioresIA(contexto: ContextoChamadosAnterioresIA): string {
  if (contexto.chamados.length === 0) {
    return `## CHAMADOS ANTERIORES - CONTEXTO HISTORICO

Nenhum chamado anterior ao ciclo da venda atual foi encontrado pelo criterio atual (${contexto.criterioIdentificacao}).
Nao invente continuidade historica sem evidencia nos dados fornecidos.`
  }

  const chamados = contexto.chamados.map((c, index) => {
    const trechos = c.trechosRelevantes.length > 0
      ? c.trechosRelevantes.map((t) => `  - ${t}`).join('\n')
      : '  - Nenhum trecho relevante extraido deterministicamente.'

    return `### Chamado historico ${index + 1}
- Protocolo: ${c.protocolo ?? 'Nao informado'}
- ID tecnico interno: ${c.ticketId} (nao citar na resposta da IA)
- Inicio: ${formatarDataHora(c.inicio)}
- Ultima mensagem conhecida: ${formatarDataHora(c.ultimaMensagem, false)}
- Tipo: ${c.tipoInicio ?? 'Nao informado'}
- Loja/departamento: ${c.departamento ?? 'Nao informado'}
- Consultora: ${c.consultora ?? 'Nao informada'}
- Vinculo com venda anterior: ${c.vinculoVendaAnterior ?? 'Nao identificado'}
- Resumo: ${c.resumo ?? 'Nao informado'}
- Trechos relevantes limitados:
${trechos}`
  }).join('\n\n')

  return `## CHAMADOS ANTERIORES - CONTEXTO HISTORICO

Os chamados abaixo ocorreram antes do ciclo da venda atual.
Use-os somente para entender continuidade de atendimento, escolha anterior de produto, convite a loja, intencao de compra e retomadas.
Nao os trate automaticamente como chamados pertencentes a venda atual.
Nao transforme qualquer conversa antiga em influencia; use apenas quando houver sequencia coerente com o chamado atual e o fechamento.
Limite aplicado: ${contexto.limiteChamados} chamados anteriores, ordenados do mais recente para o mais antigo.
Inicio do ciclo atual: ${formatarDataHora(contexto.inicioCicloAtual)}

${chamados}`
}
