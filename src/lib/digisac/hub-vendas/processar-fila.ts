import { createServiceClient } from '@/lib/supabase/service'
import { analisarReconciliacaoLead, type HubVendasLeadPendente } from './preparar-fila'
import {
  abrirTicketResgateHubVendas,
  buscarContatoResgatePorTelefone,
  buscarTicketAbertoContato,
  enviarMensagemResgateHubVendas,
  garantirContatoResgateHubVendas,
  hashTextoHubVendas,
  mascararTextoParaResposta,
} from './envio'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>

type HubVendasFila = {
  id: string
  lead_id: string
  conexao_destino_id: string
  conexao_destino_nome: string | null
  status: string
  programado_para: string
  reservado_em: string | null
  reservado_por: string | null
  requisicao_iniciada_em: string | null
  requisicao_finalizada_em: string | null
  enviado_em: string | null
  resultado: string | null
  erro: string | null
  categoria_erro: string | null
  motivo_cancelamento: string | null
  versao_mensagem: number | null
  texto_enviado: string | null
  hash_texto_enviado: string | null
  digisac_message_id: string | null
  digisac_contact_id: string | null
  digisac_ticket_id: string | null
  ultima_reconciliacao_em: string | null
  quantidade_reconciliacoes: number
  tentativas_envio?: number
  created_at: string
  updated_at: string
}

type ConfigAutomacao = {
  ativa: boolean
  pausada: boolean
  motivo: string | null
}

type ConfigParametros = {
  pausa_automatica_erros: number
}

type MensagemRecuperacao = {
  ordem: number
  id: string
  nome: string
  ativa: boolean
  texto: string
}

type ConfigHubVendas = {
  automacao: ConfigAutomacao
  parametros: ConfigParametros
  pausasConexoes: unknown
  mensagens: MensagemRecuperacao[]
}

type DetalheProcessamento = {
  filaId: string
  leadId: string | null
  statusInicial: string | null
  acao: string
  motivo?: string
  conexaoDestinoId?: string | null
  contato?: 'existente' | 'criado' | 'nao_consultado'
  ticket?: 'aberto_existente' | 'transferido' | 'nao_consultado'
  versaoMensagem?: number | null
  hashTexto?: string | null
  textoMascarado?: string | null
  programadoPara?: string | null
}

export type ResultadoProcessamentoHubVendas = {
  ok: boolean
  automacaoAtiva: boolean
  pausada: boolean
  motivo: string | null
  modoTeste: boolean
  modoSimulacao: boolean
  filaId: string | null
  workerId: string
  totalReservado: number
  totalEnviado: number
  totalCancelado: number
  totalResultadoIncerto: number
  totalRetryAgendado: number
  totalErro: number
  totalAnaliseManual: number
  detalhes: DetalheProcessamento[]
}

type CategoriaErro =
  | 'autenticacao'
  | 'rate_limit'
  | 'indisponibilidade'
  | 'timeout_resultado_incerto'
  | 'validacao'
  | 'contato'
  | 'ticket'
  | 'mensagem'
  | 'erro_interno'
  | 'configuracao'

const LIMITE_PADRAO = 1
const LIMITE_MAXIMO = 5
const BACKOFF_MINUTOS = [5, 15, 60]

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

function lerAutomacao(valor: unknown): ConfigAutomacao {
  const record = asRecord(valor)
  return {
    ativa: asBoolean(record.ativa, false),
    pausada: asBoolean(record.pausada, true),
    motivo: asString(record.motivo),
  }
}

function lerParametros(valor: unknown): ConfigParametros {
  const record = asRecord(valor)
  return {
    pausa_automatica_erros: asNumber(record.pausa_automatica_erros, 3),
  }
}

function lerMensagens(valor: unknown): MensagemRecuperacao[] {
  const versoes = asRecord(valor).versoes
  if (!Array.isArray(versoes)) return []
  return versoes
    .map((item) => {
      const record = asRecord(item)
      return {
        ordem: asNumber(record.ordem, 0),
        id: asString(record.id) ?? '',
        nome: asString(record.nome) ?? '',
        ativa: record.ativa === true,
        texto: asString(record.texto) ?? '',
      }
    })
    .filter((item) => item.ordem >= 1 && item.ordem <= 5 && item.texto)
    .sort((a, b) => a.ordem - b.ordem)
}

function conexaoPausada(pausas: unknown, serviceId: string): boolean {
  const config = asRecord(asRecord(pausas)[serviceId])
  return config.pausada === true
}

function gerarWorkerId(): string {
  return `hub-vendas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function classificarErro(error: unknown): { categoria: CategoriaErro; retentavel: boolean; incrementaInfra: boolean; resultadoIncerto: boolean; mensagem: string } {
  const mensagem = (error instanceof Error ? error.message : String(error)).slice(0, 500)
  if (/sem_mensagem_ativa|configuracao|configura/i.test(mensagem)) {
    return { categoria: 'configuracao', retentavel: false, incrementaInfra: false, resultadoIncerto: false, mensagem }
  }
  if (/timeout|aborted|network|fetch|econnreset|terminated/i.test(mensagem)) {
    return { categoria: 'timeout_resultado_incerto', retentavel: false, incrementaInfra: false, resultadoIncerto: true, mensagem }
  }
  if (/autentica|401|403/i.test(mensagem)) {
    return { categoria: 'autenticacao', retentavel: false, incrementaInfra: true, resultadoIncerto: false, mensagem }
  }
  if (/rate limit|429/i.test(mensagem)) {
    return { categoria: 'rate_limit', retentavel: true, incrementaInfra: true, resultadoIncerto: false, mensagem }
  }
  if (/contato/i.test(mensagem)) {
    return { categoria: 'contato', retentavel: true, incrementaInfra: false, resultadoIncerto: false, mensagem }
  }
  if (/ticket|transfer/i.test(mensagem)) {
    return { categoria: 'ticket', retentavel: true, incrementaInfra: false, resultadoIncerto: false, mensagem }
  }
  if (/mensagem|messages/i.test(mensagem)) {
    return { categoria: 'mensagem', retentavel: true, incrementaInfra: true, resultadoIncerto: false, mensagem }
  }
  return { categoria: 'erro_interno', retentavel: true, incrementaInfra: false, resultadoIncerto: false, mensagem }
}

function escolherMensagem(mensagens: MensagemRecuperacao[], fila: HubVendasFila): MensagemRecuperacao | null {
  const ativas = mensagens.filter((mensagem) => mensagem.ativa)
  if (ativas.length === 0) return null
  if (fila.versao_mensagem) {
    return ativas.find((mensagem) => mensagem.ordem === fila.versao_mensagem) ?? null
  }
  const indice = Math.abs(hashTextoHubVendas(fila.id).charCodeAt(0)) % ativas.length
  return ativas[indice]
}

function montarTextoMensagem(mensagem: MensagemRecuperacao, fila: HubVendasFila): string {
  return mensagem.texto.replaceAll('[LOJA]', fila.conexao_destino_nome ?? 'Le Bebe')
}

async function buscarConfig(supabase: SupabaseServiceClient): Promise<ConfigHubVendas> {
  const { data, error } = await supabase
    .from('hub_vendas_config')
    .select('chave, valor')
    .in('chave', ['automacao', 'parametros', 'pausas_conexoes', 'mensagens_recuperacao'])

  if (error) throw error
  const configs = new Map((data ?? []).map((row: { chave: string; valor: unknown }) => [row.chave, row.valor]))

  return {
    automacao: lerAutomacao(configs.get('automacao')),
    parametros: lerParametros(configs.get('parametros')),
    pausasConexoes: configs.get('pausas_conexoes'),
    mensagens: lerMensagens(configs.get('mensagens_recuperacao')),
  }
}

async function buscarFilaPorId(supabase: SupabaseServiceClient, filaId: string): Promise<HubVendasFila | null> {
  const { data, error } = await supabase
    .from('hub_vendas_recuperacao_fila')
    .select('*')
    .eq('id', filaId)
    .limit(1)

  if (error) throw error
  return ((data ?? []) as HubVendasFila[])[0] ?? null
}

async function buscarFilasSimulacao(supabase: SupabaseServiceClient, limite: number, filaId?: string): Promise<HubVendasFila[]> {
  if (filaId) {
    const fila = await buscarFilaPorId(supabase, filaId)
    return fila ? [fila] : []
  }

  const { data, error } = await supabase
    .from('hub_vendas_recuperacao_fila')
    .select('*')
    .eq('status', 'agendado')
    .lte('programado_para', new Date().toISOString())
    .order('programado_para', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limite)

  if (error) throw error
  return (data ?? []) as HubVendasFila[]
}

async function buscarLead(supabase: SupabaseServiceClient, leadId: string): Promise<HubVendasLeadPendente & { nome_contato_hub?: string | null } | null> {
  const { data, error } = await supabase
    .from('hub_vendas_leads')
    .select('id, telefone_normalizado_ddi, data_entrada_hub, status, nome_contato_hub')
    .eq('id', leadId)
    .limit(1)

  if (error) throw error
  return ((data ?? []) as Array<HubVendasLeadPendente & { nome_contato_hub?: string | null }>)[0] ?? null
}

async function reservarFilas(params: {
  supabase: SupabaseServiceClient
  limite: number
  workerId: string
  modoTeste: boolean
  filaId?: string
}): Promise<HubVendasFila[]> {
  const { data, error } = await params.supabase.rpc('hub_vendas_reservar_filas_recuperacao', {
    p_limite: params.limite,
    p_worker: params.workerId,
    p_modo_teste: params.modoTeste,
    p_fila_id: params.filaId ?? null,
  })
  if (error) throw error
  return (Array.isArray(data) ? data : data ? [data] : []) as HubVendasFila[]
}

async function marcarEnviando(params: {
  supabase: SupabaseServiceClient
  fila: HubVendasFila
  workerId: string
  contactId: string
  ticketId: string | null
  mensagem: MensagemRecuperacao
  texto: string
  hash: string
}) {
  const { error } = await params.supabase.rpc('hub_vendas_marcar_fila_enviando', {
    p_fila_id: params.fila.id,
    p_worker: params.workerId,
    p_digisac_contact_id: params.contactId,
    p_digisac_ticket_id: params.ticketId,
    p_versao_mensagem: params.mensagem.ordem,
    p_texto_enviado: params.texto,
    p_hash_texto_enviado: params.hash,
  })
  if (error) throw error
}

async function confirmarEnviado(params: {
  supabase: SupabaseServiceClient
  fila: HubVendasFila
  workerId: string
  messageId: string | null
  contactId: string | null
  ticketId: string | null
}) {
  const { error } = await params.supabase.rpc('hub_vendas_confirmar_fila_enviada', {
    p_fila_id: params.fila.id,
    p_worker: params.workerId,
    p_digisac_message_id: params.messageId,
    p_digisac_contact_id: params.contactId,
    p_digisac_ticket_id: params.ticketId,
    p_resultado: 'ok',
  })
  if (error) throw error
}

async function cancelarFila(supabase: SupabaseServiceClient, fila: HubVendasFila, workerId: string, motivo: string) {
  const { error } = await supabase.rpc('hub_vendas_cancelar_fila_reservada', {
    p_fila_id: fila.id,
    p_worker: workerId,
    p_motivo: motivo,
  })
  if (error) throw error
}

async function registrarResultadoIncerto(supabase: SupabaseServiceClient, fila: HubVendasFila, workerId: string, erro: string) {
  const { error } = await supabase.rpc('hub_vendas_registrar_resultado_incerto', {
    p_fila_id: fila.id,
    p_worker: workerId,
    p_categoria: 'timeout_resultado_incerto',
    p_erro: erro,
  })
  if (error) throw error
}

async function registrarErro(supabase: SupabaseServiceClient, fila: HubVendasFila, workerId: string, erro: ReturnType<typeof classificarErro>) {
  const tentativaAtual = fila.tentativas_envio ?? 0
  const backoff = BACKOFF_MINUTOS[Math.min(tentativaAtual, BACKOFF_MINUTOS.length - 1)]
  const { error } = await supabase.rpc('hub_vendas_registrar_erro_fila', {
    p_fila_id: fila.id,
    p_worker: workerId,
    p_categoria: erro.categoria,
    p_erro: erro.mensagem,
    p_retentavel: erro.retentavel,
    p_backoff_minutos: backoff,
    p_incrementa_erro_conexao: erro.incrementaInfra,
  })
  if (error) throw error
}

async function processarFilaReservada(params: {
  supabase: SupabaseServiceClient
  fila: HubVendasFila
  config: ConfigHubVendas
  workerId: string
  agora: Date
}): Promise<DetalheProcessamento> {
  const lead = await buscarLead(params.supabase, params.fila.lead_id)
  if (!lead) {
    await cancelarFila(params.supabase, params.fila, params.workerId, 'lead_nao_encontrado')
    return { filaId: params.fila.id, leadId: params.fila.lead_id, statusInicial: params.fila.status, acao: 'cancelado', motivo: 'lead_nao_encontrado' }
  }

  const analise = await analisarReconciliacaoLead(lead, params.agora)
  if (analise.resultado === 'convertido_reconciliacao' || analise.resultado === 'cliente_em_atendimento') {
    await cancelarFila(params.supabase, params.fila, params.workerId, analise.resultado)
    return { filaId: params.fila.id, leadId: lead.id, statusInicial: params.fila.status, acao: 'cancelado', motivo: analise.resultado }
  }

  if (conexaoPausada(params.config.pausasConexoes, params.fila.conexao_destino_id)) {
    await cancelarFila(params.supabase, params.fila, params.workerId, 'conexao_pausada')
    return { filaId: params.fila.id, leadId: lead.id, statusInicial: params.fila.status, acao: 'cancelado', motivo: 'conexao_pausada' }
  }

  const mensagem = escolherMensagem(params.config.mensagens, params.fila)
  if (!mensagem) throw new Error('sem_mensagem_ativa')

  const texto = montarTextoMensagem(mensagem, params.fila)
  const hash = hashTextoHubVendas(texto)
  const contato = await garantirContatoResgateHubVendas({
    telefoneNormalizadoDDI: lead.telefone_normalizado_ddi,
    serviceId: params.fila.conexao_destino_id,
    nomeContato: lead.nome_contato_hub ?? null,
  })

  const ticketAberto = await buscarTicketAbertoContato(contato.contactId)
  if (ticketAberto) {
    await cancelarFila(params.supabase, params.fila, params.workerId, 'chamado_aberto_na_conexao_destino')
    return {
      filaId: params.fila.id,
      leadId: lead.id,
      statusInicial: params.fila.status,
      acao: 'cancelado',
      motivo: 'chamado_aberto_na_conexao_destino',
      contato: contato.criado ? 'criado' : 'existente',
      ticket: 'aberto_existente',
    }
  }

  const ticket = await abrirTicketResgateHubVendas({
    contactId: contato.contactId,
    serviceId: params.fila.conexao_destino_id,
  })

  await marcarEnviando({
    supabase: params.supabase,
    fila: params.fila,
    workerId: params.workerId,
    contactId: contato.contactId,
    ticketId: ticket.ticketId,
    mensagem,
    texto,
    hash,
  })

  const envio = await enviarMensagemResgateHubVendas({ contactId: contato.contactId, texto })
  if (!envio.ok) {
    if (envio.resultadoIncerto) {
      await registrarResultadoIncerto(params.supabase, params.fila, params.workerId, envio.erro)
      return { filaId: params.fila.id, leadId: lead.id, statusInicial: params.fila.status, acao: 'resultado_incerto', motivo: 'timeout_resultado_incerto' }
    }
    throw new Error(envio.erro)
  }

  if (!envio.messageId?.trim()) {
    await registrarResultadoIncerto(params.supabase, params.fila, params.workerId, 'digisac_message_id_ausente_apos_post')
    return { filaId: params.fila.id, leadId: lead.id, statusInicial: params.fila.status, acao: 'resultado_incerto', motivo: 'digisac_message_id_ausente' }
  }

  await confirmarEnviado({
    supabase: params.supabase,
    fila: params.fila,
    workerId: params.workerId,
    messageId: envio.messageId,
    contactId: envio.contactId,
    ticketId: envio.ticketId ?? ticket.ticketId,
  })

  return {
    filaId: params.fila.id,
    leadId: lead.id,
    statusInicial: params.fila.status,
    acao: 'enviado',
    conexaoDestinoId: params.fila.conexao_destino_id,
    contato: contato.criado ? 'criado' : 'existente',
    ticket: 'transferido',
    versaoMensagem: mensagem.ordem,
    hashTexto: hash,
    textoMascarado: mascararTextoParaResposta(texto),
  }
}

async function simularFila(params: {
  supabase: SupabaseServiceClient
  fila: HubVendasFila
  config: ConfigHubVendas
  agora: Date
}): Promise<DetalheProcessamento> {
  const lead = await buscarLead(params.supabase, params.fila.lead_id)
  const mensagem = escolherMensagem(params.config.mensagens, params.fila)
  const texto = mensagem ? montarTextoMensagem(mensagem, params.fila) : null
  const contatoExistente = lead
    ? await buscarContatoResgatePorTelefone({
      telefoneNormalizadoDDI: lead.telefone_normalizado_ddi,
      serviceId: params.fila.conexao_destino_id,
    })
    : null
  const analise = lead ? await analisarReconciliacaoLead(lead, params.agora) : null

  return {
    filaId: params.fila.id,
    leadId: params.fila.lead_id,
    statusInicial: params.fila.status,
    acao: mensagem && lead && analise?.resultado === 'ignorado' ? 'enviaria' : 'bloqueado',
    motivo: !lead ? 'lead_nao_encontrado' : !mensagem ? 'sem_mensagem_ativa' : analise?.resultado ?? undefined,
    conexaoDestinoId: params.fila.conexao_destino_id,
    contato: contatoExistente ? 'existente' : 'nao_consultado',
    ticket: 'nao_consultado',
    versaoMensagem: mensagem?.ordem ?? null,
    hashTexto: texto ? hashTextoHubVendas(texto) : null,
    textoMascarado: texto ? mascararTextoParaResposta(texto) : null,
    programadoPara: params.fila.programado_para,
  }
}

function incrementar(resultado: ResultadoProcessamentoHubVendas, detalhe: DetalheProcessamento) {
  if (detalhe.acao === 'enviado') resultado.totalEnviado += 1
  if (detalhe.acao === 'cancelado') resultado.totalCancelado += 1
  if (detalhe.acao === 'resultado_incerto') resultado.totalResultadoIncerto += 1
  if (detalhe.acao === 'retry_agendado') resultado.totalRetryAgendado += 1
  if (detalhe.acao === 'erro') resultado.totalErro += 1
  if (detalhe.acao === 'analise_manual') resultado.totalAnaliseManual += 1
}

export async function processarFilaRecuperacaoHubVendas({
  supabase = createServiceClient(),
  limite = LIMITE_PADRAO,
  filaId,
  modoTeste = false,
  modoSimulacao = false,
  agora = new Date(),
  workerId = gerarWorkerId(),
}: {
  supabase?: SupabaseServiceClient
  limite?: number
  filaId?: string
  modoTeste?: boolean
  modoSimulacao?: boolean
  agora?: Date
  workerId?: string
} = {}): Promise<ResultadoProcessamentoHubVendas> {
  const limiteSeguro = Math.min(Math.max(Math.floor(limite), 1), LIMITE_MAXIMO)
  const config = await buscarConfig(supabase)
  const resultado: ResultadoProcessamentoHubVendas = {
    ok: true,
    automacaoAtiva: config.automacao.ativa,
    pausada: config.automacao.pausada,
    motivo: config.automacao.motivo,
    modoTeste,
    modoSimulacao,
    filaId: filaId ?? null,
    workerId,
    totalReservado: 0,
    totalEnviado: 0,
    totalCancelado: 0,
    totalResultadoIncerto: 0,
    totalRetryAgendado: 0,
    totalErro: 0,
    totalAnaliseManual: 0,
    detalhes: [],
  }

  if (filaId && !modoTeste) {
    resultado.ok = false
    resultado.motivo = 'modo_teste_obrigatorio_para_fila'
    return resultado
  }

  if (modoSimulacao && !modoTeste) {
    resultado.ok = false
    resultado.motivo = 'modo_teste_obrigatorio_para_simulacao'
    return resultado
  }

  if ((!config.automacao.ativa || config.automacao.pausada) && !modoTeste) {
    console.log('[HUB VENDAS ENVIO] automacao inativa ou pausada; processamento global bloqueado')
    return resultado
  }

  const filas = modoSimulacao
    ? await buscarFilasSimulacao(supabase, limiteSeguro, filaId)
    : await reservarFilas({ supabase, limite: limiteSeguro, workerId, modoTeste, filaId })

  resultado.totalReservado = modoSimulacao ? 0 : filas.length

  for (const fila of filas) {
    if (modoSimulacao) {
      const detalhe = await simularFila({ supabase, fila, config, agora })
      resultado.detalhes.push(detalhe)
      continue
    }

    try {
      console.log(`[HUB VENDAS ENVIO] fila reservada filaId=${fila.id} leadId=${fila.lead_id} conexao=${fila.conexao_destino_id}`)
      const detalhe = await processarFilaReservada({ supabase, fila, config, workerId, agora })
      resultado.detalhes.push(detalhe)
      incrementar(resultado, detalhe)
    } catch (error) {
      const erro = classificarErro(error)
      if (erro.resultadoIncerto) {
        await registrarResultadoIncerto(supabase, fila, workerId, erro.mensagem)
        const detalhe = { filaId: fila.id, leadId: fila.lead_id, statusInicial: fila.status, acao: 'resultado_incerto', motivo: erro.categoria }
        resultado.detalhes.push(detalhe)
        incrementar(resultado, detalhe)
        continue
      }

      await registrarErro(supabase, fila, workerId, erro)
      const acao = erro.retentavel && (fila.tentativas_envio ?? 0) < 3 ? 'retry_agendado' : 'erro'
      const detalhe = { filaId: fila.id, leadId: fila.lead_id, statusInicial: fila.status, acao, motivo: erro.categoria }
      resultado.detalhes.push(detalhe)
      incrementar(resultado, detalhe)
      console.error(`[HUB VENDAS ENVIO] erro filaId=${fila.id} categoria=${erro.categoria}`)
    }
  }

  return resultado
}
