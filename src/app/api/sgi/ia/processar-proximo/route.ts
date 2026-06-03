import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import { montarTranscriptChamado } from '@/lib/ia/transcript'
import { analisarChamadoIA, analisarConsolidadoIA } from '@/lib/ia/deepseek-client'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  let body: { jobId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { jobId } = body
  if (!jobId) {
    return NextResponse.json({ error: 'jobId é obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()
  const supabaseAdmin = createServiceClient()

  // Busca job
  const { data: job, error: jobErr } = await supabase
    .from('ia_analise_comercial_fila')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
  }

  if (!['pendente', 'processando'].includes(job.status)) {
    return NextResponse.json({
      concluido: job.status === 'concluido',
      status: job.status,
      mensagem: `Job não está ativo (status: ${job.status})`,
    })
  }

  // Marca job como processando
  await supabaseAdmin
    .from('ia_analise_comercial_fila')
    .update({ status: 'processando', updated_at: new Date().toISOString() })
    .eq('id', jobId)

  // Busca próximo chamado pendente
  const { data: proximo, error: proximoErr } = await supabase
    .from('digisac_chamados_analise_ia')
    .select('id, digisac_ticket_id, numero_lancamento')
    .eq('fila_id', jobId)
    .eq('status', 'pendente')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (proximoErr) {
    return NextResponse.json({ error: 'Erro ao buscar próximo chamado' }, { status: 500 })
  }

  // Se não há pendente → verificar se podemos finalizar
  if (!proximo) {
    return await finalizarJob(jobId, job, supabase, supabaseAdmin)
  }

  const { id: registroId, digisac_ticket_id: ticketId, numero_lancamento: numeroLancamento } = proximo

  // Marca chamado como processando
  await supabaseAdmin
    .from('digisac_chamados_analise_ia')
    .update({ status: 'processando', updated_at: new Date().toISOString() })
    .eq('id', registroId)

  try {
    // Busca metadados do ticket
    const { data: conversa } = await supabase
      .from('digisac_conversas_resumo')
      .select('protocolo, comments, department_nome, user_nome, service_nome, cliente_nome_digisac')
      .eq('digisac_ticket_id', ticketId)
      .maybeSingle()

    const { data: vinculo } = await supabase
      .from('venda_conversa_vinculos')
      .select('ordem_conversa_para_venda, dias_antes_da_venda, inicio_chamado, data_conversa')
      .eq('numero_lancamento', numeroLancamento)
      .eq('digisac_ticket_id', ticketId)
      .maybeSingle()

    const { data: venda } = await supabase
      .from('sgi_documentos_saida')
      .select('cliente, data_fechamento')
      .eq('numero_lancamento', numeroLancamento)
      .maybeSingle()

    // Monta transcript via Digisac API
    const { transcript, truncado, totalMensagens } = await montarTranscriptChamado(ticketId)

    // Monta prompt
    const userPrompt = montarPromptChamado({
      numeroLancamento,
      clienteNome: venda?.cliente ?? conversa?.cliente_nome_digisac ?? 'Não informado',
      dataFechamento: venda?.data_fechamento ?? null,
      userName: conversa?.user_nome ?? 'Não informado',
      departmentNome: conversa?.department_nome ?? 'Não informado',
      serviceNome: conversa?.service_nome ?? 'Não informado',
      comments: conversa?.comments ?? '',
      diasAntes: vinculo?.dias_antes_da_venda ?? null,
      ordemCiclo: vinculo?.ordem_conversa_para_venda ?? null,
      inicioChamado: vinculo?.inicio_chamado ?? 'indefinido',
      transcript,
    })

    // Chama DeepSeek
    const resultado = await analisarChamadoIA(userPrompt)

    // Salva resultado
    await supabaseAdmin
      .from('digisac_chamados_analise_ia')
      .update({
        status: 'concluido',
        resumo_chamado: resultado.resumo_chamado,
        influencia_compra: resultado.influencia_compra,
        grau_influencia: resultado.grau_influencia,
        motivo_influencia: resultado.motivo_influencia,
        produtos_mencionados: resultado.produtos_mencionados,
        objecoes_identificadas: resultado.objecoes_identificadas,
        intencao_cliente: resultado.intencao_cliente,
        sentimento_cliente: resultado.sentimento_cliente,
        pontos_de_atencao: resultado.pontos_de_atencao,
        confianca_analise: resultado.confianca_analise,
        transcript_truncado: truncado,
        transcript_tamanho_chars: transcript.length,
        total_mensagens: totalMensagens,
        modelo_ia: resultado.modelo_ia,
        erro_mensagem: null,
        analisado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', registroId)

    // Incrementa progresso
    await supabaseAdmin
      .from('ia_analise_comercial_fila')
      .update({
        chamados_processados: job.chamados_processados + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    const processados = job.chamados_processados + 1
    const concluido = processados >= job.total_chamados

    return NextResponse.json({
      concluido,
      status: 'chamado_processado',
      chamadoProcessado: {
        ticketId,
        protocolo: conversa?.protocolo ?? null,
        influencia_compra: resultado.influencia_compra,
        grau_influencia: resultado.grau_influencia,
        resumo_chamado: resultado.resumo_chamado,
        transcript_truncado: truncado,
      },
      progresso: {
        total: job.total_chamados,
        processados,
        comErro: job.chamados_com_erro,
      },
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[ia/processar-proximo] erro no ticket ${ticketId}:`, err)

    // Registra erro no chamado mas continua
    await supabaseAdmin
      .from('digisac_chamados_analise_ia')
      .update({
        status: 'erro',
        erro_mensagem: errMsg,
        analisado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', registroId)

    // Incrementa erros e processados
    await supabaseAdmin
      .from('ia_analise_comercial_fila')
      .update({
        chamados_processados: job.chamados_processados + 1,
        chamados_com_erro: job.chamados_com_erro + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    const processados = job.chamados_processados + 1
    const concluido = processados >= job.total_chamados

    return NextResponse.json({
      concluido,
      status: 'chamado_com_erro',
      erroChamado: errMsg,
      progresso: {
        total: job.total_chamados,
        processados,
        comErro: job.chamados_com_erro + 1,
      },
    })
  }
}

// ── Finalização: gera consolidado e encerra job ────────────────

async function finalizarJob(
  jobId: string,
  job: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  supabaseAdmin: ReturnType<typeof createServiceClient>
) {
  const numeroLancamento = job.numero_lancamento as string

  // Busca todos os chamados concluídos
  const { data: analisados } = await supabase
    .from('digisac_chamados_analise_ia')
    .select(`
      digisac_ticket_id,
      resumo_chamado,
      influencia_compra,
      grau_influencia,
      motivo_influencia,
      produtos_mencionados,
      objecoes_identificadas,
      intencao_cliente,
      sentimento_cliente,
      pontos_de_atencao,
      confianca_analise,
      status
    `)
    .eq('fila_id', jobId)
    .eq('status', 'concluido')

  // Busca protocolos dos tickets para enriquecer o consolidado
  const ticketIds = (analisados ?? []).map((a) => a.digisac_ticket_id)
  let protocoloMap: Record<string, string | null> = {}
  if (ticketIds.length > 0) {
    const { data: conversas } = await supabase
      .from('digisac_conversas_resumo')
      .select('digisac_ticket_id, protocolo')
      .in('digisac_ticket_id', ticketIds)
    for (const c of (conversas ?? [])) {
      protocoloMap[c.digisac_ticket_id] = c.protocolo
    }
  }

  try {
    const consolidadoPrompt = montarPromptConsolidado(
      numeroLancamento,
      analisados ?? [],
      protocoloMap
    )

    const consolidado = await analisarConsolidadoIA(consolidadoPrompt)

    const { data: venda } = await supabase
      .from('sgi_documentos_saida')
      .select('id')
      .eq('numero_lancamento', numeroLancamento)
      .maybeSingle()

    await supabaseAdmin
      .from('venda_analise_comercial_ia')
      .upsert({
        numero_lancamento: numeroLancamento,
        documento_saida_id: venda?.id ?? null,
        fila_id: jobId,
        resumo_geral: consolidado.resumo_geral,
        chamados_que_influenciaram: consolidado.chamados_que_influenciaram,
        chamados_sem_influencia: consolidado.chamados_sem_influencia,
        principais_motivos_compra: consolidado.principais_motivos_compra,
        principais_objecoes: consolidado.principais_objecoes,
        produtos_de_interesse: consolidado.produtos_de_interesse,
        oportunidades_melhoria: consolidado.oportunidades_melhoria,
        conclusao_comercial: consolidado.conclusao_comercial,
        total_chamados_analisados: (analisados ?? []).length,
        modelo_ia: consolidado.modelo_ia,
        gerado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'numero_lancamento' })
  } catch (err) {
    console.error('[ia/processar-proximo] erro ao gerar consolidado:', err)
  }

  // Finaliza job
  await supabaseAdmin
    .from('ia_analise_comercial_fila')
    .update({
      status: 'concluido',
      finalizado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  return NextResponse.json({
    concluido: true,
    status: 'concluido',
    progresso: {
      total: job.total_chamados as number,
      processados: job.chamados_processados as number,
      comErro: job.chamados_com_erro as number,
    },
  })
}

// ── Montagem de prompts ────────────────────────────────────────

interface PromptChamadoParams {
  numeroLancamento: string
  clienteNome: string
  dataFechamento: string | null
  userName: string
  departmentNome: string
  serviceNome: string
  comments: string
  diasAntes: number | null
  ordemCiclo: number | null
  inicioChamado: string
  transcript: string
}

function montarPromptChamado(p: PromptChamadoParams): string {
  const dataVenda = p.dataFechamento
    ? new Date(p.dataFechamento).toLocaleDateString('pt-BR')
    : 'Não informada'

  const tipoInicio = p.inicioChamado === 'ativo'
    ? 'ativo (loja abordou o cliente primeiro)'
    : p.inicioChamado === 'receptivo'
    ? 'receptivo (cliente iniciou o contato)'
    : 'indefinido'

  return `## Contexto da venda
- Nº lançamento: ${p.numeroLancamento}
- Cliente: ${p.clienteNome}
- Data da venda: ${dataVenda}
- Consultora: ${p.userName}
- Departamento: ${p.departmentNome}
- Canal: ${p.serviceNome}
- Anotação da consultora: ${p.comments || '(sem anotação)'}
- Dias antes da venda: ${p.diasAntes != null ? p.diasAntes : 'desconhecido'}
- Ordem no ciclo: ${p.ordemCiclo != null ? `${p.ordemCiclo}ª conversa` : 'desconhecida'}
- Tipo de início: ${tipoInicio}

## Conversa
${p.transcript || '(sem mensagens registradas)'}

## Retorne exatamente este JSON (sem markdown, sem texto fora do JSON):
{
  "resumo_chamado": "...",
  "influencia_compra": "Sim | Parcialmente | Não | Indefinido",
  "grau_influencia": "Alto | Médio | Baixo | Nenhum",
  "motivo_influencia": "...",
  "produtos_mencionados": ["..."],
  "objecoes_identificadas": ["..."],
  "intencao_cliente": "Alta | Média | Baixa | Indefinida",
  "sentimento_cliente": "Positivo | Neutro | Negativo | Indefinido",
  "pontos_de_atencao": ["..."],
  "confianca_analise": "Alta | Média | Baixa"
}`
}

function montarPromptConsolidado(
  numeroLancamento: string,
  analisados: Record<string, unknown>[],
  protocoloMap: Record<string, string | null>
): string {
  const resumos = analisados.map((a, i) => {
    const protocolo = protocoloMap[a.digisac_ticket_id as string] ?? 'sem protocolo'
    return `### Chamado ${i + 1} (protocolo: ${protocolo})
- Influência: ${a.influencia_compra}
- Grau: ${a.grau_influencia}
- Motivo: ${a.motivo_influencia}
- Resumo: ${a.resumo_chamado}
- Intenção do cliente: ${a.intencao_cliente}
- Sentimento: ${a.sentimento_cliente}
- Produtos mencionados: ${JSON.stringify(a.produtos_mencionados)}
- Objeções: ${JSON.stringify(a.objecoes_identificadas)}
- Pontos de atenção: ${JSON.stringify(a.pontos_de_atencao)}`
  }).join('\n\n')

  return `## Análise consolidada da venda ${numeroLancamento}

Total de chamados analisados: ${analisados.length}

${resumos}

## Retorne exatamente este JSON (sem markdown, sem texto fora do JSON):
{
  "resumo_geral": "...",
  "chamados_que_influenciaram": [{ "ticket_id": "...", "protocolo": "...", "resumo": "..." }],
  "chamados_sem_influencia": [{ "ticket_id": "...", "protocolo": "...", "resumo": "..." }],
  "principais_motivos_compra": ["..."],
  "principais_objecoes": ["..."],
  "produtos_de_interesse": ["..."],
  "oportunidades_melhoria": ["..."],
  "conclusao_comercial": "..."
}`
}
