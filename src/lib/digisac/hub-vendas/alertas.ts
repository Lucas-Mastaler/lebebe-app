import { createServiceClient } from '@/lib/supabase/service'
import { fetchDigisacRaw, sanitizarDigisacParaLog } from '@/lib/digisac/clienteDigisac'
import {
  HUB_VENDAS_ALERTA_JANELA_DEDUP_MINUTOS,
  HUB_VENDAS_LOJAS,
  HUB_VENDAS_SERVICE_ID_PARA_LOJA,
  obterAlertasContactId,
  obterAlertasServiceId,
} from './constants'
import { obterPartesDataLocal } from './tempo'
import { obterProximaExecucaoHubVendasTexto } from './cron-schedule'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>

export type TipoAlertaHubVendas =
  | 'automacao_pausada_automatica'
  | 'conexao_pausada_automatica'
  | 'erro_envio'
  | 'resultado_incerto'
  | 'analise_manual'
  | 'reserva_liberada'
  | 'envio_travado'
  | 'retry_agendado'
  | 'falha_recorrente_conexao'
  | 'cron_falhou'
  | 'resumo_diario'
  | 'teste_manual'

type ResultadoEnvioAlerta =
  | { ok: true; deduplicado: false }
  | { ok: true; deduplicado: true }
  | { ok: false; erro: string }

type StatusAlertaHubVendas = 'enviado' | 'falha'

function obterBotUserId(): string {
  const id = process.env.DIGISAC_BOT_USER_ID
  if (!id) throw new Error('digisac_bot_user_id_nao_configurado')
  return id
}

function nomeLojaPorServiceId(serviceId: string | null | undefined): string {
  if (!serviceId) return 'N/A'
  const lojaKey = HUB_VENDAS_SERVICE_ID_PARA_LOJA.get(serviceId)
  if (lojaKey) return HUB_VENDAS_LOJAS[lojaKey].nomeExibicao
  return serviceId.slice(0, 8)
}

function abreviarFilaId(filaId: string | null | undefined): string {
  if (!filaId) return 'N/A'
  return filaId.slice(0, 8)
}

function formatarDataHoraLocal(data: Date, timezone: string): string {
  const partes = obterPartesDataLocal(data, timezone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(partes.dia)}/${pad(partes.mes)}/${partes.ano} ${pad(partes.hora)}:${pad(partes.minuto)}`
}

/**
 * Verifica se um alerta do mesmo tipo+chave ja foi enviado dentro da janela de deduplicacao.
 * Retorna true se o alerta deve ser suprimido (deduplicado).
 */
async function alertaRecenteEnviado(
  supabase: SupabaseServiceClient,
  tipo: TipoAlertaHubVendas,
  chaveDeduplicacao: string
): Promise<boolean> {
  const janelaMs = HUB_VENDAS_ALERTA_JANELA_DEDUP_MINUTOS * 60 * 1000
  const limite = new Date(Date.now() - janelaMs).toISOString()
  const { data, error } = await supabase
    .from('hub_vendas_alertas')
    .select('id')
    .eq('tipo', tipo)
    .eq('chave_deduplicacao', chaveDeduplicacao)
    .eq('status', 'enviado')
    .gte('enviado_em', limite)
    .limit(1)
  if (error) {
    console.error(`[HUB VENDAS ALERTA] erro ao consultar deduplicacao tipo=${tipo} erro=${sanitizarDigisacParaLog(error.message)}`)
    return false
  }
  return (data?.length ?? 0) > 0
}

function sanitizarMetadataAlerta(metadata: Record<string, unknown>): Record<string, unknown> {
  const resultado: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(metadata)) {
    if (typeof valor === 'string') {
      const sanitizado = sanitizarDigisacParaLog(valor)
        .replace(/Bearer\s+\[redacted\]/gi, '[redacted]')
        .replace(/password\s+\[redacted\]/gi, '[redacted]')
      resultado[chave] = sanitizado
    } else if (Array.isArray(valor)) {
      resultado[chave] = valor.map((item) => {
        if (typeof item !== 'string') return item
        return sanitizarDigisacParaLog(item)
          .replace(/Bearer\s+\[redacted\]/gi, '[redacted]')
          .replace(/password\s+\[redacted\]/gi, '[redacted]')
      })
    } else {
      resultado[chave] = valor
    }
  }
  return resultado
}

async function registrarAlertaEnviado(
  supabase: SupabaseServiceClient,
  params: {
    tipo: TipoAlertaHubVendas
    chaveDeduplicacao: string
    status: StatusAlertaHubVendas
    metadata: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await supabase.from('hub_vendas_alertas').insert({
    tipo: params.tipo,
    chave_deduplicacao: params.chaveDeduplicacao,
    contato_id: obterAlertasContactId(),
    service_id: obterAlertasServiceId(),
    status: params.status,
    metadata: sanitizarMetadataAlerta(params.metadata),
    enviado_em: new Date().toISOString(),
  })
  if (error) {
    console.error(`[HUB VENDAS ALERTA] erro ao registrar alerta tipo=${params.tipo} erro=${sanitizarDigisacParaLog(error.message)}`)
  }
}

async function enviarMensagemAlertaBot(texto: string): Promise<{ ok: boolean; erro?: string }> {
  const botUserId = obterBotUserId()
  const contactId = obterAlertasContactId()
  const serviceId = obterAlertasServiceId()

  try {
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
        subject: 'Alerta Operacional Hub/Vendas',
      }),
    })
    const bodyText = await response.text().catch(() => '')
    if (!response.ok) {
      return { ok: false, erro: `status=${response.status} body=${sanitizarDigisacParaLog(bodyText).slice(0, 150)}` }
    }
    return { ok: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, erro: sanitizarDigisacParaLog(msg).slice(0, 200) }
  }
}

/**
 * Funcao central de envio de alerta com deduplicacao.
 * Nao lanca erro — falhas no envio de alerta sao apenas logadas e nunca alteram filas do cliente.
 */
export async function enviarAlertaOperacionalHubVendas(params: {
  supabase?: SupabaseServiceClient
  tipo: TipoAlertaHubVendas
  chaveDeduplicacao: string
  texto: string
  metadata?: Record<string, unknown>
}): Promise<ResultadoEnvioAlerta> {
  const supabase = params.supabase ?? createServiceClient()

  const jaEnviado = await alertaRecenteEnviado(supabase, params.tipo, params.chaveDeduplicacao)
  if (jaEnviado) {
    console.log(`[HUB VENDAS ALERTA] deduplicado tipo=${params.tipo} chave=${params.chaveDeduplicacao}`)
    return { ok: true, deduplicado: true }
  }

  console.log(`[HUB VENDAS ALERTA] preparado tipo=${params.tipo} chave=${params.chaveDeduplicacao}`)
  const resultado = await enviarMensagemAlertaBot(params.texto)

  if (!resultado.ok) {
    console.error(`[HUB VENDAS ALERTA] falha envio tipo=${params.tipo} erro=${resultado.erro}`)
    await registrarAlertaEnviado(supabase, {
      tipo: params.tipo,
      chaveDeduplicacao: params.chaveDeduplicacao,
      status: 'falha',
      metadata: { ...params.metadata ?? {}, erro: resultado.erro },
    })
    return { ok: false, erro: resultado.erro ?? 'erro_desconhecido' }
  }

  console.log(`[HUB VENDAS ALERTA] enviado tipo=${params.tipo} chave=${params.chaveDeduplicacao} resultado=enviado`)
  await registrarAlertaEnviado(supabase, {
    tipo: params.tipo,
    chaveDeduplicacao: params.chaveDeduplicacao,
    status: 'enviado',
    metadata: params.metadata ?? {},
  })
  return { ok: true, deduplicado: false }
}

// ---------------------------------------------------------------------------
// Funcoes especificas por tipo de evento
// ---------------------------------------------------------------------------

export async function alertarConexaoPausadaAutomatica(params: {
  supabase?: SupabaseServiceClient
  serviceId: string
  errosConsecutivos: number
  motivo: string
  timezone?: string
}): Promise<void> {
  const loja = nomeLojaPorServiceId(params.serviceId)
  const agora = new Date()
  const tz = params.timezone ?? 'America/Sao_Paulo'
  const texto = [
    'HUB/VENDAS — ⚠️ CONEXÃO PAUSADA',
    '',
    `Loja: ${loja}`,
    `Motivo: ${params.motivo}`,
    `Erros consecutivos: ${params.errosConsecutivos}`,
    `Horário: ${formatarDataHoraLocal(agora, tz)}`,
    'Ação recomendada: verificar Digisac e liberar pela tela /hub-vendas.',
  ].join('\n')

  await enviarAlertaOperacionalHubVendas({
    supabase: params.supabase,
    tipo: 'conexao_pausada_automatica',
    chaveDeduplicacao: `conexao:${params.serviceId}`,
    texto,
    metadata: { serviceId: params.serviceId, loja, errosConsecutivos: params.errosConsecutivos, motivo: params.motivo },
  })
}

export async function alertarAutomacaoPausadaAutomatica(params: {
  supabase?: SupabaseServiceClient
  motivo: string
  timezone?: string
}): Promise<void> {
  const agora = new Date()
  const tz = params.timezone ?? 'America/Sao_Paulo'
  const texto = [
    'HUB/VENDAS — 🛑 AUTOMAÇÃO PAUSADA',
    '',
    `Motivo: ${params.motivo}`,
    `Horário: ${formatarDataHoraLocal(agora, tz)}`,
    'Ação recomendada: verificar configuração e reativar pela tela /hub-vendas.',
  ].join('\n')

  await enviarAlertaOperacionalHubVendas({
    supabase: params.supabase,
    tipo: 'automacao_pausada_automatica',
    chaveDeduplicacao: 'automacao:global',
    texto,
    metadata: { motivo: params.motivo },
  })
}

export async function alertarErroEnvio(params: {
  supabase?: SupabaseServiceClient
  filaId: string
  serviceId: string | null
  tentativa: number
  erro: string
  retryAgendado: boolean
  proximoRetry?: string | null
  timezone?: string
}): Promise<void> {
  const loja = nomeLojaPorServiceId(params.serviceId)
  const tz = params.timezone ?? 'America/Sao_Paulo'
  const linhas = [
    'HUB/VENDAS — ❌ ERRO DE ENVIO',
    '',
    `Loja: ${loja}`,
    `Fila: ${abreviarFilaId(params.filaId)}`,
    `Tentativa: ${params.tentativa}`,
    `Erro: ${sanitizarDigisacParaLog(params.erro).slice(0, 200)}`,
  ]
  if (params.retryAgendado && params.proximoRetry) {
    linhas.push(`Próximo retry: ${formatarDataHoraLocal(new Date(params.proximoRetry), tz)}`)
  } else {
    linhas.push('Sem retry automático (erro definitivo ou limite de tentativas atingido).')
  }
  const texto = linhas.join('\n')

  await enviarAlertaOperacionalHubVendas({
    supabase: params.supabase,
    tipo: 'erro_envio',
    chaveDeduplicacao: `fila:${params.filaId}`,
    texto,
    metadata: {
      filaId: abreviarFilaId(params.filaId),
      serviceId: params.serviceId,
      loja,
      tentativa: params.tentativa,
      retryAgendado: params.retryAgendado,
    },
  })
}

export async function alertarResultadoIncerto(params: {
  supabase?: SupabaseServiceClient
  filaId: string
  serviceId: string | null
  erro: string
  timezone?: string
}): Promise<void> {
  const loja = nomeLojaPorServiceId(params.serviceId)
  const agora = new Date()
  const tz = params.timezone ?? 'America/Sao_Paulo'
  const texto = [
    'HUB/VENDAS — ❓ RESULTADO INCERTO',
    '',
    `Loja: ${loja}`,
    `Fila: ${abreviarFilaId(params.filaId)}`,
    `Erro: ${sanitizarDigisacParaLog(params.erro).slice(0, 200)}`,
    `Horário: ${formatarDataHoraLocal(agora, tz)}`,
    'Ação recomendada: verificar no Digisac se a mensagem foi entregue.',
  ].join('\n')

  await enviarAlertaOperacionalHubVendas({
    supabase: params.supabase,
    tipo: 'resultado_incerto',
    chaveDeduplicacao: `fila:${params.filaId}`,
    texto,
    metadata: { filaId: abreviarFilaId(params.filaId), serviceId: params.serviceId, loja },
  })
}

export async function alertarAnaliseManual(params: {
  supabase?: SupabaseServiceClient
  filaId: string
  serviceId: string | null
  categoria: string
  timezone?: string
}): Promise<void> {
  const loja = nomeLojaPorServiceId(params.serviceId)
  const agora = new Date()
  const tz = params.timezone ?? 'America/Sao_Paulo'
  const texto = [
    'HUB/VENDAS — 🔍 ANÁLISE MANUAL',
    '',
    `Loja: ${loja}`,
    `Fila: ${abreviarFilaId(params.filaId)}`,
    `Categoria: ${params.categoria}`,
    `Horário: ${formatarDataHoraLocal(agora, tz)}`,
    'Ação recomendada: revisar fila na tela /hub-vendas e liberar ou cancelar.',
  ].join('\n')

  await enviarAlertaOperacionalHubVendas({
    supabase: params.supabase,
    tipo: 'analise_manual',
    chaveDeduplicacao: `fila:${params.filaId}`,
    texto,
    metadata: { filaId: abreviarFilaId(params.filaId), serviceId: params.serviceId, loja, categoria: params.categoria },
  })
}

export async function alertarReservaLiberada(params: {
  supabase?: SupabaseServiceClient
  filaId: string
  serviceId: string | null
  motivo: string
}): Promise<void> {
  const loja = nomeLojaPorServiceId(params.serviceId)
  const texto = [
    'HUB/VENDAS — 🔓 RESERVA LIBERADA',
    '',
    `Loja: ${loja}`,
    `Fila: ${abreviarFilaId(params.filaId)}`,
    `Motivo: ${params.motivo}`,
    'Ação recomendada: verificar se o cron de processamento retomou normalmente.',
  ].join('\n')

  await enviarAlertaOperacionalHubVendas({
    supabase: params.supabase,
    tipo: 'reserva_liberada',
    chaveDeduplicacao: `fila:${params.filaId}`,
    texto,
    metadata: { filaId: abreviarFilaId(params.filaId), serviceId: params.serviceId, loja, motivo: params.motivo },
  })
}

export async function alertarEnvioTravado(params: {
  supabase?: SupabaseServiceClient
  filaId: string
  serviceId: string | null
  motivo: string
}): Promise<void> {
  const loja = nomeLojaPorServiceId(params.serviceId)
  const texto = [
    'HUB/VENDAS — ⏳ ENVIO TRAVADO',
    '',
    `Loja: ${loja}`,
    `Fila: ${abreviarFilaId(params.filaId)}`,
    `Motivo: ${params.motivo}`,
    'Ação recomendada: verificar fila no Digisac e na tela /hub-vendas.',
  ].join('\n')

  await enviarAlertaOperacionalHubVendas({
    supabase: params.supabase,
    tipo: 'envio_travado',
    chaveDeduplicacao: `fila:${params.filaId}`,
    texto,
    metadata: { filaId: abreviarFilaId(params.filaId), serviceId: params.serviceId, loja, motivo: params.motivo },
  })
}

export async function alertarCronFalhou(params: {
  supabase?: SupabaseServiceClient
  rota: string
  erro: string
}): Promise<void> {
  const texto = [
    'HUB/VENDAS — ⚠️ CRON FALHOU',
    '',
    `Rota: ${params.rota}`,
    `Erro: ${sanitizarDigisacParaLog(params.erro).slice(0, 200)}`,
    `Próxima execução agendada: ${obterProximaExecucaoHubVendasTexto(params.rota)}`,
    'Ação recomendada: verificar logs do servidor e retomar processamento.',
  ].join('\n')

  await enviarAlertaOperacionalHubVendas({
    supabase: params.supabase,
    tipo: 'cron_falhou',
    chaveDeduplicacao: `rota:${params.rota}`,
    texto,
    metadata: { rota: params.rota },
  })
}

// ---------------------------------------------------------------------------
// Teste manual — envia alerta apenas ao contato técnico, sem afetar filas/leads.
// Deduplicação curta por minuto para evitar clique duplo sem bloquear testes futuros.
// ---------------------------------------------------------------------------

export async function alertarTesteManual(params?: {
  supabase?: SupabaseServiceClient
  timezone?: string
}): Promise<ResultadoEnvioAlerta> {
  const tz = params?.timezone ?? 'America/Sao_Paulo'
  const agora = new Date()
  const partes = obterPartesDataLocal(agora, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dataHoraLocal = `${pad(partes.dia)}/${pad(partes.mes)}/${partes.ano} ${pad(partes.hora)}:${pad(partes.minuto)}`
  // Chave por minuto — janela curta de deduplicação (~30-60s) sem bloquear testes futuros
  const chaveDedup = `teste:${partes.ano}-${pad(partes.mes)}-${pad(partes.dia)}T${pad(partes.hora)}:${pad(partes.minuto)}`

  const texto = [
    'HUB/VENDAS — TESTE DE ALERTA',
    '',
    'Este é um teste manual da integração de alertas.',
    '',
    'Origem: tela administrativa',
    'Resultado esperado: mensagem enviada pelo bot',
    `Data/hora: ${dataHoraLocal} (${tz})`,
    '',
    'Nenhuma fila, lead ou cliente foi alterado.',
  ].join('\n')

  return enviarAlertaOperacionalHubVendas({
    supabase: params?.supabase,
    tipo: 'teste_manual',
    chaveDeduplicacao: chaveDedup,
    texto,
    metadata: { origem: 'tela_administrativa', timezone: tz },
  })
}

// ---------------------------------------------------------------------------
// Consulta para a tela administrativa
// ---------------------------------------------------------------------------

export type ResumoAlertasTela = {
  total24h: number
  ultimoAlertaEm: string | null
  ultimoTipo: string | null
  ultimos: Array<{
    tipo: string
    status: string
    enviadoEm: string
    chaveDeduplicacao: string
  }>
}

export async function obterResumoAlertasTela(
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<ResumoAlertasTela> {
  const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recentes, error } = await supabase
    .from('hub_vendas_alertas')
    .select('tipo, status, enviado_em, chave_deduplicacao')
    .gte('enviado_em', limite24h)
    .order('enviado_em', { ascending: false })
    .limit(20)

  if (error) throw error

  const rows = (recentes ?? []) as Array<{ tipo: string; status: string; enviado_em: string; chave_deduplicacao: string }>
  const enviados = rows.filter((r) => r.status === 'enviado')

  return {
    total24h: enviados.length,
    ultimoAlertaEm: enviados[0]?.enviado_em ?? null,
    ultimoTipo: enviados[0]?.tipo ?? null,
    ultimos: rows.slice(0, 10).map((r) => ({
      tipo: r.tipo,
      status: r.status,
      enviadoEm: r.enviado_em,
      chaveDeduplicacao: r.chave_deduplicacao,
    })),
  }
}
