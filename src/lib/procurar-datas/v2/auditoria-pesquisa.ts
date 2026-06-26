import { createServiceClient } from '@/lib/supabase/service'
import type { CandidatoFinal } from '@/lib/procurar-datas/contratos'

export interface AuditoriaPesquisaParams {
  // Identificadores
  runId: string
  clientToken: string
  userId?: string | null | undefined
  userEmail: string
  
  // Endereço estruturado
  cep?: string | null
  numero?: string | null
  logradouro?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  enderecoCompleto?: string | null
  latitude?: number | null
  longitude?: number | null
  
  // Parâmetros da tela
  parametros: {
    dataInicial?: string
    encomenda?: boolean
    areaRural?: boolean
    condominio?: boolean
    bercoCama?: string
    comoda?: string
    roupeiro?: string
    poltrona?: string
    painel?: string
    tempoNecessario?: string
    valorInicialMinimo?: number
  }
  
  // Resultados exibidos
  resultados?: CandidatoFinal[]
  
  // Status e performance
  status: 'success' | 'error'
  errorMessage?: string
  duracaoMs?: number
  startedAt?: string
  finishedAt?: string
}

export interface AuditoriaPesquisaResultado {
  id: string
  sucesso: boolean
  erro?: string
}

/**
 * Registra auditoria operacional de pesquisa na tabela procurar_datas_pesquisas_auditoria
 * Não bloqueia o fluxo principal em caso de erro, apenas loga no console
 */
export async function registrarAuditoriaPesquisa(params: AuditoriaPesquisaParams): Promise<AuditoriaPesquisaResultado> {
  const {
    runId,
    clientToken,
    userId,
    userEmail,
    cep,
    numero,
    logradouro,
    bairro,
    cidade,
    uf,
    enderecoCompleto,
    latitude,
    longitude,
    parametros,
    resultados,
    status,
    errorMessage,
    duracaoMs,
    startedAt,
    finishedAt
  } = params

  console.log('[PROCURAR_DATAS][v2/auditoria-pesquisa] Iniciando gravação da auditoria', {
    runId,
    clientToken: clientToken.slice(0, 8) + '...',
    userEmail,
    status
  })

  const supabase = createServiceClient()

  try {
    const insertData = {
      usuario_id: userId || null,
      usuario_email: userEmail,
      client_token: clientToken || null,
      run_id: runId || null,
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: cep || null,
      numero_residencia: numero || null,
      logradouro: logradouro || null,
      bairro: bairro || null,
      cidade: cidade || null,
      uf: uf || null,
      endereco_completo: enderecoCompleto || null,
      latitude: latitude || null,
      longitude: longitude || null,
      parametros_json: parametros,
      resultados_json: resultados || null,
      status,
      erro_mensagem: errorMessage || null,
      duracao_ms: duracaoMs || null,
      started_at: startedAt || null,
      finished_at: finishedAt || null
    }

    const { data, error } = await supabase
      .from('procurar_datas_pesquisas_auditoria')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error('[PROCURAR_DATAS][v2/auditoria-pesquisa] Erro ao gravar auditoria', {
        error: error.message,
        code: error.code,
        details: error.details,
        runId,
        clientToken: clientToken.slice(0, 8) + '...',
        userEmail
      })
      
      return {
        id: '',
        sucesso: false,
        erro: error.message
      }
    }

    console.log('[PROCURAR_DATAS][v2/auditoria-pesquisa] Auditoria gravada com sucesso', {
      id: data.id,
      runId,
      clientToken: clientToken.slice(0, 8) + '...',
      userEmail
    })

    return {
      id: data.id,
      sucesso: true
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[PROCURAR_DATAS][v2/auditoria-pesquisa] Erro inesperado ao gravar auditoria', {
      error: errorMessage,
      runId,
      clientToken: clientToken.slice(0, 8) + '...',
      userEmail
    })

    return {
      id: '',
      sucesso: false,
      erro: errorMessage
    }
  }
}
