import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import type { CandidatoFinal } from '@/lib/procurar-datas/contratos'

export interface AuditoriaSearchV2Params {
  runId: string
  clientToken: string
  userEmail: string | null | undefined
  cep: string | null | undefined
  enderecoCompleto: string | null | undefined
  tempoNecessario: string | null | undefined
  isRural: boolean
  isCondominio: boolean
  startedAt: string
  finishedAtMs: number
  inicioMs: number
  status: 'success' | 'error'
  errorMessage?: string
  candidates?: CandidatoFinal[]
  searchTimeSeconds?: string
}

export function gerarRunId(): string {
  return randomUUID()
}

function contarPorTipo(candidates: CandidatoFinal[]) {
  let normal = 0
  let especial = 0
  let premium = 0
  let horaMarcada = 0
  for (const c of candidates) {
    const t = String(c.tipo ?? '').toLowerCase()
    if (t === 'normal') normal++
    else if (t === 'especial') especial++
    else if (t === 'premium') premium++
    else if (t === 'hora-marcada' || t === 'hora marcada') horaMarcada++
  }
  return { normal, especial, premium, horaMarcada }
}

export async function registrarAuditoriaSearchV2(params: AuditoriaSearchV2Params): Promise<void> {
  const {
    runId,
    clientToken,
    userEmail,
    cep,
    enderecoCompleto,
    tempoNecessario,
    isRural,
    isCondominio,
    startedAt,
    finishedAtMs,
    inicioMs,
    status,
    errorMessage,
    candidates = [],
    searchTimeSeconds,
  } = params

  const totalDurationMs = finishedAtMs - inicioMs
  const { normal, especial, premium, horaMarcada } = contarPorTipo(candidates)
  const totalCandidates = candidates.length

  const searchTimeSec =
    searchTimeSeconds != null
      ? parseFloat(searchTimeSeconds) || null
      : totalDurationMs > 0
        ? parseFloat((totalDurationMs / 1000).toFixed(1))
        : null

  const supabase = createServiceClient()

  const { error } = await supabase.from('search_execution_audit').insert({
    client_token: clientToken,
    origin: 'MODAL',
    user_email: userEmail ?? null,
    cep: cep ?? null,
    endereco_pesquisado: enderecoCompleto ? enderecoCompleto.slice(0, 500) : null,
    tempo_necessario: tempoNecessario ?? null,
    is_rural: isRural,
    is_condominio: isCondominio,
    total_duration_ms: totalDurationMs,
    search_time_seconds: searchTimeSec,
    total_candidates: totalCandidates,
    total_candidates_normal: normal,
    total_candidates_especial: especial,
    total_candidates_premium: premium,
    total_candidates_hora_marcada: horaMarcada,
    total_slots_processed: 0,
    total_slots_available: 0,
    early_stop: false,
    status,
    error_message: errorMessage ? errorMessage.slice(0, 500) : null,
    started_at: startedAt,
    finished_at: new Date(finishedAtMs).toISOString(),
    motor: 'v2',
    rota: 'pesquisar-compat-async',
    tipo_execucao: 'producao',
    run_id: runId,
  })

  if (error) {
    console.error('[PROCURAR_DATAS][v2/auditoria-search] erro ao registrar auditoria', error.message)
  }
}
