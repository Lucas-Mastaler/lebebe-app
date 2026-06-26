import { createServiceClient } from '@/lib/supabase/service'
import type { ProcurarDatasCandidate, ProcurarDatasPreAgendamentoMeta } from '@/lib/procurar-datas/types'

export interface AuditoriaPreAgendamentoParams {
  // Identificadores
  pesquisaAuditoriaId?: string | null
  userId?: string | null | undefined
  userEmail: string
  clientToken?: string | null
  runId?: string | null
  
  // Dados do pré-agendamento
  dataPreAgendada?: string | null
  tipoResultado?: string | null
  resultadoEscolhido: ProcurarDatasCandidate
  payloadPreAgendamento: {
    cand: ProcurarDatasCandidate
    meta: ProcurarDatasPreAgendamentoMeta
  }
  
  // Resultado da operação
  status: 'success' | 'error'
  errorMessage?: string
  titulo?: string | null
  eventLink?: string | null
}

export interface AuditoriaPreAgendamentoResultado {
  id: string
  sucesso: boolean
  erro?: string
}

/**
 * Registra auditoria operacional de pré-agendamento na tabela procurar_datas_pre_agendamentos_auditoria
 * Não bloqueia o fluxo principal em caso de erro, apenas loga no console
 */
export async function registrarAuditoriaPreAgendamento(params: AuditoriaPreAgendamentoParams): Promise<AuditoriaPreAgendamentoResultado> {
  const {
    pesquisaAuditoriaId,
    userId,
    userEmail,
    clientToken,
    runId,
    dataPreAgendada,
    tipoResultado,
    resultadoEscolhido,
    payloadPreAgendamento,
    status,
    errorMessage,
    titulo,
    eventLink
  } = params

  console.log('[PROCURAR_DATAS][v2/auditoria-pre-agendamento] Iniciando gravação da auditoria', {
    pesquisaAuditoriaId,
    clientToken: clientToken ? clientToken.slice(0, 8) + '...' : null,
    runId,
    userEmail,
    dataPreAgendada,
    status
  })

  const supabase = createServiceClient()

  try {
    const insertData = {
      pesquisa_auditoria_id: pesquisaAuditoriaId || null,
      usuario_id: userId || null,
      usuario_email: userEmail,
      client_token: clientToken || null,
      run_id: runId || null,
      data_pre_agendada: dataPreAgendada ? new Date(dataPreAgendada) : null,
      tipo_resultado: tipoResultado || null,
      resultado_escolhido_json: resultadoEscolhido,
      payload_pre_agendamento_json: payloadPreAgendamento,
      status,
      erro_mensagem: errorMessage || null
    }

    const { data, error } = await supabase
      .from('procurar_datas_pre_agendamentos_auditoria')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error('[PROCURAR_DATAS][v2/auditoria-pre-agendamento] Erro ao gravar auditoria', {
        error: error.message,
        code: error.code,
        details: error.details,
        pesquisaAuditoriaId,
        clientToken: clientToken ? clientToken.slice(0, 8) + '...' : null,
        userEmail
      })
      
      return {
        id: '',
        sucesso: false,
        erro: error.message
      }
    }

    console.log('[PROCURAR_DATAS][v2/auditoria-pre-agendamento] Auditoria gravada com sucesso', {
      id: data.id,
      pesquisaAuditoriaId,
      clientToken: clientToken ? clientToken.slice(0, 8) + '...' : null,
      userEmail,
      titulo
    })

    return {
      id: data.id,
      sucesso: true
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[PROCURAR_DATAS][v2/auditoria-pre-agendamento] Erro inesperado ao gravar auditoria', {
      error: errorMessage,
      pesquisaAuditoriaId,
      clientToken: clientToken ? clientToken.slice(0, 8) + '...' : null,
      userEmail
    })

    return {
      id: '',
      sucesso: false,
      erro: errorMessage
    }
  }
}
