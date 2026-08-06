import { createServiceClient } from '@/lib/supabase/service'
import { HUB_VENDAS_LOJAS, type HubVendasLoja } from './constants'
import { obterIntervaloDiaLocalUtc } from './tempo'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>

// ---------------------------------------------------------------------------
// Constantes de validação
// ---------------------------------------------------------------------------

/** Limite máximo seguro para o limite diário por loja/conexão. */
export const LIMITE_DIARIO_MAXIMO = 50

/** Status de fila que contam como "enviado hoje" para fins de limite diário. */
const STATUS_CONTAVEIS_LIMITE = ['agendado', 'reservado', 'enviando', 'enviado', 'resultado_incerto'] as const

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type StatusGestaoHubVendas = {
  ok: true
  automacao: {
    ativa: boolean
    pausada: boolean
    motivo: string | null
    atualizadoEm: string | null
  }
  parametros: {
    limiteDiarioPorConexao: number
    limitePorExecucao: number
    modoAtivacaoGradual: boolean
    reservaTimeoutMinutos: number
    envioTimeoutMinutos: number
    timezone: string
  }
  ultimoProcessamento: string | null
  resumo: {
    leadsRegistrados: number
    candidatosElegiveis: number
    agendada: number
    reservada: number
    enviando: number
    enviadaHoje: number
    cancelada: number
    erro: number
    resultadoIncerto: number
    analiseManual: number
    conexoesPausadas: number
  }
  lojas: ResumoLojaHubVendas[]
}

export type ResumoLojaHubVendas = {
  loja: HubVendasLoja
  nomeExibicao: string
  serviceId: string
  enviadosHoje: number
  limiteDiario: number
  saldoRestante: number
  errosConsecutivos: number
  pausada: boolean
  filas: {
    agendada: number
    reservada: number
    enviando: number
    erro: number
    resultadoIncerto: number
    analiseManual: number
  }
}

export type FilaListadaHubVendas = {
  id: string
  leadId: string
  conexaoDestinoId: string
  conexaoDestinoNome: string | null
  loja: HubVendasLoja | null
  status: string
  programadoPara: string
  enviadoEm: string | null
  tentativasEnvio: number
  versaoMensagem: number | null
  digisacContactId: string | null
  digisacTicketId: string | null
  digisacMessageId: string | null
  erro: string | null
  categoriaErro: string | null
  motivoCancelamento: string | null
  resultado: string | null
  createdAt: string
  updatedAt: string
  // Dados do lead (join)
  telefoneMascarado: string | null
  nomeContatoHub: string | null
  leadStatus: string | null
}

export type ListagemFilasHubVendas = {
  ok: true
  filas: FilaListadaHubVendas[]
  total: number
  pagina: number
  porPagina: number
  totalPaginas: number
}

export type DetalheFilaHubVendas = {
  ok: true
  fila: FilaListadaHubVendas & {
    reservadoEm: string | null
    reservadoPor: string | null
    requisicaoIniciadaEm: string | null
    requisicaoFinalizadaEm: string | null
    textoEnviado: string | null
    hashTextoEnviado: string | null
    ultimaReconciliacaoEm: string | null
    quantidadeReconciliacoes: number
  }
}

export type ResultadoAlteracaoLimite = {
  ok: true
  valorAnterior: number
  valorNovo: number
  atualizadoEm: string
}

export type ResultadoPausaHubVendas = {
  ok: true
  pausada: boolean
  motivo: string | null
  atualizadoEm: string
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Mascara telefone para exibição segura na UI administrativa.
 * Ex: "554184426528" -> "+55 41 8442-6528" -> "+55 41 ****-6528"
 */
export function mascararTelefone(telefone: string | null): string | null {
  if (!telefone) return null
  const digitos = telefone.replace(/\D/g, '')
  if (digitos.length < 8) return '***'
  // Preserva DDI + DDD, mascara o meio
  if (digitos.length >= 12) {
    return `+${digitos.slice(0, 2)} ${digitos.slice(2, 4)} ****-****`
  }
  if (digitos.length >= 10) {
    return `+${digitos.slice(0, 2)} ** ****-${digitos.slice(-4)}`
  }
  return `** ****-${digitos.slice(-4)}`
}

function mapearServiceIdParaLoja(serviceId: string): HubVendasLoja | null {
  for (const [loja, config] of Object.entries(HUB_VENDAS_LOJAS)) {
    if (config.serviceId === serviceId) return loja as HubVendasLoja
  }
  return null
}

// ---------------------------------------------------------------------------
// Leitura de configuração
// ---------------------------------------------------------------------------

type ConfigParametros = {
  timezone: string
  limiteDiarioPorConexao: number
  limitePorExecucao: number
  modoAtivacaoGradual: boolean
  reservaTimeoutMinutos: number
  envioTimeoutMinutos: number
}

type ConfigAutomacao = {
  ativa: boolean
  pausada: boolean
  motivo: string | null
}

type ConfigPausasConexoes = Record<string, { nome?: string; pausada?: boolean; erros_consecutivos?: number }>

async function lerConfigHubVendas(supabase: SupabaseServiceClient) {
  const { data, error } = await supabase
    .from('hub_vendas_config')
    .select('chave, valor, updated_at')
    .in('chave', ['automacao', 'parametros', 'pausas_conexoes'])
  if (error) throw error

  const map = new Map((data ?? []).map((row) => [row.chave, row]))
  const automacaoRow = map.get('automacao')
  const parametrosRow = map.get('parametros')
  const pausasRow = map.get('pausas_conexoes')

  const automacaoValor = asRecord(automacaoRow?.valor)
  const parametrosValor = asRecord(parametrosRow?.valor)
  const pausasValor = asRecord(pausasRow?.valor) as ConfigPausasConexoes

  const automacao: ConfigAutomacao = {
    ativa: asBoolean(automacaoValor.ativa, false),
    pausada: asBoolean(automacaoValor.pausada, true),
    motivo: asString(automacaoValor.motivo),
  }

  const parametros: ConfigParametros = {
    timezone: asString(parametrosValor.timezone) ?? 'America/Sao_Paulo',
    limiteDiarioPorConexao: asNumber(parametrosValor.limite_diario_por_conexao ?? parametrosValor.limite_diario, 15),
    limitePorExecucao: asNumber(parametrosValor.limite_por_execucao, 1),
    modoAtivacaoGradual: asBoolean(parametrosValor.modo_ativacao_gradual, true),
    reservaTimeoutMinutos: asNumber(parametrosValor.reserva_timeout_minutos, 10),
    envioTimeoutMinutos: asNumber(parametrosValor.envio_timeout_minutos, 15),
  }

  return {
    automacao,
    parametros,
    pausas: pausasValor,
    automacaoAtualizadoEm: automacaoRow?.updated_at ?? null,
    parametrosAtualizadoEm: parametrosRow?.updated_at ?? null,
  }
}

// ---------------------------------------------------------------------------
// Status geral + estatísticas por loja
// ---------------------------------------------------------------------------

export async function obterStatusGestaoHubVendas(
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<StatusGestaoHubVendas> {
  const { automacao, parametros, pausas, automacaoAtualizadoEm } = await lerConfigHubVendas(supabase)

  // Contadores gerais via RPC
  const { data: counts, error: countsError } = await supabase.rpc('hub_vendas_status_contadores')
  if (countsError) throw countsError

  const countMap = new Map<string, number>((counts ?? []).map((row: { status: string; total: number }) => [row.status, Number(row.total) || 0]))

  // Leads registrados
  const { count: leadsRegistrados, error: leadsError } = await supabase
    .from('hub_vendas_leads')
    .select('id', { count: 'exact', head: true })
  if (leadsError) throw leadsError

  // Candidatos elegíveis (status = aguardando_conversao)
  const { count: candidatosElegiveis, error: candidatosError } = await supabase
    .from('hub_vendas_leads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'aguardando_conversao')
  if (candidatosError) throw candidatosError

  // Último processamento
  const { data: ultimo, error: ultimoError } = await supabase
    .from('hub_vendas_recuperacao_fila')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (ultimoError) throw ultimoError

  // Estatísticas por loja
  const { inicioUtc, fimUtc } = obterIntervaloDiaLocalUtc(new Date(), parametros.timezone)
  const inicioIso = inicioUtc.toISOString()
  const fimIso = fimUtc.toISOString()

  const lojas: ResumoLojaHubVendas[] = []
  let conexoesPausadas = 0

  for (const [lojaKey, config] of Object.entries(HUB_VENDAS_LOJAS)) {
    const loja = lojaKey as HubVendasLoja
    const serviceId = config.serviceId
    const pausaInfo = pausas[serviceId]
    const pausada = asBoolean(pausaInfo?.pausada, false)
    const errosConsecutivos = asNumber(pausaInfo?.erros_consecutivos, 0)
    if (pausada) conexoesPausadas += 1

    // Enviados hoje (status enviado dentro do dia local)
    const { count: enviadosHoje, error: enviadosError } = await supabase
      .from('hub_vendas_recuperacao_fila')
      .select('id', { count: 'exact', head: true })
      .eq('conexao_destino_id', serviceId)
      .in('status', [...STATUS_CONTAVEIS_LIMITE])
      .gte('programado_para', inicioIso)
      .lt('programado_para', fimIso)
    if (enviadosError) throw enviadosError

    const enviados = enviadosHoje ?? 0
    const limite = parametros.limiteDiarioPorConexao
    const saldoRestante = Math.max(0, limite - enviados)

    // Contadores por status para esta loja
    const { data: lojaCounts, error: lojaCountsError } = await supabase
      .from('hub_vendas_recuperacao_fila')
      .select('status')
      .eq('conexao_destino_id', serviceId)
    if (lojaCountsError) throw lojaCountsError

    const statusCounts = new Map<string, number>()
    for (const row of lojaCounts ?? []) {
      const s = (row as { status: string }).status
      statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1)
    }

    lojas.push({
      loja,
      nomeExibicao: config.nomeExibicao,
      serviceId,
      enviadosHoje: enviados,
      limiteDiario: limite,
      saldoRestante,
      errosConsecutivos,
      pausada,
      filas: {
        agendada: statusCounts.get('agendado') ?? 0,
        reservada: statusCounts.get('reservado') ?? 0,
        enviando: statusCounts.get('enviando') ?? 0,
        erro: statusCounts.get('erro') ?? 0,
        resultadoIncerto: statusCounts.get('resultado_incerto') ?? 0,
        analiseManual: statusCounts.get('analise_manual') ?? 0,
      },
    })
  }

  return {
    ok: true,
    automacao: {
      ativa: automacao.ativa,
      pausada: automacao.pausada,
      motivo: automacao.motivo,
      atualizadoEm: automacaoAtualizadoEm,
    },
    parametros: {
      limiteDiarioPorConexao: parametros.limiteDiarioPorConexao,
      limitePorExecucao: parametros.limitePorExecucao,
      modoAtivacaoGradual: parametros.modoAtivacaoGradual,
      reservaTimeoutMinutos: parametros.reservaTimeoutMinutos,
      envioTimeoutMinutos: parametros.envioTimeoutMinutos,
      timezone: parametros.timezone,
    },
    ultimoProcessamento: ((ultimo ?? []) as { updated_at: string | null }[])[0]?.updated_at ?? null,
    resumo: {
      leadsRegistrados: leadsRegistrados ?? 0,
      candidatosElegiveis: candidatosElegiveis ?? 0,
      agendada: countMap.get('agendado') ?? 0,
      reservada: countMap.get('reservado') ?? 0,
      enviando: countMap.get('enviando') ?? 0,
      enviadaHoje: countMap.get('enviado_hoje') ?? 0,
      cancelada: countMap.get('cancelado') ?? 0,
      erro: countMap.get('erro') ?? 0,
      resultadoIncerto: countMap.get('resultado_incerto') ?? 0,
      analiseManual: countMap.get('analise_manual') ?? 0,
      conexoesPausadas,
    },
    lojas,
  }
}

// ---------------------------------------------------------------------------
// Listagem paginada de filas
// ---------------------------------------------------------------------------

export type FiltrosListagemFilas = {
  pagina?: number
  porPagina?: number
  dataInicio?: string
  dataFim?: string
  loja?: HubVendasLoja | null
  status?: string | null
  cliente?: string | null
  telefoneParcial?: string | null
  filaId?: string | null
  leadId?: string | null
  somenteErros?: boolean
  somenteAnaliseManual?: boolean
  somenteResultadoIncerto?: boolean
}

export async function listarFilasHubVendas(
  filtros: FiltrosListagemFilas,
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<ListagemFilasHubVendas> {
  const pagina = Math.max(1, filtros.pagina ?? 1)
  const porPagina = Math.min(50, Math.max(1, filtros.porPagina ?? 20))
  const offset = (pagina - 1) * porPagina

  let query = supabase
    .from('hub_vendas_recuperacao_fila')
    .select(`
      id,
      lead_id,
      conexao_destino_id,
      conexao_destino_nome,
      status,
      programado_para,
      enviado_em,
      tentativas_envio,
      versao_mensagem,
      digisac_contact_id,
      digisac_ticket_id,
      digisac_message_id,
      erro,
      categoria_erro,
      motivo_cancelamento,
      resultado,
      created_at,
      updated_at,
      lead:hub_vendas_leads!inner(telefone_normalizado_ddi,nome_contato_hub,status)
    `, { count: 'exact' })

  // Filtros
  if (filtros.dataInicio) {
    query = query.gte('programado_para', filtros.dataInicio)
  }
  if (filtros.dataFim) {
    query = query.lt('programado_para', filtros.dataFim)
  }
  if (filtros.loja) {
    const serviceId = HUB_VENDAS_LOJAS[filtros.loja].serviceId
    query = query.eq('conexao_destino_id', serviceId)
  }
  if (filtros.status) {
    query = query.eq('status', filtros.status)
  }
  if (filtros.somenteErros) {
    query = query.eq('status', 'erro')
  }
  if (filtros.somenteAnaliseManual) {
    query = query.eq('status', 'analise_manual')
  }
  if (filtros.somenteResultadoIncerto) {
    query = query.eq('status', 'resultado_incerto')
  }
  if (filtros.filaId) {
    query = query.eq('id', filtros.filaId)
  }
  if (filtros.leadId) {
    query = query.eq('lead_id', filtros.leadId)
  }
  if (filtros.cliente) {
    query = query.ilike('hub_vendas_leads.nome_contato_hub', `%${filtros.cliente}%`)
  }
  if (filtros.telefoneParcial) {
    const digitos = filtros.telefoneParcial.replace(/\D/g, '')
    if (digitos) {
      query = query.ilike('hub_vendas_leads.telefone_normalizado_ddi', `%${digitos}%`)
    }
  }

  query = query.order('programado_para', { ascending: false }).range(offset, offset + porPagina - 1)

  const { data, error, count } = await query
  if (error) throw error

  const filas: FilaListadaHubVendas[] = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const lead = asRecord(r.lead) as { telefone_normalizado_ddi?: string; nome_contato_hub?: string; status?: string }
    const serviceId = r.conexao_destino_id as string
    return {
      id: r.id as string,
      leadId: r.lead_id as string,
      conexaoDestinoId: serviceId,
      conexaoDestinoNome: asString(r.conexao_destino_nome),
      loja: mapearServiceIdParaLoja(serviceId),
      status: r.status as string,
      programadoPara: r.programado_para as string,
      enviadoEm: asString(r.enviado_em),
      tentativasEnvio: asNumber(r.tentativas_envio, 0),
      versaoMensagem: typeof r.versao_mensagem === 'number' ? r.versao_mensagem : null,
      digisacContactId: asString(r.digisac_contact_id),
      digisacTicketId: asString(r.digisac_ticket_id),
      digisacMessageId: asString(r.digisac_message_id),
      erro: asString(r.erro),
      categoriaErro: asString(r.categoria_erro),
      motivoCancelamento: asString(r.motivo_cancelamento),
      resultado: asString(r.resultado),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      telefoneMascarado: mascararTelefone(lead.telefone_normalizado_ddi ?? null),
      nomeContatoHub: asString(lead.nome_contato_hub),
      leadStatus: asString(lead.status),
    }
  })

  const total = count ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))

  return {
    ok: true,
    filas,
    total,
    pagina,
    porPagina,
    totalPaginas,
  }
}

// ---------------------------------------------------------------------------
// Detalhe de fila
// ---------------------------------------------------------------------------

export async function obterDetalheFilaHubVendas(
  filaId: string,
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<DetalheFilaHubVendas | null> {
  const { data, error } = await supabase
    .from('hub_vendas_recuperacao_fila')
    .select(`
      id,
      lead_id,
      conexao_destino_id,
      conexao_destino_nome,
      status,
      programado_para,
      reservado_em,
      reservado_por,
      requisicao_iniciada_em,
      requisicao_finalizada_em,
      enviado_em,
      tentativas_envio,
      versao_mensagem,
      texto_enviado,
      hash_texto_enviado,
      digisac_contact_id,
      digisac_ticket_id,
      digisac_message_id,
      erro,
      categoria_erro,
      motivo_cancelamento,
      resultado,
      ultima_reconciliacao_em,
      quantidade_reconciliacoes,
      created_at,
      updated_at,
      lead:hub_vendas_leads!inner(telefone_normalizado_ddi,nome_contato_hub,status)
    `)
    .eq('id', filaId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const r = data as Record<string, unknown>
  const lead = asRecord(r.lead) as { telefone_normalizado_ddi?: string; nome_contato_hub?: string; status?: string }
  const serviceId = r.conexao_destino_id as string

  return {
    ok: true,
    fila: {
      id: r.id as string,
      leadId: r.lead_id as string,
      conexaoDestinoId: serviceId,
      conexaoDestinoNome: asString(r.conexao_destino_nome),
      loja: mapearServiceIdParaLoja(serviceId),
      status: r.status as string,
      programadoPara: r.programado_para as string,
      enviadoEm: asString(r.enviado_em),
      tentativasEnvio: asNumber(r.tentativas_envio, 0),
      versaoMensagem: typeof r.versao_mensagem === 'number' ? r.versao_mensagem : null,
      digisacContactId: asString(r.digisac_contact_id),
      digisacTicketId: asString(r.digisac_ticket_id),
      digisacMessageId: asString(r.digisac_message_id),
      erro: asString(r.erro),
      categoriaErro: asString(r.categoria_erro),
      motivoCancelamento: asString(r.motivo_cancelamento),
      resultado: asString(r.resultado),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      telefoneMascarado: mascararTelefone(lead.telefone_normalizado_ddi ?? null),
      nomeContatoHub: asString(lead.nome_contato_hub),
      leadStatus: asString(lead.status),
      reservadoEm: asString(r.reservado_em),
      reservadoPor: asString(r.reservado_por),
      requisicaoIniciadaEm: asString(r.requisicao_iniciada_em),
      requisicaoFinalizadaEm: asString(r.requisicao_finalizada_em),
      // Não expor texto_enviado completo (sensível) - apenas indicar se existe
      textoEnviado: r.texto_enviado ? '[mensagem enviada]' : null,
      hashTextoEnviado: asString(r.hash_texto_enviado),
      ultimaReconciliacaoEm: asString(r.ultima_reconciliacao_em),
      quantidadeReconciliacoes: asNumber(r.quantidade_reconciliacoes, 0),
    },
  }
}

// ---------------------------------------------------------------------------
// Validação do limite diário
// ---------------------------------------------------------------------------

export type ValidacaoLimite = {
  ok: boolean
  valor: number | null
  erro: string | null
}

export function validarLimiteDiario(entrada: unknown): ValidacaoLimite {
  if (typeof entrada === 'string') {
    const trimmed = entrada.trim()
    if (trimmed === '') return { ok: false, valor: null, erro: 'Valor vazio' }
    if (!/^-?\d+$/.test(trimmed)) {
      return { ok: false, valor: null, erro: 'Valor deve ser um número inteiro' }
    }
    const num = parseInt(trimmed, 10)
    return validarLimiteDiario(num)
  }

  if (typeof entrada === 'number') {
    if (!Number.isFinite(entrada)) return { ok: false, valor: null, erro: 'Valor inválido (NaN)' }
    if (!Number.isInteger(entrada)) return { ok: false, valor: null, erro: 'Valor deve ser inteiro (não decimal)' }
    if (entrada < 0) return { ok: false, valor: null, erro: 'Valor não pode ser negativo' }
    if (entrada > LIMITE_DIARIO_MAXIMO) {
      return { ok: false, valor: null, erro: `Valor acima do máximo seguro (${LIMITE_DIARIO_MAXIMO})` }
    }
    return { ok: true, valor: entrada, erro: null }
  }

  return { ok: false, valor: null, erro: 'Tipo de valor inválido' }
}

// ---------------------------------------------------------------------------
// Acoes administrativas com atomicidade real via RPC transacional.
// Cada RPC atualiza o dado e insere auditoria na mesma transacao PostgreSQL.
// Se a auditoria falhar, a alteracao faz ROLLBACK automaticamente.
// ---------------------------------------------------------------------------

export async function alterarLimiteDiarioHubVendas(
  novoLimite: number,
  emailUsuario: string,
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<ResultadoAlteracaoLimite> {
  const validacao = validarLimiteDiario(novoLimite)
  if (!validacao.ok || validacao.valor === null) {
    throw new Error(validacao.erro ?? 'Limite inválido')
  }

  const { data, error } = await supabase.rpc('hub_vendas_alterar_limite_diario', {
    p_email: emailUsuario,
    p_novo_limite: validacao.valor,
  })

  if (error) throw new Error(error.message)

  const resultado = data as { ok: true; valor_anterior: number; valor_novo: number; atualizado_em: string }
  return {
    ok: true,
    valorAnterior: resultado.valor_anterior,
    valorNovo: resultado.valor_novo,
    atualizadoEm: resultado.atualizado_em,
  }
}

// ---------------------------------------------------------------------------
// Pausar automação
// ---------------------------------------------------------------------------

export async function pausarAutomacaoHubVendas(
  motivo: string,
  emailUsuario: string,
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<ResultadoPausaHubVendas> {
  const { data, error } = await supabase.rpc('hub_vendas_pausar_automacao', {
    p_email: emailUsuario,
    p_motivo: motivo,
  })

  if (error) throw new Error(error.message)

  const resultado = data as { ok: true; pausada: boolean; motivo: string; atualizado_em: string }
  return {
    ok: true,
    pausada: resultado.pausada,
    motivo: resultado.motivo,
    atualizadoEm: resultado.atualizado_em,
  }
}

// ---------------------------------------------------------------------------
// Reativar automação
// ---------------------------------------------------------------------------

export async function reativarAutomacaoHubVendas(
  motivo: string,
  emailUsuario: string,
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<ResultadoPausaHubVendas> {
  const { data, error } = await supabase.rpc('hub_vendas_reativar_automacao', {
    p_email: emailUsuario,
    p_motivo: motivo,
  })

  if (error) throw new Error(error.message)

  const resultado = data as { ok: true; pausada: boolean; motivo: string; atualizado_em: string }
  return {
    ok: true,
    pausada: resultado.pausada,
    motivo: resultado.motivo,
    atualizadoEm: resultado.atualizado_em,
  }
}

// ---------------------------------------------------------------------------
// Ações manuais em filas
// ---------------------------------------------------------------------------

export async function cancelarFilaAgendadaHubVendas(
  filaId: string,
  motivo: string,
  emailUsuario: string,
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<{ ok: true; filaId: string; status: string }> {
  const { data, error } = await supabase.rpc('hub_vendas_cancelar_fila_agendada', {
    p_email: emailUsuario,
    p_fila_id: filaId,
    p_motivo: motivo,
  })

  if (error) throw new Error(error.message)

  const resultado = data as { ok: true; fila_id: string; status: string }
  return { ok: true, filaId: resultado.fila_id, status: resultado.status }
}

export async function reprocessarFilaErroHubVendas(
  filaId: string,
  emailUsuario: string,
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<{ ok: true; filaId: string; status: string }> {
  const { data, error } = await supabase.rpc('hub_vendas_reprocessar_fila_erro', {
    p_email: emailUsuario,
    p_fila_id: filaId,
  })

  if (error) throw new Error(error.message)

  const resultado = data as { ok: true; fila_id: string; status: string }
  return { ok: true, filaId: resultado.fila_id, status: resultado.status }
}

export async function liberarAnaliseManualHubVendas(
  filaId: string,
  motivo: string,
  emailUsuario: string,
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<{ ok: true; filaId: string; status: string }> {
  const { data, error } = await supabase.rpc('hub_vendas_liberar_analise_manual', {
    p_email: emailUsuario,
    p_fila_id: filaId,
    p_motivo: motivo,
  })

  if (error) throw new Error(error.message)

  const resultado = data as { ok: true; fila_id: string; status: string }
  return { ok: true, filaId: resultado.fila_id, status: resultado.status }
}
