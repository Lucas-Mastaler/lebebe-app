import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Registra atividade de conferência e retoma o timer se necessário
 * Deve ser chamada sempre que houver uma ação de conferência (volume, local, divergência)
 */
export async function registrarAtividadeConferencia(
  supabase: SupabaseClient,
  recebimentoId: string
) {
  const now = new Date().toISOString()

  // Get current timer state
  const { data: rec } = await supabase
    .from('recebimentos')
    .select('timer_rodando, timer_segundos_totais, timer_ultima_acao, ultima_atividade_conferencia')
    .eq('id', recebimentoId)
    .single()

  if (!rec) return

  const updateData: Record<string, unknown> = {
    ultima_atividade_conferencia: now
  }

  // Timer MUST always be running during conference actions
  // If timer is not running, start it automatically
  if (!rec.timer_rodando) {
    updateData.timer_rodando = true
    updateData.timer_ultima_acao = now
    console.log(`[LOG] Timer iniciado/retomado automaticamente por ação de conferência no recebimento ${recebimentoId}`)
  }

  await supabase
    .from('recebimentos')
    .update(updateData)
    .eq('id', recebimentoId)
}

/**
 * Verifica e pausa o timer se houver inatividade de 5+ minutos
 * Deve ser chamada periodicamente (ex: a cada minuto)
 */
export async function verificarInatividade(
  supabase: SupabaseClient,
  recebimentoId: string
) {
  const { data: rec } = await supabase
    .from('recebimentos')
    .select('timer_rodando, timer_segundos_totais, timer_ultima_acao, ultima_atividade_conferencia')
    .eq('id', recebimentoId)
    .single()

  if (!rec || !rec.timer_rodando) return false

  // Use ultima_atividade_conferencia ou fallback para timer_ultima_acao
  const lastActivityTime = rec.ultima_atividade_conferencia || rec.timer_ultima_acao
  if (!lastActivityTime) return false

  const lastActivity = new Date(lastActivityTime)
  const now = new Date()
  const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / 1000 / 60

  // Log para debug
  console.log(`[LOG][TIMER] Verificando inatividade: ${minutesSinceActivity.toFixed(1)} min desde última atividade (timer_rodando: ${rec.timer_rodando})`)

  // If 5+ minutes of inactivity, pause timer
  if (minutesSinceActivity >= 5) {
    // Calculate accumulated time
    const lastAction = new Date(rec.timer_ultima_acao || now)
    const elapsed = Math.floor((now.getTime() - lastAction.getTime()) / 1000)
    const newTotal = (rec.timer_segundos_totais || 0) + elapsed

    await supabase
      .from('recebimentos')
      .update({
        timer_rodando: false,
        timer_segundos_totais: newTotal,
        timer_ultima_acao: now.toISOString()
      })
      .eq('id', recebimentoId)

    console.log(`[LOG] Timer pausado automaticamente por inatividade no recebimento ${recebimentoId}`)
    return true
  }

  return false
}
