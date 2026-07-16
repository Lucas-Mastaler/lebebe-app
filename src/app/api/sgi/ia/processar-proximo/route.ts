import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import { montarTranscriptChamado } from '@/lib/ia/transcript'
import { extrairTrechosFatuais } from '@/lib/ia/extrair-trechos-fatuais'
import { analisarChamadoIA, analisarConsolidadoIA } from '@/lib/ia/deepseek-client'
import { buscarContextoVendasAnterioresIA, montarBlocoVendasAnterioresIA } from '@/lib/ia/contexto-vendas-anteriores'
import {
  buscarContextoChamadosAnterioresIA,
  calcularContextoTemporalChamado,
  montarBlocoChamadosAnterioresIA,
  montarBlocoTemporalChamadoIA,
} from '@/lib/ia/contexto-temporal-chamados'
import {
  buscarContextoComplementarContatoIA,
  montarContextoComplementarContato,
  montarResumoLogContextoContato,
} from '@/lib/ia/contexto-complementar-contato'

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
      .select('protocolo, comments, department_nome, user_nome, service_nome, service_id, digisac_contact_id, cliente_nome_digisac, telefone_normalizado, telefone_normalizado_ddi, started_at')
      .eq('digisac_ticket_id', ticketId)
      .maybeSingle()

    const { data: vinculo } = await supabase
      .from('venda_conversa_vinculos')
      .select('ordem_conversa_para_venda, dias_antes_da_venda, inicio_chamado, data_conversa, data_inicio_ciclo_venda, data_fim_ciclo_venda')
      .eq('numero_lancamento', numeroLancamento)
      .eq('digisac_ticket_id', ticketId)
      .maybeSingle()

    const { data: venda } = await supabase
      .from('sgi_documentos_saida')
      .select('id, cliente, data_fechamento, emissao_texto')
      .eq('numero_lancamento', numeroLancamento)
      .maybeSingle()

    // Busca produtos da venda para contextualizar o prompt
    const { data: produtosVenda } = await supabase
      .from('sgi_documentos_saida_produtos')
      .select('produto, departamento_classificado, subgrupo_classificado')
      .eq('numero_lancamento', numeroLancamento)

    // Monta transcript via Digisac API
    const { transcript, mensagens, truncado, totalMensagens, tamanhoOriginal } = await montarTranscriptChamado(ticketId)

    if (truncado) {
      console.log(`[IA][TRUNCADO] numero_lancamento=${numeroLancamento} protocolo=${conversa?.protocolo ?? 'sem_protocolo'} ticketId=${ticketId} tamanhoOriginal=${tamanhoOriginal} limite=22000 mensagens=${totalMensagens} estrategia=inicio_fim_20`)
    }

    const contextoHistorico = await buscarContextoVendasAnterioresIA(supabase, numeroLancamento)
    console.log(
      `[IA][CONTEXTO-HISTORICO] vendaAtual=${numeroLancamento} vendasAnteriores=${contextoHistorico.vendas.length} produtosHistoricos=${contextoHistorico.totalProdutosHistoricos} criterio=${contextoHistorico.criterioIdentificacao} limite=${contextoHistorico.limiteVendas}`
    )

    const contextoTemporal = calcularContextoTemporalChamado({
      dataFechamentoVenda: venda?.data_fechamento ?? null,
      emissaoVenda: venda?.emissao_texto ?? null,
      inicioChamado: conversa?.started_at ?? vinculo?.data_conversa ?? null,
      inicioCiclo: vinculo?.data_inicio_ciclo_venda ?? null,
      fimCiclo: vinculo?.data_fim_ciclo_venda ?? null,
      mensagens,
    })
    console.log(
      `[IA][CONTEXTO-TEMPORAL] vendaAtual=${numeroLancamento} ticket=${ticketId} mensagensAntes=${contextoTemporal.mensagensAntesFechamento} mensagensDepois=${contextoTemporal.mensagensDepoisFechamento} ultimaAntes=${contextoTemporal.ultimaMensagemAntesFechamento ? 'sim' : 'nao'}`
    )

    const contextoChamadosAnteriores = await buscarContextoChamadosAnterioresIA(supabase, numeroLancamento)
    console.log(
      `[IA][CHAMADOS-ANTERIORES] vendaAtual=${numeroLancamento} chamados=${contextoChamadosAnteriores.chamados.length} candidatos=${contextoChamadosAnteriores.totalCandidatosAntesLimite} limite=${contextoChamadosAnteriores.limiteChamados} tamanho=${contextoChamadosAnteriores.tamanhoContextoChars}`
    )

    const produtosListaContextoContato = (produtosVenda ?? []).map((p) => {
      const partes = [p.produto, p.departamento_classificado, p.subgrupo_classificado].filter(Boolean)
      return partes.join(' — ')
    })

    const contextoComplementarContato = await buscarContextoComplementarContatoIA({
      contactIds: [conversa?.digisac_contact_id],
      ticketIdsPrincipais: [ticketId],
      dataFechamentoVenda: venda?.data_fechamento ?? null,
      dataFechamentoVendaAnterior: contextoHistorico.vendas[0]?.dataFechamento ?? null,
      vendasAnteriores: contextoHistorico.vendas.map((v) => ({
        numeroLancamento: v.numeroLancamento,
        dataFechamento: v.dataFechamento,
        produtos: v.produtos,
      })),
      palavrasChaveProdutos: produtosListaContextoContato,
    })
    console.log(
      `[IA][CONTEXTO-90D] venda=${numeroLancamento} ${montarResumoLogContextoContato(contextoComplementarContato)}`
    )

    const produtosLista = (produtosVenda ?? []).map((p) => {
      const partes = [p.produto, p.departamento_classificado, p.subgrupo_classificado].filter(Boolean)
      return partes.join(' — ')
    })

    // Busca dados do bebê já conhecidos para contextualizar a IA
    let dadosBebeConhecidos = { nomeBebe: null as string | null, previsaoNascimento: null as string | null }
    if (conversa?.telefone_normalizado_ddi) {
      const { data: clienteBebe } = await supabase
        .from('inteligencia_comercial_clientes')
        .select('nome_bebe, previsao_nascimento_bebe')
        .eq('telefone_normalizado_ddi', conversa.telefone_normalizado_ddi)
        .maybeSingle()
      if (clienteBebe?.nome_bebe || clienteBebe?.previsao_nascimento_bebe) {
        dadosBebeConhecidos = {
          nomeBebe: clienteBebe.nome_bebe,
          previsaoNascimento: clienteBebe.previsao_nascimento_bebe,
        }
      }
    }

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
      produtosVenda: produtosLista,
      contextoTemporal: montarBlocoTemporalChamadoIA(contextoTemporal),
      contextoHistorico: montarBlocoVendasAnterioresIA(contextoHistorico),
      contextoChamadosAnteriores: montarBlocoChamadosAnterioresIA(contextoChamadosAnteriores),
      contextoComplementarContato: montarContextoComplementarContato(contextoComplementarContato),
      transcript,
      protocolo: conversa?.protocolo ?? null,
      dadosBebe: dadosBebeConhecidos,
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
        nome_bebe: resultado.nome_bebe,
        previsao_nascimento_bebe: resultado.previsao_nascimento_bebe,
        transcript_truncado: truncado,
        transcript_tamanho_chars: tamanhoOriginal,
        total_mensagens: totalMensagens,
        modelo_ia: resultado.modelo_ia,
        erro_mensagem: null,
        analisado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', registroId)

    // Salva dados do bebê no cadastro do cliente/telefone + cria observação comercial
    const temDadosBebe = resultado.nome_bebe || resultado.previsao_nascimento_bebe
    if (temDadosBebe && conversa?.telefone_normalizado_ddi) {
      await salvarDadosBebeCliente({
        telefoneDdi: conversa.telefone_normalizado_ddi,
        telefone: conversa.telefone_normalizado ?? null,
        clienteNome: venda?.cliente ?? conversa.cliente_nome_digisac ?? null,
        nomeBebe: resultado.nome_bebe,
        previsao: resultado.previsao_nascimento_bebe,
        numeroLancamento,
        ticketId,
        supabaseAdmin,
      })
    }

    if (temDadosBebe) {
      await criarObservacaoBebeIA({
        numeroLancamento,
        documentoSaidaId: venda?.id ?? null,
        clienteNome: venda?.cliente ?? conversa?.cliente_nome_digisac ?? null,
        protocolo: conversa?.protocolo ?? null,
        nomeBebe: resultado.nome_bebe,
        previsao: resultado.previsao_nascimento_bebe,
        supabaseAdmin,
      })
    }

    // Incrementa progresso
    const novosProcessados = job.chamados_processados + 1
    const novosErros = job.chamados_com_erro
    const finalizou = (novosProcessados + novosErros) >= job.total_chamados

    await supabaseAdmin
      .from('ia_analise_comercial_fila')
      .update({
        chamados_processados: novosProcessados,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (finalizou) {
      return await finalizarJob(jobId, { ...job, chamados_processados: novosProcessados, chamados_com_erro: novosErros }, supabase, supabaseAdmin)
    }

    return NextResponse.json({
      concluido: false,
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
        processados: novosProcessados,
        comErro: novosErros,
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
    const novosProcessadosErr = job.chamados_processados + 1
    const novosErrosErr = job.chamados_com_erro + 1
    const finalizouErr = (novosProcessadosErr + novosErrosErr) >= job.total_chamados

    await supabaseAdmin
      .from('ia_analise_comercial_fila')
      .update({
        chamados_processados: novosProcessadosErr,
        chamados_com_erro: novosErrosErr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (finalizouErr) {
      return await finalizarJob(jobId, { ...job, chamados_processados: novosProcessadosErr, chamados_com_erro: novosErrosErr }, supabase, supabaseAdmin)
    }

    return NextResponse.json({
      concluido: false,
      status: 'chamado_com_erro',
      erroChamado: errMsg,
      progresso: {
        total: job.total_chamados,
        processados: novosProcessadosErr,
        comErro: novosErrosErr,
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
      nome_bebe,
      previsao_nascimento_bebe,
      status,
      transcript_truncado
    `)
    .eq('fila_id', jobId)
    .eq('status', 'concluido')

  const chamadosAnalisados = (analisados ?? []).length
  const chamadosTruncados = (analisados ?? []).filter((a) => a.transcript_truncado === true).length
  console.log(`[IA][RESUMO-TRUNCAMENTO] numero_lancamento=${numeroLancamento} chamadosAnalisados=${chamadosAnalisados} chamadosTruncados=${chamadosTruncados}`)

  // Busca protocolos e ordem do ciclo para enriquecer o consolidado
  const ticketIds = (analisados ?? []).map((a) => a.digisac_ticket_id)
  const protocoloMap: Record<string, string | null> = {}
  const ordemMap: Record<string, number | null> = {}
  const dataConversaMap: Record<string, string | null> = {}
  const startedAtMap: Record<string, string | null> = {}
  const inicioCicloMap: Record<string, string | null> = {}
  const fimCicloMap: Record<string, string | null> = {}
  const contactIdMap: Record<string, string | null> = {}
  if (ticketIds.length > 0) {
    const { data: conversas } = await supabase
      .from('digisac_conversas_resumo')
      .select('digisac_ticket_id, protocolo, started_at, digisac_contact_id, service_id')
      .in('digisac_ticket_id', ticketIds)
    for (const c of (conversas ?? [])) {
      protocoloMap[c.digisac_ticket_id] = c.protocolo
      startedAtMap[c.digisac_ticket_id] = c.started_at ?? null
      contactIdMap[c.digisac_ticket_id] = c.digisac_contact_id ?? null
    }

    const { data: vinculos } = await supabase
      .from('venda_conversa_vinculos')
      .select('digisac_ticket_id, ordem_conversa_para_venda, data_conversa, data_inicio_ciclo_venda, data_fim_ciclo_venda')
      .eq('numero_lancamento', numeroLancamento)
      .in('digisac_ticket_id', ticketIds)
    for (const v of (vinculos ?? [])) {
      ordemMap[v.digisac_ticket_id] = v.ordem_conversa_para_venda ?? null
      dataConversaMap[v.digisac_ticket_id] = v.data_conversa ?? null
      inicioCicloMap[v.digisac_ticket_id] = v.data_inicio_ciclo_venda ?? null
      fimCicloMap[v.digisac_ticket_id] = v.data_fim_ciclo_venda ?? null
    }
  }

  const { data: vendaConsolidado } = await supabase
    .from('sgi_documentos_saida')
    .select('data_fechamento, emissao_texto')
    .eq('numero_lancamento', numeroLancamento)
    .maybeSingle()

  const dataFechamentoVenda = vendaConsolidado?.data_fechamento
    ? new Date(vendaConsolidado.data_fechamento).toLocaleDateString('pt-BR')
    : null

  // Rebusca transcripts para extrair trechos fatuais (datas, valores, prazo, link, pagamento)
  // que podem ter sido omitidos no resumo individual mas são necessários ao consolidado
  const transcriptFatuaisMap: Record<string, string[]> = {}
  const contextoTemporalMap: Record<string, string | null> = {}
  if (ticketIds.length > 0) {
    await Promise.all(
      ticketIds.map(async (ticketId) => {
        try {
          const { transcript, mensagens } = await montarTranscriptChamado(ticketId)
          transcriptFatuaisMap[ticketId] = extrairTrechosFatuais(transcript)
          contextoTemporalMap[ticketId] = montarBlocoTemporalChamadoIA(calcularContextoTemporalChamado({
            dataFechamentoVenda: vendaConsolidado?.data_fechamento ?? null,
            emissaoVenda: vendaConsolidado?.emissao_texto ?? null,
            inicioChamado: startedAtMap[ticketId] ?? dataConversaMap[ticketId] ?? null,
            inicioCiclo: inicioCicloMap[ticketId] ?? null,
            fimCiclo: fimCicloMap[ticketId] ?? null,
            mensagens,
          }))
        } catch {
          transcriptFatuaisMap[ticketId] = []
          contextoTemporalMap[ticketId] = null
        }
      })
    )
  }

  // Busca produtos comprados da venda para incluir no contexto do consolidado
  const { data: produtosVendaConsolidado } = await supabase
    .from('sgi_documentos_saida_produtos')
    .select('produto, departamento_classificado, subgrupo_classificado')
    .eq('numero_lancamento', numeroLancamento)

  const contextoHistorico = await buscarContextoVendasAnterioresIA(supabase, numeroLancamento)
  console.log(
    `[IA][CONTEXTO-HISTORICO] vendaAtual=${numeroLancamento} vendasAnteriores=${contextoHistorico.vendas.length} produtosHistoricos=${contextoHistorico.totalProdutosHistoricos} criterio=${contextoHistorico.criterioIdentificacao} limite=${contextoHistorico.limiteVendas}`
  )

  const contextoChamadosAnteriores = await buscarContextoChamadosAnterioresIA(supabase, numeroLancamento)
  console.log(
    `[IA][CHAMADOS-ANTERIORES] vendaAtual=${numeroLancamento} chamados=${contextoChamadosAnteriores.chamados.length} candidatos=${contextoChamadosAnteriores.totalCandidatosAntesLimite} limite=${contextoChamadosAnteriores.limiteChamados} tamanho=${contextoChamadosAnteriores.tamanhoContextoChars}`
  )

  const contextoComplementarContato = await buscarContextoComplementarContatoIA({
    contactIds: ticketIds.map((id) => contactIdMap[id]),
    ticketIdsPrincipais: ticketIds,
    dataFechamentoVenda: vendaConsolidado?.data_fechamento ?? null,
    dataFechamentoVendaAnterior: contextoHistorico.vendas[0]?.dataFechamento ?? null,
    vendasAnteriores: contextoHistorico.vendas.map((v) => ({
      numeroLancamento: v.numeroLancamento,
      dataFechamento: v.dataFechamento,
      produtos: v.produtos,
    })),
    palavrasChaveProdutos: (produtosVendaConsolidado ?? []).map((p) => {
      const partes = [p.produto, p.departamento_classificado, p.subgrupo_classificado].filter(Boolean)
      return partes.join(' — ')
    }),
  })
  console.log(
    `[IA][CONTEXTO-90D] venda=${numeroLancamento} ${montarResumoLogContextoContato(contextoComplementarContato)}`
  )

  const produtosCompradosLista = (produtosVendaConsolidado ?? []).map((p) => {
    const partes = [p.produto, p.departamento_classificado, p.subgrupo_classificado].filter(Boolean)
    return partes.join(' — ')
  })

  try {
    const consolidadoPrompt = montarPromptConsolidado(
      numeroLancamento,
      analisados ?? [],
      protocoloMap,
      ordemMap,
      dataConversaMap,
      dataFechamentoVenda,
      produtosCompradosLista,
      montarBlocoVendasAnterioresIA(contextoHistorico),
      montarBlocoChamadosAnterioresIA(contextoChamadosAnteriores),
      montarContextoComplementarContato(contextoComplementarContato),
      transcriptFatuaisMap,
      contextoTemporalMap
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
        nome_bebe: consolidado.nome_bebe,
        previsao_nascimento_bebe: consolidado.previsao_nascimento_bebe,
        produtos_fechados: consolidado.produtos_fechados,
        produtos_interesse_nao_fechados: consolidado.produtos_interesse_nao_fechados,
        tipo_fechamento: consolidado.tipo_fechamento,
        confianca_tipo_fechamento: consolidado.confianca_tipo_fechamento,
        evidencias_tipo_fechamento: consolidado.evidencias_tipo_fechamento,
        negociacoes_prazo: consolidado.negociacoes_prazo,
        negociacoes_frete: consolidado.negociacoes_frete,
        negociacoes_desconto: consolidado.negociacoes_desconto,
        negociacoes_pagamento: consolidado.negociacoes_pagamento,
        valores_citados: consolidado.valores_citados,
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
  produtosVenda: string[]
  contextoTemporal: string
  contextoHistorico: string
  contextoChamadosAnteriores: string
  contextoComplementarContato: string
  transcript: string
  protocolo: string | null
  dadosBebe: { nomeBebe: string | null; previsaoNascimento: string | null }
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

  const produtosStr = p.produtosVenda.length > 0
    ? p.produtosVenda.map((pr, i) => `  ${i + 1}. ${pr}`).join('\n')
    : '  (não informado)'

  return `Você é um analista comercial de uma loja de bebês e puericultura. Sua tarefa é classificar a influência de uma conversa no WhatsApp sobre a decisão de compra do cliente.

## REGRAS DE CLASSIFICAÇÃO

### influencia_compra

**Sim** — Use quando houver evidência clara de participação direta no fechamento ou decisão:
- Orçamento, negociação, preço ou desconto discutido
- Confirmação ou fechamento de compra
- Escolha de modelo ou cor
- Envio de link de pagamento
- Marcação de visita à loja que resultou em compra

**Parcialmente** — Use quando o chamado ajudou na jornada mesmo sem fechamento explícito:
- Conversa sobre produto ou categoria que depois foi comprado na venda
- Consultora enviou ou ofereceu vídeo, foto ou informação do produto
- Consultora retomou atendimento anterior sobre produto comprado
- Conversa manteve o lead ativo sobre produto relacionado
- Consultora tentou levar o cliente à loja
- Cliente confirmou que iria à loja antes da venda registrada
- Consultora deixou produto, atendimento ou separação prontos para finalização presencial
- Conversa operacional/logística aconteceu antes da venda e ajudou a conduzir visita, pagamento, escolha ou retirada
⚠️ REGRA CRÍTICA: Se o transcript menciona produto, categoria ou subgrupo que consta na lista de produtos comprados, classifique no mínimo como "Parcialmente".

**Não** — Use APENAS quando:
- Assunto completamente sem relação com os produtos comprados
- Conversa errada ou de outro cliente
- Atendimento administrativo ou operacional sem vínculo comercial
- Pós-venda ou suporte após a compra, fora da jornada, sem relação com decisão anterior
- Mensagem sem resposta e sem conteúdo sobre produto comprado

**Indefinido** — Use APENAS quando:
- Transcript vazio ou com mensagens insuficientes
- Apenas mídias sem texto descritivo
- Impossível determinar relação com a venda

### grau_influencia

**Alto** — Chamado teve papel direto no fechamento, negociação de preço, escolha final ou envio de link de pagamento.
**Médio** — Chamado tratou diretamente de produto comprado ou ajudou a avançar/finalizar a jornada antes da venda, mesmo sem fechamento explícito no WhatsApp.
**Baixo** — Chamado aqueceu o lead ou manteve contato, com pouca evidência de impacto direto.
**Nenhum** — Use SOMENTE quando influencia_compra = "Não" ou "Indefinido".

## CONTEXTO DA VENDA
- Nº lançamento: ${p.numeroLancamento}
- Protocolo do chamado: ${p.protocolo ?? 'Não informado'}
- Cliente: ${p.clienteNome}
- Data da venda: ${dataVenda}
- Consultora: ${p.userName}
- Departamento: ${p.departmentNome}
- Canal: ${p.serviceNome}
- Anotação da consultora: ${p.comments || '(sem anotação)'}
- Dias antes da venda: ${p.diasAntes != null ? p.diasAntes : 'desconhecido'}
- Ordem no ciclo: ${p.ordemCiclo != null ? `${p.ordemCiclo}ª conversa` : 'desconhecida'}
- Tipo de início: ${tipoInicio}

## PRODUTOS COMPRADOS NESTA VENDA
${produtosStr}

${p.contextoTemporal}

${p.contextoHistorico}

${p.contextoChamadosAnteriores}

${p.contextoComplementarContato}

## CONVERSA
${p.transcript || '(sem mensagens registradas)'}

## DADOS DO BEBÊ JÁ CONHECIDOS (contexto, não verdade absoluta)
- Nome do bebê: ${p.dadosBebe.nomeBebe ?? 'não informado'}
- Previsão de nascimento: ${p.dadosBebe.previsaoNascimento ?? 'não informado'}

Se a conversa atual trouxer dado diferente, sinalize como possível divergência/correção, mas não invente informação.

## INSTRUÇÃO FINAL
Compare o conteúdo da conversa com os produtos listados acima. Se houver menção a produto ou categoria que conste na lista, não classifique como "Não". Seja criterioso para não inventar influência, mas não ignore relação direta entre conversa e produto comprado.
Use tambem o CONTEXTO COMPLEMENTAR DO CONTATO quando ele trouxer evidencias comerciais antes do fechamento. Mensagens sem ticket nao precisam ter protocolo para provar influencia; cite-as como contexto complementar proximo ou historico ampliado, conforme a secao de origem, e nao invente chamado, protocolo ou numero discado. Historico ampliado de ate 90 dias ajuda a entender origem do interesse e retomadas, mas nao vira influencia automaticamente sem continuidade clara com a venda atual.

## REGRA SOBRE PRODUTOS RELACIONADOS E INFLUÊNCIA INDIRETA

### Móveis do quarto de bebê — jornada forte
No contexto da Le Bébé, berço, cômoda, roupeiro, cama, cama auxiliar, poltrona e colchão pertencem à mesma jornada forte de móveis do quarto de bebê.
Se o chamado tratou de um desses móveis e a venda fechou outro móvel da mesma lista:
- NÃO classifique automaticamente como "Não" apenas porque o móvel conversado difere do comprado.
- Avalie se houve intenção de compra, orçamento, prazo, condição de pagamento, visita à loja ou continuidade do atendimento.
- Se houver qualquer um desses sinais comerciais, classifique como "Parcialmente" com grau "Baixo" ou "Médio".
- Explique no "motivo_influencia" a divergência de produto e a relação indireta com a jornada de compra.

### Enxoval e acessórios — categoria separada
Lençol, kit berço, toalha, fronha, trocador, enxoval de quarto, itens têxteis, higiene e acessórios são outra categoria.
Não trate enxoval como equivalente direto a móveis.
- Se o chamado tratou apenas de enxoval/acessórios e a venda final foi de móveis: influência Baixa ou Nenhuma, salvo se houver evidência clara de que a conversa levou à visita à loja, pagamento ou continuidade comercial relevante.
- Se o chamado tratou apenas de móvel e a venda final foi apenas de enxoval/acessórios: influência Baixa ou Nenhuma, salvo se houver evidência de continuidade comercial clara.

### Influência por ida à loja
Se a conversa via WhatsApp levou o cliente à loja e a venda foi registrada depois da visita, a ida à loja pode ser considerada evidência de influência parcial/indireta, mesmo que o produto comprado seja diferente do tratado na conversa.
Sinal forte: cliente disse que iria à loja pagar/comprar e a venda foi registrada após o chamado.

Exemplo:
Conversa: roupeiro, valor, pagamento, cliente diz que irá à loja. Venda registrada: cômoda (móvel).
Classificação esperada:
- influencia_compra: "Parcialmente"
- grau_influencia: "Médio" ou "Baixo"
- motivo_influencia: "O chamado tratou de roupeiro (móvel de quarto), valor, pagamento e ida à loja. O produto conversado é diferente do comprado, mas ambos são móveis da mesma jornada. A conversa pode ter contribuído indiretamente para a visita e o fechamento."

Chamado com abordagem sem resposta do cliente: manter "Não / Nenhum" se não houver conteúdo comercial relevante.

## REGRA TEMPORAL E FINALIZAÇÃO PRESENCIAL
Compare horários do chamado, mensagens e fechamento antes de decidir influência.
- Se o chamado começou antes do fechamento e houve combinação para cliente ir à loja, produto ficar pronto/separado, pagamento ou finalização presencial, não classifique como "Não" apenas por parecer logística.
- Se a conversa pré-venda ajudou a conduzir a ida à loja ou a finalização, classifique no mínimo como "Parcialmente".
- Use grau "Médio" quando a conversa pré-venda ajudou a avançar ou finalizar a compra, mas não há evidência de que foi o fator principal ou único.
- Use "Não/Nenhum" para logística somente quando ela ocorreu depois do fechamento ou quando não houver elo com decisão, visita, produto, pagamento ou continuidade comercial.
- Se a hora exata da venda não estiver disponível, declare a limitação no motivo e evite afirmar que o chamado foi posterior.

## REGRA CONTRA INFERÊNCIA FORTE
Não transforme informação recebida (prazo, frete, desconto, condição de pagamento) em causa principal de fechamento sem evidência explícita.

Se o cliente apenas perguntou o prazo e a consultora informou uma data:
- NÃO afirmar: "O prazo adequado foi o principal motivo do fechamento."
- Afirmar com cautela: "O prazo foi informado e pode ter sido um fator de apoio na decisão." ou "Prazo tratado; não há confirmação de que foi determinante."

Se o cliente não demonstrou resistência explícita a nenhum item, não registre objeção.
Se o cliente apenas recebeu informação de preço/condição sem negociar, não registre como negociação ou motivo de fechamento.

Estas regras valem para os campos "motivo_influencia", "objecoes_identificadas" e "pontos_de_atencao".

## DADOS DO BEBÊ — REGRAS OBRIGATÓRIAS

Os campos "nome_bebe" e "previsao_nascimento_bebe" são INDEPENDENTES. Preencha cada um separadamente.

### previsao_nascimento_bebe
Capture qualquer indicação de data, mês ou período de nascimento, mesmo que parcial ou informal. Exemplos de frases que DEVEM ser capturadas:
- "Previsão é dia 23/12" → "23/12"
- "nasce em dezembro" → "dezembro"
- "nasce em dezembro/2026" → "dezembro/2026"
- "previsão para abril de 2026" → "abril de 2026"
- "estou com 9 semanas" — NÃO capture: semanas gestacionais sem data não são previsão de nascimento
- "DPP 15/01" → "15/01"
- "data prevista 15/01/2027" → "15/01/2027"
REGRA CRÍTICA: Salve EXATAMENTE como foi informado. Não complete o ano se não foi dito. Se disseram "23/12", salve "23/12", não "23/12/2026".

### nome_bebe
Capture SOMENTE quando o nome do bebê for mencionado explicitamente. Exemplos válidos:
- "o nome vai ser Helena" → "Helena"
- "vai se chamar Miguel" → "Miguel"
- "a bebê se chama Alana" → "Alana"
NÃO capture:
- Descoberta ou não do sexo do bebê ("ainda não descobrimos o sexo") → nome_bebe: null
- Produtos, cores ou contextos → nome_bebe: null
- Inferências → nome_bebe: null

### Combinações obrigatórias
- Encontrou previsão mas não nome → {"previsao_nascimento_bebe": "valor", "nome_bebe": null}
- Encontrou nome mas não previsão → {"nome_bebe": "valor", "previsao_nascimento_bebe": null}
- Encontrou ambos → {"nome_bebe": "valor", "previsao_nascimento_bebe": "valor"}
- Não encontrou nenhum → {"nome_bebe": null, "previsao_nascimento_bebe": null}
Estes dois campos SEMPRE devem aparecer no JSON, mesmo que sejam null.

Retorne exatamente este JSON (sem markdown, sem texto fora do JSON):
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
  "confianca_analise": "Alta | Média | Baixa",
  "nome_bebe": null,
  "previsao_nascimento_bebe": null
}`
}

// ── Cria observação comercial automática de dados do bebê ──────

const PREFIXO_OBS_BEBE = 'IA Digisac: dado do bebê identificado'
const PREFIXO_OBS_CORRECAO = 'IA Digisac: possível correção de dado do bebê'

function normalizarValorIA(valor?: string | null) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

interface CriarObservacaoBebeParams {
  numeroLancamento: string
  documentoSaidaId: string | null
  clienteNome: string | null
  protocolo: string | null
  nomeBebe: string | null
  previsao: string | null
  supabaseAdmin: ReturnType<typeof createServiceClient>
}

async function criarObservacaoBebeIA(p: CriarObservacaoBebeParams) {
  try {
    // Busca observações automáticas de bebê já existentes neste lançamento
    // Filtra em memória para evitar problemas com caracteres especiais no parser do PostgREST
    const { data: todasObs } = await p.supabaseAdmin
      .from('inteligencia_comercial_observacoes')
      .select('id, observacao')
      .eq('numero_lancamento', p.numeroLancamento)
      .is('deleted_at', null)
      .eq('criado_por', 'IA Digisac')

    const obsExistentes = (todasObs ?? []).filter(
      (o) => o.observacao?.startsWith(PREFIXO_OBS_BEBE) || o.observacao?.startsWith(PREFIXO_OBS_CORRECAO)
    )

    const textoOrigem = `Origem: chamado ${p.protocolo ?? 'sem protocolo'} / lançamento ${p.numeroLancamento}`
    const rodape = 'Conferir informação antes de usar em comunicação sensível.'

    // Extrai valores já registrados nas observações existentes
    let nomeRegistrado: string | null = null
    let previsaoRegistrada: string | null = null
    for (const obs of obsExistentes ?? []) {
      const linhas = obs.observacao.split('\n')
      for (const linha of linhas) {
        const mNome = linha.match(/^Nome do bebê:\s*(.+)$/)
        if (mNome) nomeRegistrado = normalizarValorIA(mNome[1])
        const mPrev = linha.match(/^Previsão de nascimento:\s*(.+)$/)
        if (mPrev) previsaoRegistrada = normalizarValorIA(mPrev[1])
      }
    }

    const linhasObs: string[] = []
    const linhasCorrecao: string[] = []

    // Lógica para nome_bebe
    if (p.nomeBebe) {
      const nomeNormalizado = normalizarValorIA(p.nomeBebe)
      if (!nomeRegistrado) {
        linhasObs.push(`Nome do bebê: ${p.nomeBebe}`)
      } else if (nomeRegistrado !== nomeNormalizado) {
        linhasCorrecao.push(`Nome do bebê corrigido pela IA (conferir): ${p.nomeBebe}`)
        linhasCorrecao.push(`Valor anterior registrado: ${nomeRegistrado}`)
      }
      // Igual ao registrado: não duplica
    }

    // Lógica para previsao_nascimento_bebe
    if (p.previsao) {
      const previsaoNormalizada = normalizarValorIA(p.previsao)
      if (!previsaoRegistrada) {
        linhasObs.push(`Previsão de nascimento: ${p.previsao}`)
      } else if (previsaoRegistrada !== previsaoNormalizada) {
        linhasCorrecao.push(`Previsão corrigida pela IA (conferir): ${p.previsao}`)
        linhasCorrecao.push(`Valor anterior registrado: ${previsaoRegistrada}`)
      }
      // Igual ao registrado: não duplica
    }

    const agora = new Date().toISOString()

    // Cria observação de dado novo (se houver linha nova)
    if (linhasObs.length > 0) {
      const texto = [
        `${PREFIXO_OBS_BEBE} na conversa.`,
        ...linhasObs,
        textoOrigem,
        rodape,
      ].join('\n')

      await p.supabaseAdmin
        .from('inteligencia_comercial_observacoes')
        .insert({
          numero_lancamento: p.numeroLancamento,
          documento_saida_id: p.documentoSaidaId,
          cliente_nome: p.clienteNome,
          observacao: texto,
          criado_por: 'IA Digisac',
          atualizado_por: 'IA Digisac',
          created_at: agora,
          updated_at: agora,
        })
    }

    // Cria observação de possível correção (se houver divergência)
    if (linhasCorrecao.length > 0) {
      const texto = [
        `${PREFIXO_OBS_CORRECAO} identificada.`,
        ...linhasCorrecao,
        textoOrigem,
        'Conferir antes de usar.',
      ].join('\n')

      await p.supabaseAdmin
        .from('inteligencia_comercial_observacoes')
        .insert({
          numero_lancamento: p.numeroLancamento,
          documento_saida_id: p.documentoSaidaId,
          cliente_nome: p.clienteNome,
          observacao: texto,
          criado_por: 'IA Digisac',
          atualizado_por: 'IA Digisac',
          created_at: agora,
          updated_at: agora,
        })
    }
  } catch (err) {
    console.error('[ia] erro ao criar observação bebê:', err)
  }
}

// ── Salva dados do bebê no cadastro do cliente/telefone ──────

interface SalvarBebeParams {
  telefoneDdi: string
  telefone: string | null
  clienteNome: string | null
  nomeBebe: string | null
  previsao: string | null
  numeroLancamento: string
  ticketId: string
  supabaseAdmin: ReturnType<typeof createServiceClient>
}

async function salvarDadosBebeCliente(p: SalvarBebeParams) {
  try {
    const { data: existente } = await p.supabaseAdmin
      .from('inteligencia_comercial_clientes')
      .select('id, nome_bebe, previsao_nascimento_bebe, conflito_observacao')
      .eq('telefone_normalizado_ddi', p.telefoneDdi)
      .maybeSingle()

    const agora = new Date().toISOString()

    if (!existente) {
      // Registro novo
      await p.supabaseAdmin
        .from('inteligencia_comercial_clientes')
        .insert({
          telefone_normalizado_ddi: p.telefoneDdi,
          telefone_normalizado: p.telefone,
          cliente_nome: p.clienteNome,
          nome_bebe: p.nomeBebe,
          previsao_nascimento_bebe: p.previsao,
          numero_lancamento_origem: p.numeroLancamento,
          digisac_ticket_id_origem: p.ticketId,
          origem_dado: 'ia_digisac',
          updated_at: agora,
        })
      return
    }

    // Registro existe — aplicar regras anti-sobrescrita
    const updates: Record<string, unknown> = { updated_at: agora }
    const conflitos: string[] = existente.conflito_observacao
      ? [existente.conflito_observacao]
      : []

    // nome_bebe
    if (p.nomeBebe) {
      if (!existente.nome_bebe) {
        updates.nome_bebe = p.nomeBebe
      } else if (existente.nome_bebe !== p.nomeBebe) {
        conflitos.push(
          `IA encontrou nome do bebê "${p.nomeBebe}" no chamado ${p.ticketId} (lançamento ${p.numeroLancamento}), mas o cadastro já tinha "${existente.nome_bebe}". Valor antigo preservado.`
        )
      }
    }

    // previsao_nascimento_bebe
    if (p.previsao) {
      if (!existente.previsao_nascimento_bebe) {
        updates.previsao_nascimento_bebe = p.previsao
      } else if (existente.previsao_nascimento_bebe !== p.previsao) {
        conflitos.push(
          `IA encontrou previsão "${p.previsao}" no chamado ${p.ticketId} (lançamento ${p.numeroLancamento}), mas o cadastro já tinha "${existente.previsao_nascimento_bebe}". Valor antigo preservado.`
        )
      }
    }

    if (conflitos.length > 0) {
      updates.conflito_observacao = conflitos.join(' | ')
    }

    if (Object.keys(updates).length > 1) {
      await p.supabaseAdmin
        .from('inteligencia_comercial_clientes')
        .update(updates)
        .eq('id', existente.id)
    }
  } catch (err) {
    console.error('[ia] erro ao salvar dados bebê no cliente:', err)
  }
}

function montarPromptConsolidado(
  numeroLancamento: string,
  analisados: Record<string, unknown>[],
  protocoloMap: Record<string, string | null>,
  ordemMap: Record<string, number | null>,
  dataConversaMap: Record<string, string | null>,
  dataFechamentoVenda: string | null,
  produtosComprados: string[],
  contextoHistorico: string,
  contextoChamadosAnteriores: string,
  contextoComplementarContato: string,
  transcriptFatuaisMap: Record<string, string[]> = {},
  contextoTemporalMap: Record<string, string | null> = {}
): string {
  // Ordena por ordem_conversa_para_venda ASC; fallback: mantém ordem atual
  const analisadosOrdenados = [...analisados].sort((a, b) => {
    const oA = ordemMap[a.digisac_ticket_id as string] ?? Number.MAX_SAFE_INTEGER
    const oB = ordemMap[b.digisac_ticket_id as string] ?? Number.MAX_SAFE_INTEGER
    return oA - oB
  })

  const resumos = analisadosOrdenados.map((a, i) => {
    const ticketId = a.digisac_ticket_id as string
    const protocolo = protocoloMap[ticketId] ?? 'sem protocolo'
    const numeroCiclo = ordemMap[ticketId] ?? (i + 1)
    const dataRawChamado = dataConversaMap[ticketId] ?? null
    const dataChamadoFmt = dataRawChamado
      ? (() => { try { return new Date(dataRawChamado).toLocaleDateString('pt-BR') } catch { return dataRawChamado } })()
      : 'não informada'
    const dadosBebe = (a.nome_bebe || a.previsao_nascimento_bebe)
      ? `\n- Dados do bebê: nome=${a.nome_bebe ?? 'null'}, previsão=${a.previsao_nascimento_bebe ?? 'null'}`
      : ''
    const trechos = transcriptFatuaisMap[ticketId] ?? []
    const contextoTemporal = contextoTemporalMap[ticketId]
      ? `\n${contextoTemporalMap[ticketId]}`
      : ''
    const trechosFatuaisStr = trechos.length > 0
      ? `\n- Trechos fatuais da conversa (datas, valores, prazo, pagamento, link):\n${trechos.map((t) => `  • ${t}`).join('\n')}`
      : ''
    return `### Chamado Nº ${numeroCiclo} — Protocolo ${protocolo}
- Data do chamado: ${dataChamadoFmt}${contextoTemporal}
- Influência: ${a.influencia_compra}
- Grau: ${a.grau_influencia}
- Motivo: ${a.motivo_influencia}
- Resumo: ${a.resumo_chamado}
- Intenção do cliente: ${a.intencao_cliente}
- Sentimento: ${a.sentimento_cliente}
- Produtos mencionados: ${JSON.stringify(a.produtos_mencionados)}
- Objeções: ${JSON.stringify(a.objecoes_identificadas)}
- Pontos de atenção: ${JSON.stringify(a.pontos_de_atencao)}${dadosBebe}${trechosFatuaisStr}`
  }).join('\n\n')

  // Agrega dados de bebê de todos os chamados individuais para contexto do consolidado
  const nomeBebeAgg = analisadosOrdenados.map(a => a.nome_bebe as string | null).find(v => v) ?? null
  const previsaoAgg = analisadosOrdenados.map(a => a.previsao_nascimento_bebe as string | null).find(v => v) ?? null
  const ctxBebe = (nomeBebeAgg || previsaoAgg)
    ? `\n\nDados do bebê já identificados nos chamados individuais:
- Nome do bebê: ${nomeBebeAgg ?? 'não encontrado'}
- Previsão de nascimento: ${previsaoAgg ?? 'não encontrada'}
Propague esses valores para os campos "nome_bebe" e "previsao_nascimento_bebe" do consolidado, mantendo exatamente o valor encontrado.`
    : `\n\nNenhum dado do bebê encontrado nos chamados individuais. Retorne "nome_bebe": null e "previsao_nascimento_bebe": null.`

  const produtosCompradosStr = produtosComprados.length > 0
    ? produtosComprados.map((pr, i) => `  ${i + 1}. ${pr}`).join('\n')
    : '  (não informado)'

  const ctxDataVenda = dataFechamentoVenda
    ? `\nData da venda registrada no SGI: ${dataFechamentoVenda}`
    : ''

  return `## Análise consolidada da venda ${numeroLancamento}

Total de chamados analisados: ${analisadosOrdenados.length}${ctxDataVenda}${ctxBebe}

## PRODUTOS COMPRADOS NESTA VENDA (fonte: SGI)
${produtosCompradosStr}

${contextoHistorico}

${contextoChamadosAnteriores}

${contextoComplementarContato}

${resumos}

## REGRAS DE NUMERAÇÃO
Cada chamado acima tem um "Nº" explícito (ex: "Chamado Nº 1", "Chamado Nº 2").
Ao referenciar chamados em qualquer campo do JSON, use SEMPRE o Nº informado acima.
Não crie numeração própria. Não use a posição do texto como referência.
Sempre cite também o protocolo quando disponível.
Formato obrigatório: "(chamado Nº N — protocolo XXXXXX)"
Exemplo: "Cliente indeciso sobre o modelo (chamado Nº 2 — protocolo 2026052269390)"
Se não houver chamado específico, omita a referência.

## REGRA SOBRE STATUS DA VENDA
Esta análise sempre parte de uma venda já registrada no SGI. Não trate a venda como em andamento, pendente, a finalizar ou com perspectiva de conclusão. Analise no passado, considerando que a venda já existe. O objetivo é entender se os chamados influenciaram essa venda, quais produtos apareceram na conversa, quais produtos foram comprados e quais oportunidades ficaram abertas. Se houver divergência entre produtos da conversa e produtos comprados, descreva como divergência ou oportunidade não convertida, não como venda futura.
Use expressões como: "a venda foi registrada", "a venda foi fechada", "os chamados influenciaram a venda", "os chamados não influenciaram a venda", "houve relação parcial com a venda", "há possível divergência entre conversa e itens comprados".
Evite expressões como: "a venda está em andamento", "a venda está em estágio avançado", "com perspectiva de conclusão", "deve dar continuidade para finalizar a venda", "cliente com intenção de pagamento" como se a venda ainda não tivesse acontecido.
O campo "resumo_geral" deve resumir a relação dos chamados com uma venda já registrada.
O campo "conclusao_comercial" deve concluir a influência comercial sobre a venda já registrada.

## REGRA SOBRE CONTEXTO COMPLEMENTAR DO CONTATO
O bloco "CONTEXTO COMPLEMENTAR DO CONTATO" pode conter mensagens sem ticket ou de outros tickets do mesmo contactId separadas entre contexto complementar proximo e historico ampliado de ate 90 dias.
- Mensagens sem ticket podem provar influencia, continuidade, preco, produto, pagamento, visita ou fechamento mesmo sem protocolo.
- Nao invente protocolo, numero de chamado ou numero discado para mensagens sem ticket.
- Quando usar evidencia desse bloco, descreva se veio de "contexto complementar proximo" ou "historico ampliado".
- Nao duplique o transcript principal: mensagens dos tickets principais ja foram removidas desse bloco.
- Historico ampliado antigo so deve influenciar a conclusao quando houver continuidade clara: mesmo produto/categoria, retomada explicita, mesmo orcamento/objeção/pagamento, acompanhamento da consultora ou compra posterior compativel.
- Produtos comprados em vendas anteriores devem ser distinguidos dos produtos da venda atual e nao devem virar oportunidade atual sem evidencia nova.

## REGRA TEMPORAL E FINALIZACAO PRESENCIAL
Use os blocos temporais de cada chamado para diferenciar atendimento antes da venda, atendimento depois da venda e logistica de finalizacao.
- Chamado antes do fechamento com cliente confirmando ida a loja, produto pronto/separado, pagamento ou finalizacao presencial pode influenciar parcialmente a venda.
- Nao classifique como sem influencia apenas por ser operacional quando a operacao ocorreu antes do fechamento e ajudou a conduzir a compra.
- Use influencia parcial e grau medio quando o chamado pre-venda ajudou a avancar/finalizar a compra, mas nao foi comprovado como fator principal.
- Use sem influencia para logistica apenas quando for posterior ao fechamento ou sem elo com decisao, visita, produto, pagamento ou continuidade comercial.
- Se a hora exata da venda nao estiver disponivel, declare a limitacao e evite afirmar que o chamado foi posterior.

## REGRAS PARA nome_bebe e previsao_nascimento_bebe
Estes campos são INDEPENDENTES e SEMPRE devem aparecer no JSON.
- Se algum chamado individual já trouxe esses dados, propague-os para o consolidado.
- Se nenhum chamado trouxe, retorne null para ambos.
- Não invente dados que não estejam nos chamados.

## REGRAS PARA CAMPOS COMERCIAIS NOVOS

### produtos_fechados
- Liste SOMENTE os produtos que constam em "PRODUTOS COMPRADOS NESTA VENDA" acima.
- Produtos das vendas anteriores devem ser considerados contexto historico, nao produtos_fechados da venda atual.
- Não inclua produtos mencionados na conversa que não estejam na lista de comprados.
- Se a lista de comprados estiver vazia, retorne array vazio.
- Use o nome do produto exatamente como aparece na lista de comprados, sem abreviar.

### produtos_interesse_nao_fechados
- Antes de listar um produto como nao fechado, verifique tambem "VENDAS ANTERIORES DO CLIENTE - CONTEXTO HISTORICO".
- Se o produto foi comprado em venda anterior com compra confirmada, registre como contexto historico/logistico quando pertinente, nao como oportunidade nao convertida.
- Mencoes a entrega, retirada, montagem ou suporte de produto comprado anteriormente nao devem virar oportunidade comercial nao fechada.
- So classifique como interesse nao fechado quando houver evidencia de interesse comercial atual e ausencia de compra na venda atual e nas vendas anteriores relevantes.
- Liste produtos ou categorias mencionados nos chamados que NÃO aparecem em "PRODUTOS COMPRADOS NESTA VENDA".
- Compare pelo nome/categoria: se um produto mencionado for equivalente a um comprado (mesmo que nome ligeiramente diferente), não o inclua como oportunidade, ou marque como "possível oportunidade (confirmar nomenclatura)".
- Se não houver produto mencionado diferente do comprado, retorne array vazio.

### REGRA SOBRE PRODUTOS RELACIONADOS DE QUARTO DE BEBÊ

#### Móveis do quarto — jornada forte
Berço, cômoda, roupeiro, cama, cama auxiliar, poltrona e colchão pertencem à mesma jornada forte de móveis do quarto de bebê.
Se a conversa menciona um desses móveis e a venda registrada fecha outro móvel da mesma lista:
- Não trate automaticamente como ausência de influência.
- Avalie se houve intenção de compra, visita à loja, negociação de prazo/pagamento ou continuidade de atendimento — se sim, classifique como influência parcial ou indireta.
- Registre a divergência entre produto mencionado e produto comprado.
- Trate o produto mencionado e não comprado como oportunidade não convertida em "produtos_interesse_nao_fechados".
- Não descarte a influência do atendimento apenas porque o item final foi diferente do item tratado na conversa.

#### Enxoval e acessórios — categoria separada
Lençol, kit berço, toalha, fronha, trocador, enxoval de quarto, itens têxteis, higiene e acessórios são outra categoria. Não os trate como equivalentes diretos a móveis.
Se a conversa foi apenas sobre enxoval/acessórios e a venda fechou móveis (ou vice-versa): não classifique automaticamente como influência. Avalie se a conversa levou à visita à loja, pagamento ou continuidade comercial relevante antes de atribuir influência parcial.

#### Influência por ida à loja
Se a conversa via WhatsApp levou o cliente à loja e a venda foi registrada depois, a ida à loja pode ser evidência de influência parcial/indireta mesmo que o produto comprado seja diferente do tratado na conversa.
Exemplo: cliente conversou sobre roupeiro (móvel), disse que iria à loja pagar, e a venda fechou cômoda (outro móvel). Nesse caso: o atendimento tem influência parcial, o roupeiro é oportunidade não convertida, e o tipo de fechamento deve refletir que houve conversa digital antes da ida à loja.

### tipo_fechamento
Classifique obrigatoriamente com UM dos valores exatos abaixo:
- "Presencial — visitou a loja e comprou na loja"
- "Digital — não visitou a loja e comprou online"
- "Misto — visitou a loja e comprou depois online"
- "Misto — conversou online e comprou depois presencialmente"
- "Indefinido — não há evidência suficiente"

CRITÉRIOS DETALHADOS — leia com atenção antes de classificar:

"Presencial — visitou a loja e comprou na loja"
Use SOMENTE quando:
- Não há atendimento digital relevante antes do fechamento; OU
- O atendimento digital existente é claramente irrelevante ou sem influência na venda.
NÃO use este valor quando houve conversa no WhatsApp sobre produto, prazo, orçamento, condições de pagamento ou visita antes da venda ser registrada.

"Misto — conversou online e comprou depois presencialmente"
Use quando:
- Houve conversa relevante no WhatsApp antes da venda (tratou de produto, prazo, orçamento, pagamento ou visita à loja).
- O cliente indicou que iria à loja pagar/comprar; E
- Não há evidência de link de pagamento enviado, pagamento remoto ou fechamento pelo WhatsApp.
Na operação da Le Bébé, quando a venda é remota normalmente há evidência na conversa de link de pagamento ou confirmação de pagamento digital. Se não há essa evidência e o cliente disse que iria à loja, o pagamento/fechamento foi presencial — mas como houve atendimento digital relevante antes, a classificação correta é MISTO, não presencial puro.
Exemplo: cliente conversou no WhatsApp sobre móvel de quarto de bebê, recebeu prazo/condições, disse que iria à loja passar o cartão, a venda foi registrada no SGI. → "Misto — conversou online e comprou depois presencialmente".

"Digital — não visitou a loja e comprou online"
Use quando:
- Há evidência de link de pagamento enviado/usado; OU
- Pagamento remoto confirmado; OU
- Fechamento pelo WhatsApp sem indicação de visita à loja.

"Misto — visitou a loja e comprou depois online"
Use quando:
- Há evidência de visita presencial à loja; E depois
- Há envio/uso de link de pagamento ou fechamento remoto.

"Indefinido — não há evidência suficiente"
Use quando não há evidência suficiente sobre visita, link, pagamento ou caminho de fechamento. Não force conclusão.

Use "Indefinido" se não houver evidência clara. Prefira "Misto — conversou online e comprou depois presencialmente" a "Presencial puro" sempre que houver atendimento digital relevante antes da venda.

### confianca_tipo_fechamento
Um dos valores exatos: "Alta" | "Média" | "Baixa"

### evidencias_tipo_fechamento
- Array de strings curtas e auditáveis.
- Cite "chamado Nº X — protocolo XXXXXX" quando possível.
- Não invente evidência.
- Se classificou como "Indefinido", explique quais evidências faltaram.

## REGRAS DE FORMATO
- Datas devem estar em dd/mm/aaaa quando citadas.
- Valores monetários devem estar em R$ 0,00 quando citados.

## REGRA SOBRE DATAS E ANO DE REFERÊNCIA
Cada chamado acima tem uma "Data do chamado" explícita. Use essa data como referência principal para interpretar datas mencionadas na conversa.
A venda analisada também tem data registrada no SGI (informada no cabeçalho desta análise) como referência secundária para validar o ciclo.
- Quando a conversa mencionar uma data sem ano (ex: "05/03"), complete o ano usando o ano do chamado se a data fizer sentido no ciclo da venda.
- Exemplo: chamado ocorreu em 25/02/2026, conversa menciona entrega em "05/03" → registre como 05/03/2026.
- Se a data dd/mm já passou em relação à data do chamado e o contexto indicar prazo futuro, use o próximo ano somente quando fizer sentido claro.
- Não escreva "ano não confirmado" quando o ano puder ser inferido com segurança pela data do chamado e pelo ciclo da venda.
- Marque como ambíguo (confianca "Baixa") somente quando houver conflito real ou ausência de contexto.
- Nunca invente data sem base na conversa ou no chamado.

## USO DOS TRECHOS FATUAIS

Cada chamado acima pode conter uma seção "Trechos fatuais da conversa". Esses trechos são extraídos diretamente da conversa original e têm PRIORIDADE MÁXIMA para extração de negociações comerciais.

REGRAS OBRIGATÓRIAS:
- Se um trecho fatual contém uma data (ex: "05/03", "dia 05/03"), use essa data em data_prometida. Não escreva "data não especificada na conversa" se a data aparece nos trechos.
- Se um trecho fatual contém um valor monetário (ex: "R$ 1.400,00"), registre em valores_citados ou negociações conforme contexto.
- Se um trecho fatual contém menção a link de pagamento, pagamento via cartão/pix/boleto, registre em negociacoes_pagamento.
- Se um trecho fatual contém menção a entrega, montagem, prazo ou data prometida, registre em negociacoes_prazo.
- Se um trecho fatual contém menção a frete, registre em negociacoes_frete.
- Se um trecho fatual contém menção a desconto ou condição especial, registre em negociacoes_desconto.
- Não ignore trechos fatuais. Eles existem porque o resumo individual pode ter omitido informações objetivas.
- Nunca escreva "data não especificada na conversa" se a data aparece nos trechos fatuais.
- Nunca escreva "ano não confirmado" se o ano é dedutível pela data do chamado.

## NEGOCIAÇÕES COMERCIAIS — EXTRAIR DOS CHAMADOS

Extraia negociações reais encontradas nos chamados analisados. Todos os campos são arrays que devem ser retornados mesmo que vazios.

### negociacoes_prazo
Registre APENAS quando houver conversa real sobre entrega, montagem, retirada, data prometida, urgência ou prazo comercial.
- Não registre prazo apenas por menção de produto.
- Não diga que prazo foi o motivo principal do fechamento sem evidência explícita.
- Se prazo foi apenas informado (sem negociação), use resumo como "Prazo informado" e confianca "Média" ou "Baixa".
- data_prometida: sempre em dd/mm/aaaa. Use a "Data do chamado" do bloco correspondente para inferir o ano quando a data da conversa vier sem ano (ex: "05/03" no chamado de 25/02/2026 → 05/03/2026). Não escreva "ano não confirmado" se o ano for deduízvel pela data do chamado. Se a data for relativa ("amanhã", "semana que vem") e não houver data numérica na conversa, registre no resumo exatamente como foi dito e deixe data_prometida como null.
- Cite chamado_numero e protocolo quando possível.
- Se não houver negociação de prazo: retorne array vazio [].
Estrutura de cada item:
{ "tipo": "prazo", "resumo": "...", "data_prometida": "dd/mm/aaaa ou null", "evidencia": "...", "chamado_numero": N ou null, "protocolo": "..." ou null, "confianca": "Alta|Média|Baixa" }

### negociacoes_frete
Registre APENAS quando houver menção clara a frete, entrega paga, taxa de entrega, isenção de frete ou negociação de entrega.
- Não invente frete a partir de endereço ou CEP.
- Não assuma desconto no frete se só houve consulta de CEP.
- Valores em R$ 0,00.
- Se não houver negociação de frete: retorne array vazio [].
Estrutura de cada item:
{ "tipo": "frete", "valor_original": "R$ 0,00 ou null", "valor_negociado": "R$ 0,00 ou null", "resumo": "...", "evidencia": "...", "chamado_numero": N ou null, "protocolo": "..." ou null, "confianca": "Alta|Média|Baixa" }

### negociacoes_desconto
Registre APENAS quando houver pedido ou oferta clara de desconto, abatimento, condição especial, redução de preço ou comparação de valor.
- Não considere valor citado como desconto automaticamente.
- Se a conversa apenas cita preço: registrar em valores_citados, não aqui.
- Se houver valor original e final: preencher ambos. Se houver percentual explícito: preencher percentual.
- Não calcule percentual se não foi informado explicitamente.
- Se não houver desconto: retorne array vazio [].
Estrutura de cada item:
{ "tipo": "desconto", "valor_original": "R$ 0,00 ou null", "valor_final": "R$ 0,00 ou null", "percentual": "...% ou null", "resumo": "...", "evidencia": "...", "chamado_numero": N ou null, "protocolo": "..." ou null, "confianca": "Alta|Média|Baixa" }

### negociacoes_pagamento
Registre quando houver menção a cartão, pix, boleto, dinheiro, parcelamento, link de pagamento, pagamento na loja ou pagamento remoto.

REGRAS OBRIGATÓRIAS PARA LINK DE PAGAMENTO:
- houve_link_pagamento = true SEMPRE QUE: a atendente ofereceu enviar o link, sugeriu o link, perguntou se o cliente quer receber o link, ou disse "posso enviar o link", "prefere receber o link", "posso estar enviando o link" — mesmo que o link não tenha sido enviado ou usado.
- houve_link_pagamento = false apenas quando não há nenhuma menção a link de pagamento na conversa.
- link_usado_confirmado = true SOMENTE quando há confirmação de pagamento pelo link, fechamento remoto confirmado ou mensagem explícita de uso do link.
- link_usado_confirmado = false quando: o link foi apenas oferecido/sugerido mas não há confirmação de envio ou uso; o cliente disse que iria à loja; o cliente não respondeu sobre o link.
- Não confunda oferta de link com envio de link. Não confunda envio de link com uso de link.
- O campo "resumo" deve descrever o estado real: "Link oferecido/sugerido — não confirmado como enviado ou usado." quando aplicável.
- O campo "evidencia" deve citar a mensagem exata e o chamado.
- Se o cliente já indicou que iria à loja passar cartão e não há confirmação de uso do link: forma = "cartão na loja" (ou equivalente), link_usado_confirmado = false.
- Não classifique venda como digital apenas porque houve oferta de link.
- Não retorne houve_link_pagamento = false quando houve oferta/sugestão de link.
- Se não houver negociação de pagamento: retorne array vazio [].
Estrutura de cada item:
{ "tipo": "pagamento", "forma": "..." ou null, "houve_link_pagamento": true/false, "link_usado_confirmado": true/false, "resumo": "...", "evidencia": "...", "chamado_numero": N ou null, "protocolo": "..." ou null, "confianca": "Alta|Média|Baixa" }

### valores_citados
Capture valores monetários citados na conversa que não sejam negociação de desconto ou frete já registrados.
- Não transforme valor citado em desconto sem evidência.
- Não transforme valor citado em valor final da venda sem evidência.
- tipo_valor: "produto", "frete", "desconto", "pagamento" ou "outro".
- Se não houver: retorne array vazio [].
Estrutura de cada item:
{ "valor": "R$ 0,00", "contexto": "...", "tipo_valor": "produto|frete|desconto|pagamento|outro", "chamado_numero": N ou null, "protocolo": "..." ou null, "confianca": "Alta|Média|Baixa" }

### REGRAS GERAIS DAS NEGOCIAÇÕES
1. Não invente negociação não evidenciada na conversa.
2. Não transforme informação recebida em causa principal sem evidência explícita.
3. Separe valor citado de desconto real.
4. Separe link oferecido de link usado.
5. Datas sempre em dd/mm/aaaa.
6. Valores sempre em R$ 0,00.
7. Cite chamado Nº e protocolo nas evidências sempre que possível.
8. A venda já está registrada no SGI; analise no passado.
9. Se não houver evidência, retorne arrays vazios.

## Retorne exatamente este JSON (sem markdown, sem texto fora do JSON):
{
  "resumo_geral": "...",
  "chamados_que_influenciaram": [{ "ticket_id": "...", "protocolo": "...", "resumo": "..." }],
  "chamados_sem_influencia": [{ "ticket_id": "...", "protocolo": "...", "resumo": "..." }],
  "principais_motivos_compra": ["..."],
  "principais_objecoes": ["..."],
  "produtos_de_interesse": ["..."],
  "oportunidades_melhoria": ["..."],
  "conclusao_comercial": "...",
  "nome_bebe": null,
  "previsao_nascimento_bebe": null,
  "produtos_fechados": ["..."],
  "produtos_interesse_nao_fechados": ["..."],
  "tipo_fechamento": "Indefinido — não há evidência suficiente",
  "confianca_tipo_fechamento": "Baixa",
  "evidencias_tipo_fechamento": ["..."],
  "negociacoes_prazo": [],
  "negociacoes_frete": [],
  "negociacoes_desconto": [],
  "negociacoes_pagamento": [],
  "valores_citados": []
}`
}
