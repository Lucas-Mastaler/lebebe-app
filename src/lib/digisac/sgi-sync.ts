import { fetchDigisac } from './clienteDigisac'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================
// TIPOS
// ============================================================

export interface DigisacTicket {
  id: string
  protocol?: string | number
  isOpen?: boolean
  comments?: string
  origin?: string
  startedAt?: string
  endedAt?: string
  metrics?: {
    ticketTime?: number
    messagingTime?: number
  }
  contact?: {
    id?: string
    name?: string
    data?: { number?: string }
    service?: { id?: string; name?: string }
    tags?: unknown[]
  }
  user?: { id?: string; name?: string }
  department?: { id?: string; name?: string }
  ticketTopics?: unknown[]
  firstMessage?: {
    id?: string
    type?: string
    text?: string
    isFromMe?: boolean
    visible?: boolean
    isComment?: boolean
    timestamp?: number
  } | null
}

export interface DigisacMensagem {
  id: string
  ticketId?: string
  type?: string
  text?: string
  isFromMe?: boolean
  visible?: boolean
  isComment?: boolean
  timestamp?: number
}

export interface BuscarTicketsOptions {
  dataInicioISO?: string | null
  usarUpdatedAt?: boolean
  perPage?: number
}

export interface ResumoTicket {
  digisac_ticket_id: string
  protocolo: string | null
  digisac_contact_id: string | null
  telefone_normalizado: string | null
  telefone_normalizado_ddi: string | null
  cliente_nome_digisac: string | null
  service_id: string | null
  service_nome: string | null
  department_id: string | null
  department_nome: string | null
  user_id: string | null
  user_nome: string | null
  status: string | null
  is_open: boolean | null
  comments: string | null
  started_at: string | null
  ended_at: string | null
  ticket_time_segundos: number | null
  messaging_time_segundos: number | null
  quantidade_interacoes: number | null
  interacoes_incompletas: boolean
  inicio_chamado: 'ativo' | 'receptivo' | 'indefinido'
  tags: unknown[]
  assuntos: unknown[]
  raw_json: unknown
  updated_at: string
}

// ============================================================
// 1. VARIAÇÕES DE TELEFONE (sem 9 tem prioridade)
// ============================================================

/**
 * Gera variações do telefone para busca no Digisac.
 * Prioriza versão sem o 9º dígito (padrão histórico do Digisac).
 * Input: qualquer formato. Output: array ordenado sem duplicatas.
 *
 * Exemplo: 5541984148660 →
 *   [554184148660, 5541984148660, 4184148660, 41984148660]
 */
export function gerarVariacoesTelefone(telefoneInput: string): string[] {
  const digits = telefoneInput.replace(/\D/g, '')

  const isCelComDDI = (t: string) =>
    t.length === 13 && t.startsWith('55') && /^55\d{2}9\d{8}$/.test(t)
  const isCelSemDDI = (t: string) =>
    t.length === 11 && /^\d{2}9\d{8}$/.test(t)

  const removerNono = (t: string, posNono: number) =>
    t.slice(0, posNono) + t.slice(posNono + 1)

  const variants: string[] = []

  if (isCelComDDI(digits)) {
    // 5541984148660 → posição 4 é o 9
    const semNonoDDI = removerNono(digits, 4) // 554184148660
    const semDDI = digits.slice(2) // 41984148660
    const semNonoSemDDI = removerNono(semDDI, 2) // 4184148660
    variants.push(semNonoDDI, digits, semNonoSemDDI, semDDI)
  } else if (isCelSemDDI(digits)) {
    // 41984148660 → posição 2 é o 9
    const semNono = removerNono(digits, 2) // 4184148660
    const comDDI = `55${digits}` // 5541984148660
    const semNonoComDDI = `55${semNono}` // 554184148660
    variants.push(semNonoComDDI, comDDI, semNono, digits)
  } else {
    // Não identificado como celular com 9: tenta com e sem DDI
    variants.push(digits)
    if (digits.startsWith('55') && digits.length > 2) {
      variants.push(digits.slice(2))
    } else if (digits.length >= 10) {
      variants.push(`55${digits}`)
    }
  }

  // Remove duplicatas mantendo ordem e filtra valores muito curtos
  return [...new Set(variants)].filter((v) => v.length >= 8)
}

// ============================================================
// 2. BUSCAR TICKETS POR UMA VARIAÇÃO DE TELEFONE (paginado)
// ============================================================

async function buscarTicketsPorTelefonePaginado(
  telefoneVariacao: string,
  opts: BuscarTicketsOptions
): Promise<DigisacTicket[]> {
  const { dataInicioISO = null, usarUpdatedAt = true, perPage = 50 } = opts
  const todos: DigisacTicket[] = []
  let page = 1

  while (true) {
    const where: Record<string, unknown> = {}

    if (dataInicioISO) {
      const filtroData = { $gte: dataInicioISO }
      where[usarUpdatedAt ? 'updatedAt' : 'startedAt'] = filtroData
    }

    const query = JSON.stringify({
      distinct: true,
      order: [['updatedAt', 'DESC']],
      where,
      include: [
        {
          model: 'firstMessage',
          attributes: [
            'id', 'type', 'text', 'timestamp', 'isFromMe', 'sent', 'data',
            'accountId', 'serviceId', 'contactId', 'fromId', 'toId', 'userId',
            'ticketId', 'isFromBot', 'isFromSync', 'visible', 'ticketUserId',
            'ticketDepartmentId', 'origin', 'botId', 'campaignId', 'isComment',
          ],
        },
        {
          model: 'contact',
          required: true,
          where: {
            visible: true,
            data: { number: { $like: `%${telefoneVariacao}%` } },
          },
          include: [
            { model: 'service', required: true },
            { model: 'tags' },
            { model: 'person' },
          ],
        },
        { model: 'user' },
        { model: 'department' },
        { model: 'ticketTopics' },
      ],
      page,
      perPage,
    })

    // CORREÇÃO CRÍTICA: BASE_URL já contém /api/v1 — usar apenas /tickets
    const endpoint = `/tickets?query=${encodeURIComponent(query)}`
    let resp: { data?: DigisacTicket[]; total?: number; currentPage?: number; lastPage?: number }

    // Lança erro em vez de silenciosamente retornar vazio
    resp = await fetchDigisac(endpoint)

    const items = Array.isArray(resp?.data) ? resp.data : []
    todos.push(...items)

    const lastPage = resp?.lastPage ?? 1
    if (items.length < perPage || page >= lastPage) break
    page++
  }

  return todos
}

// ============================================================
// 3. BUSCAR TICKETS COM TODAS AS VARIAÇÕES DE TELEFONE (dedup)
// ============================================================

export async function buscarTicketsPorTelefoneComVariacoes(
  telefoneBase: string,
  opts: BuscarTicketsOptions = {}
): Promise<{ tickets: DigisacTicket[]; variacaoUsada: string; erros: string[] }> {
  const variacoes = gerarVariacoesTelefone(telefoneBase)
  const todosMap = new Map<string, DigisacTicket>()
  const erros: string[] = []
  let variacaoUsada = variacoes[0] ?? telefoneBase

  console.log(`[DIGISAC] Telefone base: ${telefoneBase}`)
  console.log(`[DIGISAC] Variações testadas: ${variacoes.join(', ')}`)

  for (const variacao of variacoes) {
    try {
      const tickets = await buscarTicketsPorTelefonePaginado(variacao, opts)
      console.log(`[DIGISAC] ${variacao}: ${tickets.length} tickets`)

      if (tickets.length > 0) {
        variacaoUsada = variacao
        for (const t of tickets) {
          if (!todosMap.has(t.id)) todosMap.set(t.id, t)
        }
        console.log(
          `[DIGISAC] Encontrou ${tickets.length} tickets na variação ${variacao}. Parando demais variações deste telefone.`
        )
        break // Para aqui — não precisa testar outras variações
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[DIGISAC] ${variacao}: erro — ${msg}`)
      erros.push(`${variacao}: ${msg}`)
      if (msg.includes('autenticação') || msg.includes('401') || msg.includes('403')) {
        throw new Error(`Erro de autenticação Digisac: ${msg}`)
      }
    }
  }

  return { tickets: [...todosMap.values()], variacaoUsada, erros }
}

// ============================================================
// 4. BUSCAR MENSAGENS DE UM TICKET (paginado)
// ============================================================

export async function buscarMensagensTicketPaginado(
  ticketId: string,
  perPage = 100
): Promise<{ mensagens: DigisacMensagem[]; incompleto: boolean }> {
  const mensagens: DigisacMensagem[] = []
  let page = 1
  let incompleto = false

  while (true) {
    // CORREÇÃO CRÍTICA: BASE_URL já contém /api/v1 — usar apenas /messages
    const endpoint = `/messages?where[ticketId]=${encodeURIComponent(ticketId)}&perPage=${perPage}&page=${page}`
    let resp: { data?: DigisacMensagem[]; total?: number } | null = null

    try {
      resp = await fetchDigisac(endpoint)
    } catch (err) {
      console.error(`[sgi-sync] buscarMensagens ticketId=${ticketId} página ${page} erro:`, err)
      incompleto = true
      break
    }

    const items = Array.isArray(resp?.data) ? resp.data : []
    const uteis = items.filter(
      (m) => m.type === 'chat' && m.visible !== false && m.isComment !== true
    )
    mensagens.push(...uteis)

    if (items.length < perPage) break
    page++

    if (page > 50) {
      console.warn(`[sgi-sync] buscarMensagens ticketId=${ticketId} limite 50 páginas atingido`)
      incompleto = true
      break
    }
  }

  return { mensagens, incompleto }
}

// ============================================================
// 5. CALCULAR INÍCIO DO CHAMADO
// Retorna as mensagens se foram buscadas para evitar re-fetch
// ============================================================

export async function calcularInicioChamado(ticket: DigisacTicket): Promise<{
  inicio: 'ativo' | 'receptivo' | 'indefinido'
  mensagens: DigisacMensagem[] | null  // null = não buscado (firstMessage suficiente)
  incompleto: boolean
}> {
  const fm = ticket.firstMessage
  if (
    fm &&
    fm.type !== undefined &&
    fm.isFromMe !== undefined &&
    fm.visible !== false &&
    fm.isComment !== true
  ) {
    return {
      inicio: fm.isFromMe ? 'ativo' : 'receptivo',
      mensagens: null,
      incompleto: false,
    }
  }

  // Fallback: buscar mensagens
  const { mensagens, incompleto } = await buscarMensagensTicketPaginado(ticket.id)
  const primeira = mensagens.find(
    (m) => m.type === 'chat' && m.visible !== false && m.isComment !== true
  )

  return {
    inicio: primeira ? (primeira.isFromMe ? 'ativo' : 'receptivo') : 'indefinido',
    mensagens,
    incompleto,
  }
}

// ============================================================
// 6. CALCULAR QUANTIDADE DE INTERAÇÕES
// ============================================================

export function calcularQuantidadeInteracoes(mensagens: DigisacMensagem[]): number {
  return mensagens.filter(
    (m) => m.type === 'chat' && m.visible !== false && m.isComment !== true
  ).length
}

// ============================================================
// 5. MONTAR RESUMO DO TICKET para upsert
// ============================================================

export function montarResumoTicket(
  ticket: DigisacTicket,
  inicio: 'ativo' | 'receptivo' | 'indefinido',
  interacoes: number,
  incompleto: boolean,
  telefonePesquisado: string
): ResumoTicket {
  const contact = ticket.contact
  const telOriginal = contact?.data?.number ?? null

  return {
    digisac_ticket_id: ticket.id,
    protocolo: ticket.protocol != null ? String(ticket.protocol) : null,
    digisac_contact_id: contact?.id ?? null,
    telefone_normalizado: telOriginal ? normalizarTelefone(telOriginal) : normalizarTelefone(telefonePesquisado),
    telefone_normalizado_ddi: telOriginal ? normalizarTelefoneDDI(telOriginal) : normalizarTelefoneDDI(telefonePesquisado),
    cliente_nome_digisac: contact?.name ?? null,
    service_id: contact?.service?.id ?? null,
    service_nome: contact?.service?.name ?? null,
    department_id: ticket.department?.id ?? null,
    department_nome: ticket.department?.name ?? null,
    user_id: ticket.user?.id ?? null,
    user_nome: ticket.user?.name ?? null,
    status: ticket.isOpen === false ? 'fechado' : ticket.isOpen === true ? 'aberto' : null,
    is_open: ticket.isOpen ?? null,
    comments: ticket.comments ?? null,
    started_at: ticket.startedAt ?? null,
    ended_at: ticket.endedAt ?? null,
    ticket_time_segundos: ticket.metrics?.ticketTime ?? null,
    messaging_time_segundos: ticket.metrics?.messagingTime ?? null,
    quantidade_interacoes: interacoes,
    interacoes_incompletas: incompleto,
    inicio_chamado: inicio,
    tags: Array.isArray(contact?.tags) ? contact.tags : [],
    assuntos: Array.isArray(ticket.ticketTopics) ? ticket.ticketTopics : [],
    raw_json: ticket,
    updated_at: new Date().toISOString(),
  }
}

// ============================================================
// 6. RECALCULAR HISTÓRICO DO TELEFONE
// ============================================================

export async function recalcularHistoricoTelefone(
  telefoneDDI: string,
  nomeSgi: string | null,
  supabase: SupabaseClient
): Promise<void> {
  // CORREÇÃO CRÍTICA: query por TODAS as variações do telefone
  // O número salvo em telefone_normalizado_ddi pode ser a variação usada (ex: 554792629239)
  // enquanto telefoneDDI é o número original do SGI (ex: 5547992629239) — matchs por exact falham
  const variacoesTel = gerarVariacoesTelefone(telefoneDDI)

  const { data: tickets, error } = await supabase
    .from('digisac_conversas_resumo')
    .select('started_at, quantidade_interacoes, inicio_chamado, cliente_nome_digisac, digisac_ticket_id, ended_at, department_nome, user_nome')
    .in('telefone_normalizado_ddi', variacoesTel)
    .order('started_at', { ascending: true })

  if (error) {
    console.error(`[sgi-sync] recalcularHistorico erro leitura:`, error)
    return
  }

  // Mesmo sem tickets, faz upsert para registrar que o telefone foi consultado (atualiza cache)
  const total = tickets?.length ?? 0
  const ticketsSafe = tickets ?? []
  const totalInteracoes = ticketsSafe.reduce((acc, t) => acc + (t.quantidade_interacoes ?? 0), 0)
  const ativos = ticketsSafe.filter((t) => t.inicio_chamado === 'ativo').length
  const receptivos = ticketsSafe.filter((t) => t.inicio_chamado === 'receptivo').length
  const indefinidos = ticketsSafe.filter((t) => t.inicio_chamado === 'indefinido').length
  const primeiraConversa = ticketsSafe[0]?.started_at ?? null
  const ultimaConversa = ticketsSafe[ticketsSafe.length - 1]?.started_at ?? null
  const nomeDigisac = ticketsSafe.find((t) => t.cliente_nome_digisac)?.cliente_nome_digisac ?? null

  const resumo = ticketsSafe.map((t) => ({
    id: t.digisac_ticket_id,
    started_at: t.started_at,
    ended_at: t.ended_at,
    inicio_chamado: t.inicio_chamado,
    interacoes: t.quantidade_interacoes ?? 0,
    department: t.department_nome,
    user: t.user_nome,
  }))

  const telefoneSemDDI = normalizarTelefone(telefoneDDI)

  const { error: upsertErr } = await supabase
    .from('digisac_cliente_historico_resumo')
    .upsert(
      {
        telefone_normalizado: telefoneSemDDI,
        telefone_normalizado_ddi: telefoneDDI,
        cliente_nome_sgi: nomeSgi,
        cliente_nome_digisac: nomeDigisac,
        total_chamados_historico: total,
        primeira_conversa_em: primeiraConversa,
        ultima_conversa_em: ultimaConversa,
        total_interacoes_historico: totalInteracoes,
        total_chamados_ativos: ativos,
        total_chamados_receptivos: receptivos,
        total_chamados_indefinidos: indefinidos,
        resumo_chamados_json: resumo,
        atualizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'telefone_normalizado_ddi' }
    )

  if (upsertErr) {
    console.error(`[sgi-sync] recalcularHistorico upsert erro:`, upsertErr)
  }
}

// ============================================================
// 6b. BUSCAR TICKETS SALVOS NO SUPABASE (para recálculo de ciclo)
// ============================================================

/**
 * Busca todos os tickets já salvos em digisac_conversas_resumo para um conjunto
 * de telefones (com todas as variações). Usado para recalcular o ciclo da venda
 * mesmo quando a sync incremental não trouxe tickets novos.
 */
export async function buscarTicketsSalvosNoSupabase(
  telefonesDDI: string[],
  supabase: SupabaseClient
): Promise<ResumoTicket[]> {
  if (!telefonesDDI.length) return []

  // Expande cada telefone DDI para todas as variações (com/sem 9, com/sem DDI)
  const todasVariacoes = [...new Set(
    telefonesDDI.flatMap(t => gerarVariacoesTelefone(t))
  )]

  const { data, error } = await supabase
    .from('digisac_conversas_resumo')
    .select('*')
    .in('telefone_normalizado_ddi', todasVariacoes)

  if (error) {
    console.error('[sgi-sync] buscarTicketsSalvosNoSupabase erro:', error)
    return []
  }

  const rows = data ?? []
  // Deduplicar por digisac_ticket_id (pode aparecer por variações diferentes)
  const dedup = new Map<string, ResumoTicket>()
  for (const row of rows) {
    if (!dedup.has(row.digisac_ticket_id)) {
      dedup.set(row.digisac_ticket_id, {
        digisac_ticket_id: row.digisac_ticket_id,
        protocolo: row.protocolo,
        digisac_contact_id: row.digisac_contact_id,
        telefone_normalizado: row.telefone_normalizado,
        telefone_normalizado_ddi: row.telefone_normalizado_ddi,
        cliente_nome_digisac: row.cliente_nome_digisac,
        service_id: row.service_id,
        service_nome: row.service_nome,
        department_id: row.department_id,
        department_nome: row.department_nome,
        user_id: row.user_id,
        user_nome: row.user_nome,
        status: row.status,
        is_open: row.is_open,
        comments: row.comments,
        started_at: row.started_at,
        ended_at: row.ended_at,
        ticket_time_segundos: row.ticket_time_segundos,
        messaging_time_segundos: row.messaging_time_segundos,
        quantidade_interacoes: row.quantidade_interacoes,
        interacoes_incompletas: row.interacoes_incompletas ?? false,
        inicio_chamado: row.inicio_chamado ?? 'indefinido',
        tags: row.tags ?? [],
        assuntos: row.assuntos ?? [],
        raw_json: row.raw_json,
        updated_at: row.updated_at ?? new Date().toISOString(),
      })
    }
  }
  return [...dedup.values()]
}

// ============================================================
// 7. CALCULAR E SALVAR VÍNCULOS VENDA ↔ CONVERSA
// ============================================================

const DATA_MINIMA_CICLO = new Date('2026-01-01T00:00:00.000Z')

export async function calcularVinculosVenda(
  documentoSaidaId: string,
  numeroLancamento: string,
  dataFechamento: string | null,
  tickets: ResumoTicket[],
  supabase: SupabaseClient,
  telefonesVenda?: string[]
): Promise<{ totalJanela90Dias: number; totalCicloVenda: number; inicioCiclo: string | null; fimCiclo: string | null; vendaAnterior: string | null }> {
  if (!tickets.length) return { totalJanela90Dias: 0, totalCicloVenda: 0, inicioCiclo: null, fimCiclo: null, vendaAnterior: null }

  const dataVenda = dataFechamento ? new Date(dataFechamento) : null

  // ── Busca venda anterior do mesmo cliente/telefone ────────
  let dataInicioCiclo: Date = DATA_MINIMA_CICLO
  let vendaAnteriorLancamento: string | null = null

  if (dataVenda && telefonesVenda && telefonesVenda.length > 0) {
    // Expande para todas as variações (com/sem DDI, com/sem 9) para não perder matches
    const todasVariacoesVenda = [...new Set(
      telefonesVenda.flatMap(t => gerarVariacoesTelefone(t))
    )]
    // Busca contatos que tenham algum dos telefones da venda (qualquer variação)
    const { data: contatosAnteriores } = await supabase
      .from('sgi_documentos_saida_contatos')
      .select('numero_lancamento')
      .in('telefone_normalizado_ddi', todasVariacoesVenda)

    if (contatosAnteriores && contatosAnteriores.length > 0) {
      const lancamentosEncontrados = [...new Set(
        contatosAnteriores.map(c => c.numero_lancamento).filter(Boolean)
      )].filter(l => l !== numeroLancamento)

      if (lancamentosEncontrados.length > 0) {
        // Busca data_fechamento das vendas encontradas, anteriores à atual
        const { data: vendasAnteriores } = await supabase
          .from('sgi_documentos_saida')
          .select('numero_lancamento, data_fechamento')
          .in('numero_lancamento', lancamentosEncontrados)
          .not('data_fechamento', 'is', null)
          .lt('data_fechamento', dataVenda.toISOString())
          .order('data_fechamento', { ascending: false })
          .limit(1)

        if (vendasAnteriores && vendasAnteriores.length > 0) {
          const anterior = vendasAnteriores[0]
          vendaAnteriorLancamento = anterior.numero_lancamento
          const dataAnterior = new Date(anterior.data_fechamento)
          // inicio_ciclo = data_fechamento da venda anterior (exclusive — usando > no filtro)
          dataInicioCiclo = dataAnterior > DATA_MINIMA_CICLO ? dataAnterior : DATA_MINIMA_CICLO
        }
      }
    }
  }

  const fimCiclo = dataVenda ?? new Date()
  const inicioCicloISO = dataInicioCiclo.toISOString()
  const fimCicloISO = fimCiclo.toISOString()

  // ── Ordenar cronologicamente para calcular ordem ──────────
  const ordenados = [...tickets].sort((a, b) => {
    const ta = a.started_at ? new Date(a.started_at).getTime() : 0
    const tb = b.started_at ? new Date(b.started_at).getTime() : 0
    return ta - tb
  })

  let totalCicloVenda = 0
  let totalJanela90Dias = 0 // mantido por compatibilidade
  const dataInicioJanela90 = dataVenda ? new Date(dataVenda.getTime() - 90 * 24 * 60 * 60 * 1000) : null

  const vinculos = ordenados.map((ticket, idx) => {
    const dataConversa = ticket.started_at ? new Date(ticket.started_at) : null
    let diasAntes: number | null = null
    let noCiclo = false
    let naJanela90 = false

    if (dataVenda && dataConversa) {
      diasAntes = Math.round((dataVenda.getTime() - dataConversa.getTime()) / (1000 * 60 * 60 * 24))
      // Ciclo: > inicio (exclusive) e <= fim
      noCiclo = dataConversa > dataInicioCiclo && dataConversa <= fimCiclo
      // Janela 90 dias legada
      naJanela90 = dataInicioJanela90 !== null && dataConversa >= dataInicioJanela90 && dataConversa <= dataVenda
    }

    if (noCiclo) totalCicloVenda++
    if (naJanela90) totalJanela90Dias++

    return {
      documento_saida_id: documentoSaidaId,
      numero_lancamento: numeroLancamento,
      digisac_ticket_id: ticket.digisac_ticket_id,
      telefone_normalizado: ticket.telefone_normalizado,
      telefone_normalizado_ddi: ticket.telefone_normalizado_ddi,
      data_conversa: ticket.started_at,
      considerada_na_janela_90_dias: naJanela90,
      considerada_no_ciclo_venda: noCiclo,
      data_inicio_ciclo_venda: inicioCicloISO,
      data_fim_ciclo_venda: fimCicloISO,
      numero_lancamento_venda_anterior: vendaAnteriorLancamento,
      ordem_conversa_para_venda: idx + 1,
      dias_antes_da_venda: diasAntes,
      inicio_chamado: ticket.inicio_chamado,
      tipo_vinculo: 'historico_telefone',
    }
  })

  const { error } = await supabase
    .from('venda_conversa_vinculos')
    .upsert(vinculos, { onConflict: 'numero_lancamento,digisac_ticket_id' })

  if (error) {
    console.error(`[sgi-sync] calcularVinculos upsert erro:`, error)
  }

  return { totalJanela90Dias, totalCicloVenda, inicioCiclo: inicioCicloISO, fimCiclo: fimCicloISO, vendaAnterior: vendaAnteriorLancamento }
}

// ============================================================
// UTILITÁRIOS DE TELEFONE
// ============================================================

export function normalizarTelefone(tel: string): string {
  return tel.replace(/\D/g, '').replace(/^55/, '')
}

export function normalizarTelefoneDDI(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return `55${digits}`
}
