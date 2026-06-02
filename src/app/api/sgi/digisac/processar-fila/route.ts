import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import {
  buscarTicketsPorTelefoneComVariacoes,
  calcularInicioChamado,
  buscarMensagensTicketPaginado,
  calcularQuantidadeInteracoes,
  montarResumoTicket,
  recalcularHistoricoTelefone,
  calcularVinculosVenda,
  type ResumoTicket,
} from '@/lib/digisac/sgi-sync'

export const runtime = 'nodejs'
// Aumentar timeout: processamento pode ser demorado
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

  // Busca o job
  const { data: job, error: jobErr } = await supabase
    .from('digisac_sync_fila')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
  }

  if (job.status !== 'pendente') {
    return NextResponse.json({
      jobId,
      numeroLancamento: job.numero_lancamento,
      status: job.status,
      mensagem: `Job não está pendente (status atual: ${job.status})`,
      resultadoJson: job.resultado_json,
    })
  }

  // Marca como processando
  await supabaseAdmin
    .from('digisac_sync_fila')
    .update({ status: 'processando', iniciado_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', jobId)

  try {
    const numeroLancamento: string = job.numero_lancamento

    // Busca venda com data de fechamento
    const { data: venda } = await supabase
      .from('sgi_documentos_saida')
      .select('id, numero_lancamento, data_fechamento, cliente')
      .eq('numero_lancamento', numeroLancamento)
      .single()

    // Busca histórico existente por telefone (para calcular data_inicio_incremental)
    const telefonesDDI: string[] = Array.isArray(job.telefones_processados_json)
      ? job.telefones_processados_json
      : []

    const { data: historicos } = await supabase
      .from('digisac_cliente_historico_resumo')
      .select('telefone_normalizado_ddi, atualizado_em')
      .in('telefone_normalizado_ddi', telefonesDDI)

    const historicoMap = new Map<string, string | null>(
      (historicos ?? []).map((h) => [h.telefone_normalizado_ddi, h.atualizado_em])
    )

    const isPrimeiraSincronizacao = job.tipo_sincronizacao === 'primeira_sincronizacao'

    // Testar suporte a updatedAt (uma vez por job, no primeiro telefone com dataInicio)
    let usarUpdatedAt = true
    let updatedAtTestado = false

    let totalNovosOuAtualizados = 0
    let totalJanela90DiasGlobal = 0
    const todosTicketsResumo: ResumoTicket[] = []
    const todosErroVariacoes: string[] = []

    for (const telefoneDDI of telefonesDDI) {
      const atualizado_em = historicoMap.get(telefoneDDI) ?? null

      let dataInicioISO: string | null = null
      if (!isPrimeiraSincronizacao && atualizado_em) {
        const dt = new Date(new Date(atualizado_em).getTime() - 2 * 60 * 60 * 1000)
        dataInicioISO = dt.toISOString()
      }

      // Testa suporte a updatedAt uma única vez (se falhar, usa startedAt)
      if (!updatedAtTestado && dataInicioISO) {
        updatedAtTestado = true
        try {
          await buscarTicketsPorTelefoneComVariacoes(telefoneDDI, {
            dataInicioISO,
            usarUpdatedAt: true,
            perPage: 1,
          })
          usarUpdatedAt = true
          console.log(`[processar-fila] updatedAt suportado`)
        } catch {
          usarUpdatedAt = false
          console.warn(`[processar-fila] updatedAt NÃO suportado, usando startedAt`)
        }
      }

      // Busca com todas as variações de telefone (sem-9 primeiro)
      const { tickets, erros } = await buscarTicketsPorTelefoneComVariacoes(telefoneDDI, {
        dataInicioISO,
        usarUpdatedAt,
        perPage: 50,
      })

      if (erros.length > 0) todosErroVariacoes.push(...erros)

      console.log(`[processar-fila] telefone=${telefoneDDI} tickets=${tickets.length} dataInicio=${dataInicioISO ?? 'tudo'}`)

      for (const ticket of tickets) {
        // Calcular início do chamado (retorna mensagens se buscadas no fallback)
        const { inicio, mensagens: mensagensFallback, incompleto: incompletoFallback } =
          await calcularInicioChamado(ticket)

        // Reutilizar mensagens do fallback OU buscar uma vez só para contagem
        let interacoes = 0
        let incompleto = incompletoFallback

        if (mensagensFallback !== null) {
          // Mensagens já foram buscadas no fallback — reutilizar
          interacoes = calcularQuantidadeInteracoes(mensagensFallback)
        } else {
          // firstMessage foi suficiente para inicio — buscar mensagens para contagem
          const { mensagens, incompleto: inc } = await buscarMensagensTicketPaginado(ticket.id)
          interacoes = calcularQuantidadeInteracoes(mensagens)
          incompleto = inc
        }

        const resumo = montarResumoTicket(ticket, inicio, interacoes, incompleto, telefoneDDI)
        todosTicketsResumo.push(resumo)

        const { error: upsertErr } = await supabaseAdmin
          .from('digisac_conversas_resumo')
          .upsert(resumo, { onConflict: 'digisac_ticket_id' })

        if (upsertErr) {
          console.error(`[processar-fila] upsert conversas_resumo ticketId=${ticket.id}:`, upsertErr)
        } else {
          totalNovosOuAtualizados++
        }
      }

      // Recalcula histórico do telefone (mesmo com 0 tickets — atualiza timestamp)
      const nomeSgi = venda?.cliente ?? null
      await recalcularHistoricoTelefone(telefoneDDI, nomeSgi, supabaseAdmin)
    }

    // Calcula vínculos da venda
    if (venda && todosTicketsResumo.length > 0) {
      const { totalJanela90Dias } = await calcularVinculosVenda(
        venda.id,
        numeroLancamento,
        venda.data_fechamento,
        todosTicketsResumo,
        supabaseAdmin
      )
      totalJanela90DiasGlobal = totalJanela90Dias
    }

    // Busca resumo final do histórico consolidado
    const { data: historicosFinais } = await supabaseAdmin
      .from('digisac_cliente_historico_resumo')
      .select('total_chamados_historico, total_chamados_ativos, total_chamados_receptivos, total_chamados_indefinidos, total_interacoes_historico, atualizado_em')
      .in('telefone_normalizado_ddi', telefonesDDI)

    const totalHistorico = (historicosFinais ?? []).reduce((a, h) => a + (h.total_chamados_historico ?? 0), 0)
    const totalAtivos = (historicosFinais ?? []).reduce((a, h) => a + (h.total_chamados_ativos ?? 0), 0)
    const totalReceptivos = (historicosFinais ?? []).reduce((a, h) => a + (h.total_chamados_receptivos ?? 0), 0)
    const totalIndefinidos = (historicosFinais ?? []).reduce((a, h) => a + (h.total_chamados_indefinidos ?? 0), 0)
    const totalInteracoes = (historicosFinais ?? []).reduce((a, h) => a + (h.total_interacoes_historico ?? 0), 0)
    const ultimaAtualizacao = historicosFinais?.[0]?.atualizado_em ?? new Date().toISOString()

    const origemDados = isPrimeiraSincronizacao ? 'digisac_primeira_sync' : 'digisac_incremental'

    const resultado = {
      jobId,
      numeroLancamento,
      status: 'concluido',
      origemDados,
      filtroPorCampo: usarUpdatedAt ? 'updatedAt' : 'startedAt',
      semChamados: totalHistorico === 0,
      totalHistorico,
      totalNovosOuAtualizados,
      totalJanela90Dias: totalJanela90DiasGlobal,
      totalAtivos,
      totalReceptivos,
      totalIndefinidos,
      totalInteracoes,
      ultimaAtualizacao,
      errosVariacoes: todosErroVariacoes.length > 0 ? todosErroVariacoes : undefined,
    }

    // Atualiza job como concluido
    await supabaseAdmin
      .from('digisac_sync_fila')
      .update({
        status: 'concluido',
        resultado_json: resultado,
        finalizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    return NextResponse.json(resultado)
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[processar-fila] erro inesperado jobId=${jobId}:`, err)

    await supabaseAdmin
      .from('digisac_sync_fila')
      .update({
        status: 'erro',
        erro_mensagem: errMsg,
        tentativas: (job.tentativas ?? 0) + 1,
        finalizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    return NextResponse.json({ error: 'Erro ao processar job', detalhe: errMsg }, { status: 500 })
  }
}
