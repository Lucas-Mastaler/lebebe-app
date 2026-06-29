import { createServiceClient } from '@/lib/supabase/service'
import type { TipoJanelaPerfil } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Types públicos
// ---------------------------------------------------------------------------

export type TipoJanelaAtual = 'seg_sex' | 'sabado' | 'domingo'

export type JanelaAplicada = {
  origem: 'perfil'
  id: string
  horaInicio: string
  horaFim: string
  timezone: string
}

export type AccessWindowCheckResult =
  | {
      ok: true
      permitido: true
      motivo: 'superadmin' | 'dentro_da_janela'
      tipoJanelaAtual: TipoJanelaAtual
      agoraLocal: string
      janelaAplicada: JanelaAplicada | null
    }
  | {
      ok: false
      permitido: false
      motivo: 'sem_perfil' | 'sem_janela_ativa' | 'fora_da_janela' | 'usuario_invalido'
      tipoJanelaAtual: TipoJanelaAtual
      agoraLocal: string
      janelaAplicada: JanelaAplicada | null
    }

// ---------------------------------------------------------------------------
// Helpers de data/hora em America/Sao_Paulo
// ---------------------------------------------------------------------------

const TIMEZONE_PADRAO = 'America/Sao_Paulo'

/**
 * Retorna o tipo do dia atual (seg_sex | sabado | domingo) em America/Sao_Paulo.
 * Usa Intl.DateTimeFormat para não depender do timezone do servidor.
 */
export function getTipoJanelaAtual(now: Date = new Date()): TipoJanelaAtual {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_PADRAO,
    weekday: 'short',
  })
  const diaSemana = fmt.format(now) // 'Mon', 'Tue', ..., 'Sat', 'Sun'

  if (diaSemana === 'Sat') return 'sabado'
  if (diaSemana === 'Sun') return 'domingo'
  return 'seg_sex'
}

/**
 * Retorna hora atual em format HH:MM:SS em America/Sao_Paulo.
 * Estável para comparação com hora_inicio/hora_fim do banco (time without time zone).
 */
export function getHoraLocalString(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_PADRAO,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
  const s = parts.find((p) => p.type === 'second')?.value ?? '00'
  return `${h}:${m}:${s}`
}

/**
 * Retorna string legível da data/hora local: "YYYY-MM-DD HH:MM:SS BRT"
 */
export function getAgoraLocalString(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE_PADRAO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  return fmt.format(now) + ' BRT'
}

/**
 * Compara HH:MM:SS strings.
 * Retorna true se horaAtual >= horaInicio e horaAtual < horaFim (intervalo inclusivo/exclusivo).
 */
function dentroDoIntervalo(horaAtual: string, horaInicio: string, horaFim: string): boolean {
  return horaAtual >= horaInicio && horaAtual < horaFim
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Avalia se um usuário está dentro da janela de horário permitida.
 *
 * Regras:
 * - Superadmin: sempre permitido, ignora janela (motivo: 'superadmin').
 * - Usuário sem perfil ativo: bloqueado (motivo: 'sem_perfil').
 * - Sem janela ativa para o tipo do dia: bloqueado (motivo: 'sem_janela_ativa').
 * - Fora do intervalo da janela: bloqueado (motivo: 'fora_da_janela').
 * - Dentro do intervalo: permitido (motivo: 'dentro_da_janela').
 *
 * NOTA: Janelas individuais por usuário (app_janelas_acesso_usuario) NÃO são avaliadas
 * nesta fase. A tabela está modelada mas sem linhas em uso e sem regra de precedência
 * definida. Ver pendência em docs/ia/log_progress.md.
 *
 * @param params.usuarioId  ID do usuário em usuarios_permitidos
 * @param params.role       Role do usuário ('user' | 'superadmin')
 * @param params.now        Momento a avaliar (útil para diagnóstico; padrão: Date.now())
 */
export async function checkAccessWindowForUser(params: {
  usuarioId: string
  role: 'user' | 'superadmin'
  now?: Date
}): Promise<AccessWindowCheckResult> {
  const now = params.now ?? new Date()
  const tipoJanelaAtual = getTipoJanelaAtual(now)
  const agoraLocal = getAgoraLocalString(now)

  // 1. Superadmin ignora janela de horário
  if (params.role === 'superadmin') {
    return {
      ok: true,
      permitido: true,
      motivo: 'superadmin',
      tipoJanelaAtual,
      agoraLocal,
      janelaAplicada: null,
    }
  }

  const supabaseAdmin = createServiceClient()

  // 2. Buscar perfil ativo do usuário
  const { data: perfilRow, error: perfilError } = await supabaseAdmin
    .from('app_usuarios_perfis')
    .select('perfil_id, app_perfis_acesso!inner(id, chave, nome, ativo)')
    .eq('usuario_id', params.usuarioId)
    .single()

  if (perfilError || !perfilRow) {
    return {
      ok: false,
      permitido: false,
      motivo: 'sem_perfil',
      tipoJanelaAtual,
      agoraLocal,
      janelaAplicada: null,
    }
  }

  type PerfilInfo = { id: string; chave: string; nome: string; ativo: boolean }
  const perfilInfo = (perfilRow as unknown as { perfil_id: string; app_perfis_acesso: PerfilInfo }).app_perfis_acesso
  const perfilAtivo = perfilInfo?.ativo === true ? perfilInfo : null

  if (!perfilAtivo) {
    return {
      ok: false,
      permitido: false,
      motivo: 'sem_perfil',
      tipoJanelaAtual,
      agoraLocal,
      janelaAplicada: null,
    }
  }

  // 3. Buscar janela do perfil para o tipo do dia atual
  const { data: janelaRow, error: janelaError } = await supabaseAdmin
    .from('app_janelas_acesso_perfil')
    .select('id, tipo, ativo, hora_inicio, hora_fim, timezone')
    .eq('perfil_id', perfilAtivo.id)
    .eq('tipo', tipoJanelaAtual as TipoJanelaPerfil)
    .maybeSingle()

  if (janelaError) {
    console.error('[ACCESS WINDOW] Erro ao buscar janela do perfil:', janelaError)
    return {
      ok: false,
      permitido: false,
      motivo: 'sem_janela_ativa',
      tipoJanelaAtual,
      agoraLocal,
      janelaAplicada: null,
    }
  }

  // Sem linha ou linha inativa → sem janela ativa para este tipo de dia
  if (!janelaRow || !janelaRow.ativo || !janelaRow.hora_inicio || !janelaRow.hora_fim) {
    return {
      ok: false,
      permitido: false,
      motivo: 'sem_janela_ativa',
      tipoJanelaAtual,
      agoraLocal,
      janelaAplicada: null,
    }
  }

  const janelaAplicada: JanelaAplicada = {
    origem: 'perfil',
    id: janelaRow.id,
    horaInicio: janelaRow.hora_inicio,
    horaFim: janelaRow.hora_fim,
    timezone: janelaRow.timezone ?? TIMEZONE_PADRAO,
  }

  // 4. Verificar se está dentro do intervalo
  const horaAtual = getHoraLocalString(now)
  const dentro = dentroDoIntervalo(horaAtual, janelaRow.hora_inicio, janelaRow.hora_fim)

  if (dentro) {
    return {
      ok: true,
      permitido: true,
      motivo: 'dentro_da_janela',
      tipoJanelaAtual,
      agoraLocal,
      janelaAplicada,
    }
  }

  return {
    ok: false,
    permitido: false,
    motivo: 'fora_da_janela',
    tipoJanelaAtual,
    agoraLocal,
    janelaAplicada,
  }
}
