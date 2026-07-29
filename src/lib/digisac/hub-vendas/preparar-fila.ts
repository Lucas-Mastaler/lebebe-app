import { fetchDigisac } from '@/lib/digisac/clienteDigisac'
import { gerarVariacoesTelefone, type DigisacTicket } from '@/lib/digisac/sgi-sync'
import { createServiceClient } from '@/lib/supabase/service'
import {
  HUB_VENDAS_JANELA_CONVERSAO_MS,
  HUB_VENDAS_LOJAS,
  HUB_VENDAS_SERVICE_ID_PARA_LOJA,
  type HubVendasLoja,
} from './constants'
import {
  ajustarParaHorarioOperacional,
  obterIntervaloDiaLocalUtc,
  somarSegundosAjustandoHorario,
  type HubVendasHorarioOperacional,
} from './tempo'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>

type HubVendasLeadPendente = {
  id: string
  telefone_normalizado_ddi: string
  data_entrada_hub: string
  status: string
}

type HubVendasConfigRow = {
  chave: string
  valor: unknown
}

type ConfigAutomacao = {
  ativa: boolean
  pausada: boolean
  motivo?: string | null
}

type ConfigParametros = {
  timezone: string
  dias_semana: number[]
  horario_inicio: string
  horario_fim: string
  limite_diario_por_conexao: number
  intervalo_min_segundos: number
  intervalo_max_segundos: number
  elegibilidade_horas: number
  janela_conversao_horas: number
}

type ConfigRodizio = {
  ordem: string[]
}

type ConexaoFila = {
  id: string
  nome: string
}

type ResultadoPreparacaoLead =
  | 'convertido_reconciliacao'
  | 'cliente_em_atendimento'
  | 'fila_criada'
  | 'fila_ja_existente'
  | 'sem_capacidade_diaria'
  | 'sem_conexao_elegivel'
  | 'erro_reconciliacao'
  | 'ignorado'

export type ResultadoPreparacaoHubVendas = {
  ok: boolean
  automacaoAtiva: boolean
  pausada: boolean
  motivo: string | null
  totalCandidatos: number
  totalConvertidosReconciliacao: number
  totalClienteEmAtendimento: number
  totalFilaCriada: number
  totalFilaExistente: number
  totalSemCapacidade: number
  totalErros: number
}

const CONFIG_PADRAO_PARAMETROS: ConfigParametros = {
  timezone: 'America/Sao_Paulo',
  dias_semana: [1, 2, 3, 4, 5, 6],
  horario_inicio: '09:00',
  horario_fim: '18:00',
  limite_diario_por_conexao: 15,
  intervalo_min_segundos: 180,
  intervalo_max_segundos: 300,
  elegibilidade_horas: 48,
  janela_conversao_horas: 24,
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item)) : []
}

function asNumberArray(value: unknown, fallback: number[]): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => Number.isInteger(item))
    : fallback
}

function lerAutomacao(valor: unknown): ConfigAutomacao {
  const record = asRecord(valor)
  return {
    ativa: asBoolean(record.ativa, false),
    pausada: asBoolean(record.pausada, true),
    motivo: typeof record.motivo === 'string' ? record.motivo : null,
  }
}

function lerParametros(valor: unknown): ConfigParametros {
  const record = asRecord(valor)
  return {
    timezone: asString(record.timezone, CONFIG_PADRAO_PARAMETROS.timezone),
    dias_semana: asNumberArray(record.dias_semana, CONFIG_PADRAO_PARAMETROS.dias_semana),
    horario_inicio: asString(record.horario_inicio, CONFIG_PADRAO_PARAMETROS.horario_inicio),
    horario_fim: asString(record.horario_fim, CONFIG_PADRAO_PARAMETROS.horario_fim),
    limite_diario_por_conexao: asNumber(
      record.limite_diario_por_conexao ?? record.limite_diario,
      CONFIG_PADRAO_PARAMETROS.limite_diario_por_conexao
    ),
    intervalo_min_segundos: asNumber(
      record.intervalo_min_segundos ?? record.intervalo_min_seg,
      CONFIG_PADRAO_PARAMETROS.intervalo_min_segundos
    ),
    intervalo_max_segundos: asNumber(
      record.intervalo_max_segundos ?? record.intervalo_max_seg,
      CONFIG_PADRAO_PARAMETROS.intervalo_max_segundos
    ),
    elegibilidade_horas: asNumber(record.elegibilidade_horas, CONFIG_PADRAO_PARAMETROS.elegibilidade_horas),
    janela_conversao_horas: asNumber(record.janela_conversao_horas, CONFIG_PADRAO_PARAMETROS.janela_conversao_horas),
  }
}

function lerRodizio(valor: unknown): ConfigRodizio {
  const record = asRecord(valor)
  const ordem = asStringArray(record.ordem)
  return { ordem: ordem.length ? ordem : Object.values(HUB_VENDAS_LOJAS).map((loja) => loja.serviceId) }
}

function conexaoPausada(pausas: unknown, serviceId: string): boolean {
  const record = asRecord(pausas)
  const config = asRecord(record[serviceId])
  return config.pausada === true
}

function nomeConexao(serviceId: string): string {
  const loja = HUB_VENDAS_SERVICE_ID_PARA_LOJA.get(serviceId)
  if (loja === 'portao') return 'Portao'
  if (loja === 'bigorrilho') return 'Bigorrilho'
  if (loja === 'hauer_marechal') return 'Hauer/Marechal'
  return serviceId
}

function timestampTicket(ticket: DigisacTicket): Date | null {
  if (ticket.startedAt) {
    const data = new Date(ticket.startedAt)
    if (!Number.isNaN(data.getTime())) return data
  }

  const timestamp = ticket.firstMessage?.timestamp
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return new Date(timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp)
  }

  return null
}

function lojaDoTicket(ticket: DigisacTicket): HubVendasLoja | null {
  const serviceId = ticket.contact?.service?.id
  return serviceId ? HUB_VENDAS_SERVICE_ID_PARA_LOJA.get(serviceId) ?? null : null
}

async function buscarTicketsLojasPorTelefone(telefoneNormalizadoDDI: string, dataInicioISO: string): Promise<DigisacTicket[]> {
  const variacoes = gerarVariacoesTelefone(telefoneNormalizadoDDI)
  const todos = new Map<string, DigisacTicket>()
  const serviceIdsLojas = Object.values(HUB_VENDAS_LOJAS).map((loja) => loja.serviceId)

  for (const variacao of variacoes) {
    const query = JSON.stringify({
      distinct: true,
      order: [['updatedAt', 'DESC']],
      where: { updatedAt: { $gte: dataInicioISO } },
      include: [
        {
          model: 'firstMessage',
          attributes: ['id', 'type', 'timestamp', 'isFromMe', 'visible', 'isComment', 'serviceId', 'contactId', 'ticketId'],
        },
        {
          model: 'contact',
          required: true,
          where: {
            visible: true,
            serviceId: { $in: serviceIdsLojas },
            data: { number: { $like: `%${variacao}%` } },
          },
          include: [{ model: 'service', required: true }],
        },
      ],
      page: 1,
      perPage: 50,
    })

    const resp: { data?: DigisacTicket[] } = await fetchDigisac(`/tickets?query=${encodeURIComponent(query)}`)
    const tickets = Array.isArray(resp?.data) ? resp.data : []
    for (const ticket of tickets) {
      if (!todos.has(ticket.id)) todos.set(ticket.id, ticket)
    }
    if (tickets.length > 0) break
  }

  return [...todos.values()]
}

async function cancelarFilaPendente(supabase: SupabaseServiceClient, leadId: string, motivo: string) {
  const { error } = await supabase
    .from('hub_vendas_recuperacao_fila')
    .update({
      status: 'cancelado',
      motivo_cancelamento: motivo,
      ultima_reconciliacao_em: new Date().toISOString(),
    })
    .eq('lead_id', leadId)
    .in('status', ['agendado', 'reservado', 'enviando', 'resultado_incerto'])

  if (error) throw error
}

async function marcarClienteEmAtendimento(
  supabase: SupabaseServiceClient,
  lead: HubVendasLeadPendente,
  ticket: DigisacTicket,
  loja: HubVendasLoja,
  dataAtendimento: Date
) {
  const { error } = await supabase
    .from('hub_vendas_leads')
    .update({
      status: 'cliente_em_atendimento',
      data_cliente_em_atendimento: dataAtendimento.toISOString(),
      motivo_bloqueio_recuperacao: `chamado_aberto_${loja}`,
      digisac_contact_id: ticket.contact?.id ?? null,
      digisac_ticket_id: ticket.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
    .eq('status', 'aguardando_conversao')

  if (error) throw error
  await cancelarFilaPendente(supabase, lead.id, 'cliente_em_atendimento')
}

async function reconciliarLead(
  supabase: SupabaseServiceClient,
  lead: HubVendasLeadPendente,
  agora: Date
): Promise<ResultadoPreparacaoLead> {
  const tickets = await buscarTicketsLojasPorTelefone(lead.telefone_normalizado_ddi, lead.data_entrada_hub)
  const entradaMs = new Date(lead.data_entrada_hub).getTime()
  const limiteConversaoMs = entradaMs + HUB_VENDAS_JANELA_CONVERSAO_MS

  const ticketsMonitorados = tickets
    .map((ticket) => ({ ticket, loja: lojaDoTicket(ticket), data: timestampTicket(ticket) }))
    .filter((item): item is { ticket: DigisacTicket; loja: HubVendasLoja; data: Date | null } => Boolean(item.loja))
    .sort((a, b) => (a.data?.getTime() ?? agora.getTime()) - (b.data?.getTime() ?? agora.getTime()))

  const chamadoAberto = ticketsMonitorados.find((item) => item.ticket.isOpen === true)
  if (chamadoAberto) {
    await marcarClienteEmAtendimento(
      supabase,
      lead,
      chamadoAberto.ticket,
      chamadoAberto.loja,
      chamadoAberto.data ?? agora
    )
    return 'cliente_em_atendimento'
  }

  const conversoes = ticketsMonitorados.filter((item) => {
    const dataMs = item.data?.getTime()
    return typeof dataMs === 'number' && dataMs >= entradaMs && dataMs < limiteConversaoMs
  })

  if (conversoes.length > 0) {
    for (const conversao of conversoes) {
      const { error } = await supabase.rpc('hub_vendas_registrar_conversao', {
        p_lead_id: lead.id,
        p_loja: conversao.loja,
        p_timestamp_evento: conversao.data!.toISOString(),
      })
      if (error) throw error
    }
    return 'convertido_reconciliacao'
  }

  return 'ignorado'
}

async function buscarConfig(supabase: SupabaseServiceClient) {
  const { data, error } = await supabase
    .from('hub_vendas_config')
    .select('chave, valor')
    .in('chave', ['automacao', 'parametros', 'pausas_conexoes', 'rodizio'])

  if (error) throw error

  const configs = new Map((data ?? []).map((row: HubVendasConfigRow) => [row.chave, row.valor]))
  return {
    automacao: lerAutomacao(configs.get('automacao')),
    parametros: lerParametros(configs.get('parametros')),
    pausasConexoes: configs.get('pausas_conexoes'),
    rodizio: lerRodizio(configs.get('rodizio')),
  }
}

async function buscarLeadsCandidatos(
  supabase: SupabaseServiceClient,
  parametros: ConfigParametros,
  agora: Date,
  limite: number
): Promise<HubVendasLeadPendente[]> {
  const fimConversao = new Date(agora.getTime() - parametros.janela_conversao_horas * 60 * 60 * 1000)
  const limiteElegibilidade = new Date(agora.getTime() - parametros.elegibilidade_horas * 60 * 60 * 1000)
  const { data, error } = await supabase
    .from('hub_vendas_leads')
    .select('id, telefone_normalizado_ddi, data_entrada_hub, status')
    .eq('status', 'aguardando_conversao')
    .lte('data_entrada_hub', fimConversao.toISOString())
    .gt('data_entrada_hub', limiteElegibilidade.toISOString())
    .order('data_entrada_hub', { ascending: true })
    .limit(limite)

  if (error) throw error
  return (data ?? []) as HubVendasLeadPendente[]
}

async function buscarUltimosProgramados(
  supabase: SupabaseServiceClient,
  conexoes: ConexaoFila[]
): Promise<Map<string, Date>> {
  const { data, error } = await supabase
    .from('hub_vendas_recuperacao_fila')
    .select('conexao_destino_id, programado_para')
    .in('conexao_destino_id', conexoes.map((conexao) => conexao.id))
    .in('status', ['agendado', 'reservado', 'enviando', 'resultado_incerto'])
    .order('programado_para', { ascending: false })
    .limit(100)

  if (error) throw error

  const ultimos = new Map<string, Date>()
  for (const row of data ?? []) {
    if (!ultimos.has(row.conexao_destino_id)) {
      ultimos.set(row.conexao_destino_id, new Date(row.programado_para))
    }
  }
  return ultimos
}

async function conexoesComCapacidade(
  supabase: SupabaseServiceClient,
  conexoes: ConexaoFila[],
  programados: Map<string, Date>,
  parametros: ConfigParametros
): Promise<ConexaoFila[]> {
  const comCapacidade: ConexaoFila[] = []

  for (const conexao of conexoes) {
    const programado = programados.get(conexao.id)
    if (!programado) continue

    const { inicioUtc, fimUtc } = obterIntervaloDiaLocalUtc(programado, parametros.timezone)
    const { count, error } = await supabase
      .from('hub_vendas_recuperacao_fila')
      .select('id', { count: 'exact', head: true })
      .eq('conexao_destino_id', conexao.id)
      .in('status', ['agendado', 'reservado', 'enviando', 'enviado', 'resultado_incerto'])
      .gte('programado_para', inicioUtc.toISOString())
      .lt('programado_para', fimUtc.toISOString())

    if (error) throw error
    if ((count ?? 0) < parametros.limite_diario_por_conexao) {
      comCapacidade.push(conexao)
    }
  }

  return comCapacidade
}

function calcularProgramados(
  conexoes: ConexaoFila[],
  ultimosProgramados: Map<string, Date>,
  parametros: ConfigParametros,
  agora: Date
): Map<string, Date> {
  const horario: HubVendasHorarioOperacional = {
    timezone: parametros.timezone,
    diasSemana: parametros.dias_semana,
    inicio: parametros.horario_inicio,
    fim: parametros.horario_fim,
  }
  const programados = new Map<string, Date>()

  for (const conexao of conexoes) {
    const ultimo = ultimosProgramados.get(conexao.id)
    const intervaloSegundos = sortearIntervaloSegundos(parametros)
    const base = ultimo && ultimo.getTime() > agora.getTime()
      ? somarSegundosAjustandoHorario(ultimo, intervaloSegundos, horario)
      : ajustarParaHorarioOperacional(agora, horario)
    programados.set(conexao.id, base)
  }

  return programados
}

function sortearIntervaloSegundos(parametros: ConfigParametros): number {
  const minimo = Math.max(Math.floor(parametros.intervalo_min_segundos), 1)
  const maximo = Math.max(Math.floor(parametros.intervalo_max_segundos), minimo)
  if (maximo === minimo) return minimo
  return minimo + Math.floor(Math.random() * (maximo - minimo + 1))
}

async function prepararLeadNaFila(
  supabase: SupabaseServiceClient,
  lead: HubVendasLeadPendente,
  conexoes: ConexaoFila[],
  parametros: ConfigParametros,
  agora: Date
): Promise<ResultadoPreparacaoLead> {
  const ultimosProgramados = await buscarUltimosProgramados(supabase, conexoes)
  const programados = calcularProgramados(conexoes, ultimosProgramados, parametros, agora)
  const conexoesElegiveis = await conexoesComCapacidade(supabase, conexoes, programados, parametros)

  if (conexoesElegiveis.length === 0) return 'sem_capacidade_diaria'

  const programadosPorConexao = Object.fromEntries(
    conexoesElegiveis.map((conexao) => [conexao.id, programados.get(conexao.id)?.toISOString()])
  )
  const nomesPorConexao = Object.fromEntries(conexoesElegiveis.map((conexao) => [conexao.id, conexao.nome]))

  const { data, error } = await supabase.rpc('hub_vendas_preparar_fila_recuperacao', {
    p_lead_id: lead.id,
    p_conexoes_elegiveis: conexoesElegiveis.map((conexao) => conexao.id),
    p_programados_por_conexao: programadosPorConexao,
    p_nomes_por_conexao: nomesPorConexao,
    p_limite_diario: parametros.limite_diario_por_conexao,
    p_timezone: parametros.timezone,
  })

  if (error) throw error

  const resultado = Array.isArray(data) ? data[0] : data
  if (resultado?.criado) return 'fila_criada'
  if (resultado?.motivo === 'fila_ja_existente') return 'fila_ja_existente'
  if (resultado?.motivo === 'sem_capacidade_diaria') return 'sem_capacidade_diaria'
  if (resultado?.motivo === 'sem_conexao_elegivel') return 'sem_conexao_elegivel'
  return 'ignorado'
}

function incrementarResumo(resumo: ResultadoPreparacaoHubVendas, resultado: ResultadoPreparacaoLead) {
  if (resultado === 'convertido_reconciliacao') resumo.totalConvertidosReconciliacao += 1
  if (resultado === 'cliente_em_atendimento') resumo.totalClienteEmAtendimento += 1
  if (resultado === 'fila_criada') resumo.totalFilaCriada += 1
  if (resultado === 'fila_ja_existente') resumo.totalFilaExistente += 1
  if (resultado === 'sem_capacidade_diaria') resumo.totalSemCapacidade += 1
  if (resultado === 'erro_reconciliacao') resumo.totalErros += 1
}

export async function prepararFilaRecuperacaoHubVendas({
  supabase = createServiceClient(),
  limite = 50,
  agora = new Date(),
}: {
  supabase?: SupabaseServiceClient
  limite?: number
  agora?: Date
} = {}): Promise<ResultadoPreparacaoHubVendas> {
  console.log('[HUB VENDAS PREPARACAO] execucao iniciada')

  const config = await buscarConfig(supabase)
  const resumo: ResultadoPreparacaoHubVendas = {
    ok: true,
    automacaoAtiva: config.automacao.ativa,
    pausada: config.automacao.pausada,
    motivo: config.automacao.motivo ?? null,
    totalCandidatos: 0,
    totalConvertidosReconciliacao: 0,
    totalClienteEmAtendimento: 0,
    totalFilaCriada: 0,
    totalFilaExistente: 0,
    totalSemCapacidade: 0,
    totalErros: 0,
  }

  if (!config.automacao.ativa || config.automacao.pausada) {
    console.log('[HUB VENDAS PREPARACAO] automacao inativa ou pausada; fila nao sera criada')
    return resumo
  }

  const conexoes = config.rodizio.ordem
    .filter((serviceId) => HUB_VENDAS_SERVICE_ID_PARA_LOJA.has(serviceId))
    .filter((serviceId) => !conexaoPausada(config.pausasConexoes, serviceId))
    .map((serviceId) => ({ id: serviceId, nome: nomeConexao(serviceId) }))

  if (conexoes.length === 0) {
    resumo.totalSemCapacidade = 1
    return resumo
  }

  const leads = await buscarLeadsCandidatos(supabase, config.parametros, agora, limite)
  resumo.totalCandidatos = leads.length

  for (const lead of leads) {
    try {
      const reconciliacao = await reconciliarLead(supabase, lead, agora)
      if (reconciliacao === 'convertido_reconciliacao' || reconciliacao === 'cliente_em_atendimento') {
        incrementarResumo(resumo, reconciliacao)
        continue
      }

      const fila = await prepararLeadNaFila(supabase, lead, conexoes, config.parametros, agora)
      incrementarResumo(resumo, fila)
    } catch (error) {
      resumo.totalErros += 1
      const message = error instanceof Error ? error.message : 'erro_desconhecido'
      console.error(`[HUB VENDAS PREPARACAO] erro leadId=${lead.id} erro=${message}`)
    }
  }

  console.log(
    `[HUB VENDAS PREPARACAO] fim candidatos=${resumo.totalCandidatos} filaCriada=${resumo.totalFilaCriada} convertidos=${resumo.totalConvertidosReconciliacao} emAtendimento=${resumo.totalClienteEmAtendimento} erros=${resumo.totalErros}`
  )

  return resumo
}
