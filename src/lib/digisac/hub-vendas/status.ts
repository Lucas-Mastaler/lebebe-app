import { createServiceClient } from '@/lib/supabase/service'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>

type ConfigRow = {
  chave: string
  valor: unknown
}

type StatusCountRow = {
  status: string
  total: number
}

type UltimoProcessamentoRow = {
  updated_at: string | null
}

export type StatusHubVendas = {
  ok: true
  automacao: {
    ativa: boolean
    pausada: boolean
    motivo: string | null
  }
  filas: {
    agendada: number
    reservada: number
    enviando: number
    enviadaHoje: number
    resultadoIncerto: number
    analiseManual: number
    erro: number
    cancelada: number
  }
  conexoes: {
    pausadas: number
    errosConsecutivos: Record<string, number>
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

function mapearContadores(rows: StatusCountRow[]) {
  const map = new Map(rows.map((row) => [row.status, Number(row.total) || 0]))
  return {
    agendada: map.get('agendado') ?? 0,
    reservada: map.get('reservado') ?? 0,
    enviando: map.get('enviando') ?? 0,
    enviadaHoje: map.get('enviado_hoje') ?? 0,
    resultadoIncerto: map.get('resultado_incerto') ?? 0,
    analiseManual: map.get('analise_manual') ?? 0,
    erro: map.get('erro') ?? 0,
    cancelada: map.get('cancelado') ?? 0,
  }
}

function resumirPausas(pausas: unknown) {
  const record = asRecord(pausas)
  const errosConsecutivos: Record<string, number> = {}
  let pausadas = 0

  for (const [serviceId, value] of Object.entries(record)) {
    const config = asRecord(value)
    if (config.pausada === true) pausadas += 1
    errosConsecutivos[serviceId] = asNumber(config.erros_consecutivos, 0)
  }

  return { pausadas, errosConsecutivos }
}

export async function obterStatusHubVendas(
  supabase: SupabaseServiceClient = createServiceClient()
): Promise<StatusHubVendas> {
  const { data: configs, error: configError } = await supabase
    .from('hub_vendas_config')
    .select('chave, valor')
    .in('chave', ['automacao', 'parametros', 'pausas_conexoes'])
  if (configError) throw configError

  const configMap = new Map((configs ?? []).map((row: ConfigRow) => [row.chave, row.valor]))
  const automacao = asRecord(configMap.get('automacao'))
  const parametros = asRecord(configMap.get('parametros'))
  const pausas = resumirPausas(configMap.get('pausas_conexoes'))

  const { data: counts, error: countsError } = await supabase.rpc('hub_vendas_status_contadores')
  if (countsError) throw countsError

  const { data: ultimo, error: ultimoError } = await supabase
    .from('hub_vendas_recuperacao_fila')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (ultimoError) throw ultimoError

  return {
    ok: true,
    automacao: {
      ativa: asBoolean(automacao.ativa, false),
      pausada: asBoolean(automacao.pausada, true),
      motivo: asString(automacao.motivo),
    },
    filas: mapearContadores((counts ?? []) as StatusCountRow[]),
    conexoes: pausas,
    parametros: {
      limiteDiarioPorConexao: asNumber(parametros.limite_diario_por_conexao ?? parametros.limite_diario, 15),
      limitePorExecucao: asNumber(parametros.limite_por_execucao, 1),
      modoAtivacaoGradual: asBoolean(parametros.modo_ativacao_gradual, true),
      reservaTimeoutMinutos: asNumber(parametros.reserva_timeout_minutos, 10),
      envioTimeoutMinutos: asNumber(parametros.envio_timeout_minutos, 15),
      timezone: asString(parametros.timezone) ?? 'America/Sao_Paulo',
    },
    ultimoProcessamento: ((ultimo ?? []) as UltimoProcessamentoRow[])[0]?.updated_at ?? null,
  }
}
