import { createServiceClient } from '@/lib/supabase/service'
import { alertarEnvioTravado, alertarReservaLiberada } from './alertas'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>

type HubVendasConfigRow = {
  chave: string
  valor: unknown
}

type ConfigAutomacao = {
  ativa: boolean
  pausada: boolean
  motivo: string | null
}

type ConfigParametrosManutencao = {
  reserva_timeout_minutos: number
  envio_timeout_minutos: number
}

type LinhaRecuperacao = {
  fila_id: string
  lead_id: string
  status_anterior: string
  status_novo: string
  acao: string
  motivo: string
  conexao_destino_id: string | null
}

export type DetalheRecuperacaoHubVendas = {
  filaId: string
  leadId: string
  statusAnterior: string
  statusNovo: string
  acao: string
  motivo: string
  conexaoDestinoId: string | null
}

export type ResultadoRecuperacaoHubVendas = {
  ok: boolean
  automacaoAtiva: boolean
  pausada: boolean
  motivo: string | null
  modoSimulacao: boolean
  workerId: string
  reservaTimeoutMinutos: number
  envioTimeoutMinutos: number
  totalAnalisado: number
  totalReservasLiberadas: number
  totalResultadoIncerto: number
  totalEnviadoReconciliado: number
  detalhes: DetalheRecuperacaoHubVendas[]
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

function lerParametros(valor: unknown): ConfigParametrosManutencao {
  const record = asRecord(valor)
  return {
    reserva_timeout_minutos: asNumber(record.reserva_timeout_minutos, 10),
    envio_timeout_minutos: asNumber(record.envio_timeout_minutos, 15),
  }
}

function gerarWorkerId(): string {
  return `hub-vendas-recuperacao-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function buscarConfig(supabase: SupabaseServiceClient) {
  const { data, error } = await supabase
    .from('hub_vendas_config')
    .select('chave, valor')
    .in('chave', ['automacao', 'parametros'])

  if (error) throw error
  const configs = new Map((data ?? []).map((row: HubVendasConfigRow) => [row.chave, row.valor]))
  return {
    automacao: lerAutomacao(configs.get('automacao')),
    parametros: lerParametros(configs.get('parametros')),
  }
}

function mapearLinha(row: LinhaRecuperacao): DetalheRecuperacaoHubVendas {
  return {
    filaId: row.fila_id,
    leadId: row.lead_id,
    statusAnterior: row.status_anterior,
    statusNovo: row.status_novo,
    acao: row.acao,
    motivo: row.motivo,
    conexaoDestinoId: row.conexao_destino_id,
  }
}

export async function recuperarFilasAbandonadasHubVendas({
  supabase = createServiceClient(),
  modoSimulacao = false,
  limite = 10,
  workerId = gerarWorkerId(),
}: {
  supabase?: SupabaseServiceClient
  modoSimulacao?: boolean
  limite?: number
  workerId?: string
} = {}): Promise<ResultadoRecuperacaoHubVendas> {
  const config = await buscarConfig(supabase)
  const limiteSeguro = Math.min(Math.max(Math.floor(limite), 1), 50)
  const { data, error } = await supabase.rpc('hub_vendas_recuperar_filas_abandonadas', {
    p_worker: workerId,
    p_reserva_timeout_minutos: config.parametros.reserva_timeout_minutos,
    p_envio_timeout_minutos: config.parametros.envio_timeout_minutos,
    p_limite: limiteSeguro,
    p_modo_simulacao: modoSimulacao,
  })

  if (error) throw error
  const detalhes = ((Array.isArray(data) ? data : data ? [data] : []) as LinhaRecuperacao[]).map(mapearLinha)

  for (const detalhe of detalhes) {
    if (detalhe.acao === 'reserva_liberada') {
      console.warn(
        `[HUB VENDAS RECUPERACAO] reserva liberada filaId=${detalhe.filaId} leadId=${detalhe.leadId} conexao=${detalhe.conexaoDestinoId ?? 'n/a'} motivo=${detalhe.motivo}`
      )
      await alertarReservaLiberada({
        supabase,
        filaId: detalhe.filaId,
        serviceId: detalhe.conexaoDestinoId,
        motivo: detalhe.motivo,
      })
    }
    if (detalhe.acao === 'movido_resultado_incerto') {
      console.error(
        `[HUB VENDAS RECUPERACAO] envio movido para resultado_incerto filaId=${detalhe.filaId} leadId=${detalhe.leadId} conexao=${detalhe.conexaoDestinoId ?? 'n/a'} motivo=${detalhe.motivo}`
      )
      await alertarEnvioTravado({
        supabase,
        filaId: detalhe.filaId,
        serviceId: detalhe.conexaoDestinoId,
        motivo: detalhe.motivo,
      })
    }
  }

  const totalReservasLiberadas = detalhes.filter((detalhe) => detalhe.acao === 'reserva_liberada').length
  const totalResultadoIncerto = detalhes.filter((detalhe) => detalhe.acao === 'movido_resultado_incerto').length
  const totalEnviadoReconciliado = detalhes.filter((detalhe) => detalhe.acao === 'reconciliado_enviado').length
  if (totalResultadoIncerto > 0) {
    console.error(`[HUB VENDAS ALERTA] resultado_incerto total=${totalResultadoIncerto}`)
  }
  if (totalReservasLiberadas > 1) {
    console.warn(`[HUB VENDAS ALERTA] mais de uma recuperacao abandonada total=${totalReservasLiberadas}`)
  }

  return {
    ok: true,
    automacaoAtiva: config.automacao.ativa,
    pausada: config.automacao.pausada,
    motivo: config.automacao.motivo,
    modoSimulacao,
    workerId,
    reservaTimeoutMinutos: config.parametros.reserva_timeout_minutos,
    envioTimeoutMinutos: config.parametros.envio_timeout_minutos,
    totalAnalisado: detalhes.length,
    totalReservasLiberadas,
    totalResultadoIncerto,
    totalEnviadoReconciliado,
    detalhes,
  }
}
