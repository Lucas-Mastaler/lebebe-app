import { createServiceClient } from '@/lib/supabase/service'
import { fetchDigisacRaw, sanitizarDigisacParaLog } from '@/lib/digisac/clienteDigisac'
import { HUB_VENDAS_LOJAS, obterAlertasContactId, obterAlertasServiceId } from './constants'
import { obterPartesDataLocal, obterIntervaloDiaLocalUtc } from './tempo'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>

type ConfigRow = {
  chave: string
  valor: unknown
}

type StatusCountRow = {
  status: string
  total: number
}

export type ResultadoResumoDiario =
  | { ok: true; dataLocal: string; deduplicado: boolean; enviado: boolean }
  | { ok: false; erro: string }

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
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

function obterBotUserId(): string {
  const id = process.env.DIGISAC_BOT_USER_ID
  if (!id) throw new Error('digisac_bot_user_id_nao_configurado')
  return id
}

function formatarDataLocal(data: Date, timezone: string): string {
  const partes = obterPartesDataLocal(data, timezone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(partes.dia)}/${pad(partes.mes)}/${partes.ano}`
}

function chaveDataLocal(data: Date, timezone: string): string {
  const partes = obterPartesDataLocal(data, timezone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${partes.ano}-${pad(partes.mes)}-${pad(partes.dia)}`
}

async function buscarConfig(supabase: SupabaseServiceClient) {
  const { data, error } = await supabase
    .from('hub_vendas_config')
    .select('chave, valor')
    .in('chave', ['automacao', 'parametros', 'pausas_conexoes'])
  if (error) throw error

  const map = new Map((data ?? []).map((row: ConfigRow) => [row.chave, row.valor]))
  const automacao = asRecord(map.get('automacao'))
  const parametros = asRecord(map.get('parametros'))
  const pausas = asRecord(map.get('pausas_conexoes'))

  return {
    ativa: asBoolean(automacao.ativa, false),
    pausada: asBoolean(automacao.pausada, true),
    motivo: asString(automacao.motivo),
    timezone: asString(parametros.timezone) ?? 'America/Sao_Paulo',
    limiteDiarioPorConexao: asNumber(parametros.limite_diario_por_conexao ?? parametros.limite_diario, 15),
    elegibilidadeHoras: asNumber(parametros.elegibilidade_horas, 48),
    pausas,
  }
}

/** Janela pos-recuperacao: mesma constante de 24h usada em registrar-conversao-pos-recuperacao.ts. */
const JANELA_POS_RECUPERACAO_MS = 24 * 60 * 60 * 1000

/**
 * Resultado do funil de leads. Cada campo indica no proprio nome se é "hoje" (com
 * timestamp dedicado e confiável — data_conversao / data_recuperacao_respondida /
 * data_entrada_hub) ou "atual" (estoque no momento, sem timestamp dedicado de transição
 * — apenas updated_at genérico, que não é seguro para filtrar "só hoje").
 */
type ResultadoLeadsHubVendas = {
  convertidosHoje: number
  recuperadosHoje: number
  aguardandoRespostaAgora: number
  perdidosAtual: number
  filaManualAtual: number
  candidatosElegiveisAgora: number
}

async function contarResultadoLeadsHubVendas(
  supabase: SupabaseServiceClient,
  elegibilidadeHoras: number,
  timezone: string
): Promise<ResultadoLeadsHubVendas> {
  const { inicioUtc, fimUtc } = obterIntervaloDiaLocalUtc(new Date(), timezone)
  const inicioIso = inicioUtc.toISOString()
  const fimIso = fimUtc.toISOString()
  const agora = Date.now()
  const limiteElegibilidade = new Date(agora - elegibilidadeHoras * 60 * 60 * 1000).toISOString()
  const limitePosRecuperacao = new Date(agora - JANELA_POS_RECUPERACAO_MS).toISOString()

  const [
    { count: convertidosHoje, error: convertidosError },
    { count: recuperadosHoje, error: recuperadosError },
    { count: aguardandoRespostaAgora, error: aguardandoError },
    { count: perdidosAtual, error: perdidosError },
    { count: filaManualAtual, error: filaManualError },
    { count: candidatosElegiveisAgora, error: candidatosError },
  ] = await Promise.all([
    supabase
      .from('hub_vendas_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'convertido_organicamente')
      .gte('data_conversao', inicioIso)
      .lt('data_conversao', fimIso),
    supabase
      .from('hub_vendas_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'recuperado')
      .gte('data_recuperacao_respondida', inicioIso)
      .lt('data_recuperacao_respondida', fimIso),
    supabase
      .from('hub_vendas_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'recuperacao_enviada')
      .gt('data_recuperacao_enviada', limitePosRecuperacao),
    supabase.from('hub_vendas_leads').select('id', { count: 'exact', head: true }).eq('status', 'encerrado'),
    supabase.from('hub_vendas_leads').select('id', { count: 'exact', head: true }).eq('status', 'fila_manual'),
    supabase
      .from('hub_vendas_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'aguardando_conversao')
      .gt('data_entrada_hub', limiteElegibilidade),
  ])

  const erro =
    convertidosError ?? recuperadosError ?? aguardandoError ?? perdidosError ?? filaManualError ?? candidatosError
  if (erro) throw erro

  return {
    convertidosHoje: convertidosHoje ?? 0,
    recuperadosHoje: recuperadosHoje ?? 0,
    aguardandoRespostaAgora: aguardandoRespostaAgora ?? 0,
    perdidosAtual: perdidosAtual ?? 0,
    filaManualAtual: filaManualAtual ?? 0,
    candidatosElegiveisAgora: candidatosElegiveisAgora ?? 0,
  }
}

async function contarFilasPorStatusHoje(
  supabase: SupabaseServiceClient,
  timezone: string
): Promise<Record<string, number>> {
  const { inicioUtc, fimUtc } = obterIntervaloDiaLocalUtc(new Date(), timezone)
  const { data, error } = await supabase.rpc('hub_vendas_status_contadores')
  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as StatusCountRow[]) {
    counts.set(row.status, Number(row.total) || 0)
  }

  // Contar enviados hoje separadamente (o RPC pode contar todos os enviados, nao apenas hoje)
  const { count: enviadosHoje, error: enviadosError } = await supabase
    .from('hub_vendas_recuperacao_fila')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'enviado')
    .gte('enviado_em', inicioUtc.toISOString())
    .lt('enviado_em', fimUtc.toISOString())
  if (enviadosError) throw enviadosError

  return {
    agendado: counts.get('agendado') ?? 0,
    reservado: counts.get('reservado') ?? 0,
    enviando: counts.get('enviando') ?? 0,
    enviado_hoje: enviadosHoje ?? 0,
    resultado_incerto: counts.get('resultado_incerto') ?? 0,
    analise_manual: counts.get('analise_manual') ?? 0,
    erro: counts.get('erro') ?? 0,
    cancelado: counts.get('cancelado') ?? 0,
  }
}

async function contarEnviadosPorLojaHoje(
  supabase: SupabaseServiceClient,
  timezone: string
): Promise<Record<string, number>> {
  const { inicioUtc, fimUtc } = obterIntervaloDiaLocalUtc(new Date(), timezone)
  const resultado: Record<string, number> = {}

  for (const [key, loja] of Object.entries(HUB_VENDAS_LOJAS)) {
    const { count, error } = await supabase
      .from('hub_vendas_recuperacao_fila')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'enviado')
      .eq('conexao_destino_id', loja.serviceId)
      .gte('enviado_em', inicioUtc.toISOString())
      .lt('enviado_em', fimUtc.toISOString())
    if (error) throw error
    resultado[key] = count ?? 0
  }

  return resultado
}

async function contarLeadsRecebidosHoje(
  supabase: SupabaseServiceClient,
  timezone: string
): Promise<number> {
  const { inicioUtc, fimUtc } = obterIntervaloDiaLocalUtc(new Date(), timezone)
  const { count, error } = await supabase
    .from('hub_vendas_leads')
    .select('id', { count: 'exact', head: true })
    .gte('data_entrada_hub', inicioUtc.toISOString())
    .lt('data_entrada_hub', fimUtc.toISOString())
  if (error) throw error
  return count ?? 0
}

async function verificarResumoJaEnviado(
  supabase: SupabaseServiceClient,
  dataLocal: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('hub_vendas_alertas')
    .select('id')
    .eq('tipo', 'resumo_diario')
    .eq('chave_deduplicacao', dataLocal)
    .eq('status', 'enviado')
    .limit(1)
  if (error) {
    console.error(`[HUB VENDAS RESUMO] erro ao verificar idempotencia data=${dataLocal} erro=${sanitizarDigisacParaLog(error.message)}`)
    return false
  }
  return (data?.length ?? 0) > 0
}

async function registrarResumoEnviado(
  supabase: SupabaseServiceClient,
  dataLocal: string,
  status: 'enviado' | 'falha'
): Promise<void> {
  const { error } = await supabase.from('hub_vendas_alertas').insert({
    tipo: 'resumo_diario',
    chave_deduplicacao: dataLocal,
    contato_id: obterAlertasContactId(),
    service_id: obterAlertasServiceId(),
    status,
    metadata: { dataLocal },
    enviado_em: new Date().toISOString(),
  })
  if (error) {
    console.error(`[HUB VENDAS RESUMO] erro ao registrar resumo data=${dataLocal} erro=${sanitizarDigisacParaLog(error.message)}`)
  }
}

export async function gerarTextoResumoDiario(
  supabase: SupabaseServiceClient
): Promise<string> {
  const config = await buscarConfig(supabase)
  const filas = await contarFilasPorStatusHoje(supabase, config.timezone)
  const enviadosPorLoja = await contarEnviadosPorLojaHoje(supabase, config.timezone)
  const leadsRecebidos = await contarLeadsRecebidosHoje(supabase, config.timezone)
  const resultadoLeads = await contarResultadoLeadsHubVendas(supabase, config.elegibilidadeHoras, config.timezone)

  const linhas: string[] = []
  linhas.push('HUB/VENDAS — RESUMO DIÁRIO')
  linhas.push(formatarDataLocal(new Date(), config.timezone))
  linhas.push('')

  // Bloco ENVIOS: mensagens de recuperação enviadas hoje, por loja.
  linhas.push('ENVIOS')
  let totalEnviado = 0
  for (const [, loja] of Object.entries(HUB_VENDAS_LOJAS)) {
    const enviados = enviadosPorLoja[Object.keys(HUB_VENDAS_LOJAS).find((k) => HUB_VENDAS_LOJAS[k as keyof typeof HUB_VENDAS_LOJAS] === loja) as keyof typeof HUB_VENDAS_LOJAS] ?? 0
    totalEnviado += enviados
    linhas.push(`${loja.nomeExibicao}: ${enviados}/${config.limiteDiarioPorConexao}`)
  }
  linhas.push(`Total enviado: ${totalEnviado}`)

  // Bloco RESULTADO DOS LEADS: onde os leads estão no funil.
  // "hoje" = tem timestamp dedicado da transição (data_conversao / data_recuperacao_respondida
  // / data_entrada_hub), filtrado pelo dia local. Os demais (aguardando resposta, perdidos,
  // fila manual, candidatos elegíveis) são fotografia do momento atual, não do dia — esses
  // status não têm uma coluna própria de "quando entrou nesse status" (só updated_at
  // genérico, tocado por qualquer atualização da linha), então não é seguro tratá-los como
  // "hoje". Ver relato da tarefa para o detalhamento dessa decisão.
  linhas.push('')
  linhas.push('RESULTADO DOS LEADS')
  linhas.push(`Leads registrados hoje: ${leadsRecebidos}`)
  linhas.push(`Convertidos organicamente hoje: ${resultadoLeads.convertidosHoje}`)
  linhas.push(`Recuperados hoje: ${resultadoLeads.recuperadosHoje}`)
  linhas.push(`Aguardando resposta agora: ${resultadoLeads.aguardandoRespostaAgora}`)
  linhas.push(`Perdidos até agora: ${resultadoLeads.perdidosAtual}`)
  linhas.push(`Fila manual até agora: ${resultadoLeads.filaManualAtual}`)
  linhas.push(`Candidatos elegíveis agora: ${resultadoLeads.candidatosElegiveisAgora}`)

  // Bloco OPERAÇÃO: saúde do processamento da fila (estoque atual, não "hoje").
  linhas.push('')
  linhas.push('OPERAÇÃO')
  linhas.push(`Filas agendadas: ${filas.agendado}`)
  linhas.push(`Erros: ${filas.erro}`)
  linhas.push(`Retries: 0`)
  linhas.push(`Cancelados: ${filas.cancelado}`)
  linhas.push(`Resultado incerto: ${filas.resultado_incerto}`)
  linhas.push(`Análise manual: ${filas.analise_manual}`)

  // Conexoes pausadas
  let conexoesPausadas = 0
  for (const [, value] of Object.entries(config.pausas)) {
    if (asRecord(value).pausada === true) conexoesPausadas += 1
  }
  linhas.push(`Conexões pausadas: ${conexoesPausadas}`)

  // Erros consecutivos por conexao
  const errosConsecutivos: string[] = []
  for (const [serviceId, value] of Object.entries(config.pausas)) {
    const erros = asNumber(asRecord(value).erros_consecutivos, 0)
    if (erros > 0) {
      const lojaEntry = Object.entries(HUB_VENDAS_LOJAS).find(([, l]) => l.serviceId === serviceId)
      const nome = lojaEntry?.[1].nomeExibicao ?? serviceId.slice(0, 8)
      errosConsecutivos.push(`${nome}: ${erros}`)
    }
  }
  if (errosConsecutivos.length > 0) {
    linhas.push(`Erros consecutivos: ${errosConsecutivos.join(', ')}`)
  }

  // Status geral: além do que já valia antes (automação pausada, erro de envio, resultado
  // incerto, conexão pausada), agora também considera análise manual pendente — sinal
  // explícito pedido para reavaliar esse critério nesta tarefa.
  const saudavel =
    !config.pausada &&
    filas.erro === 0 &&
    filas.resultado_incerto === 0 &&
    filas.analise_manual === 0 &&
    conexoesPausadas === 0
  linhas.push('')
  linhas.push(`Status geral: ${saudavel ? '✅ saudável' : '⚠️ com atenção'}`)
  if (config.pausada) {
    linhas.push(`Automação pausada: ${config.motivo ?? 'motivo não informado'}`)
  }

  if (totalEnviado === 0) {
    linhas.push('')
    linhas.push('Nenhuma mensagem de recuperação foi enviada hoje.')
  }

  return linhas.join('\n')
}

export async function enviarResumoDiarioHubVendas({
  supabase = createServiceClient(),
  agora = new Date(),
}: {
  supabase?: SupabaseServiceClient
  agora?: Date
} = {}): Promise<ResultadoResumoDiario> {
  try {
    const config = await buscarConfig(supabase)
    const dataLocal = chaveDataLocal(agora, config.timezone)

    const jaEnviado = await verificarResumoJaEnviado(supabase, dataLocal)
    if (jaEnviado) {
      console.log(`[HUB VENDAS RESUMO] ja enviado para data=${dataLocal}`)
      return { ok: true, dataLocal, deduplicado: true, enviado: false }
    }

    console.log(`[HUB VENDAS RESUMO] preparado data=${dataLocal}`)
    const texto = await gerarTextoResumoDiario(supabase)

    const botUserId = obterBotUserId()
    const contactId = obterAlertasContactId()
    const serviceId = obterAlertasServiceId()

    const response = await fetchDigisacRaw('/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: texto,
        type: 'chat',
        contactId,
        serviceId,
        userId: botUserId,
        origin: 'bot',
        fromMe: true,
        editMessage: null,
        isComment: false,
        subject: 'Resumo Diario Hub/Vendas',
      }),
    })
    const bodyText = await response.text().catch(() => '')

    if (!response.ok) {
      const erro = `status=${response.status} body=${sanitizarDigisacParaLog(bodyText).slice(0, 150)}`
      console.error(`[HUB VENDAS RESUMO] falha envio data=${dataLocal} erro=${erro}`)
      await registrarResumoEnviado(supabase, dataLocal, 'falha')
      return { ok: false, erro }
    }

    console.log(`[HUB VENDAS RESUMO] enviado data=${dataLocal} resultado=enviado`)
    await registrarResumoEnviado(supabase, dataLocal, 'enviado')
    return { ok: true, dataLocal, deduplicado: false, enviado: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[HUB VENDAS RESUMO] erro erro=${sanitizarDigisacParaLog(msg).slice(0, 200)}`)
    return { ok: false, erro: msg }
  }
}

// ---------------------------------------------------------------------------
// Consulta para a tela administrativa
// ---------------------------------------------------------------------------

export type StatusResumoDiarioTela = {
  ultimoResumoEm: string | null
  ultimoResumoDataLocal: string | null
  ultimoResumoStatus: string | null
}

export async function obterStatusResumoDiarioTela(
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<StatusResumoDiarioTela> {
  const { data, error } = await supabase
    .from('hub_vendas_alertas')
    .select('enviado_em, chave_deduplicacao, status')
    .eq('tipo', 'resumo_diario')
    .order('enviado_em', { ascending: false })
    .limit(1)

  if (error) throw error

  const row = (data ?? [])[0] as { enviado_em: string; chave_deduplicacao: string; status: string } | undefined
  return {
    ultimoResumoEm: row?.enviado_em ?? null,
    ultimoResumoDataLocal: row?.chave_deduplicacao ?? null,
    ultimoResumoStatus: row?.status ?? null,
  }
}
