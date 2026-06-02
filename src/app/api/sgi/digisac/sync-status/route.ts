import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const jobId = searchParams.get('jobId')
  const numeroLancamento = searchParams.get('numeroLancamento')

  if (!jobId && !numeroLancamento) {
    return NextResponse.json(
      { error: 'Informe jobId ou numeroLancamento' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  let query = supabase
    .from('digisac_sync_fila')
    .select('id, numero_lancamento, status, tipo_sincronizacao, resultado_json, erro_mensagem, solicitado_por, solicitado_em, iniciado_em, finalizado_em, created_at')
    .order('created_at', { ascending: false })
    .limit(1)

  if (jobId) {
    query = query.eq('id', jobId)
  } else if (numeroLancamento) {
    query = query.eq('numero_lancamento', numeroLancamento)
  }

  const { data: job, error } = await query.maybeSingle()

  if (error) {
    console.error('[sync-status] erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar status' }, { status: 500 })
  }

  if (!job) {
    return NextResponse.json({
      jobId: null,
      numeroLancamento: numeroLancamento ?? null,
      status: 'nao_encontrado',
      mensagem: 'Nenhuma sincronização encontrada para esta venda.',
    })
  }

  // Enriquece jobs que não têm dados completos no resultado_json
  // (jobs antigos, ou ignorado_cache_valido sem histórico/ciclo)
  let resultadoJson = job.resultado_json

  const precisaEnriquecerHistorico =
    (job.status === 'ignorado_cache_valido' || job.status === 'concluido') &&
    resultadoJson?.totalHistorico == null

  const precisaEnriquecerCiclo =
    (job.status === 'ignorado_cache_valido' || job.status === 'concluido') &&
    resultadoJson?.totalCicloVenda == null

  if (precisaEnriquecerHistorico) {
    const telefonesJob: string[] = Array.isArray(job.resultado_json?.telefonesProcessados)
      ? job.resultado_json.telefonesProcessados.map((t: { telefoneBase: string }) => t.telefoneBase)
      : []

    const telefonesParaBuscar = telefonesJob.length > 0
      ? telefonesJob
      : await (async () => {
          const { data } = await supabase
            .from('sgi_documentos_saida_contatos')
            .select('telefone_normalizado_ddi')
            .eq('numero_lancamento', job.numero_lancamento)
            .not('telefone_normalizado_ddi', 'is', null)
          return (data ?? []).map((c: { telefone_normalizado_ddi: string }) => c.telefone_normalizado_ddi)
        })()

    if (telefonesParaBuscar.length > 0) {
      const { data: historicos } = await supabase
        .from('digisac_cliente_historico_resumo')
        .select('atualizado_em, total_chamados_historico, total_chamados_ativos, total_chamados_receptivos, total_chamados_indefinidos, total_interacoes_historico')
        .in('telefone_normalizado_ddi', telefonesParaBuscar)

      if (historicos && historicos.length > 0) {
        resultadoJson = {
          ...resultadoJson,
          totalHistorico: historicos.reduce((a, h) => a + (h.total_chamados_historico ?? 0), 0),
          totalAtivos: historicos.reduce((a, h) => a + (h.total_chamados_ativos ?? 0), 0),
          totalReceptivos: historicos.reduce((a, h) => a + (h.total_chamados_receptivos ?? 0), 0),
          totalIndefinidos: historicos.reduce((a, h) => a + (h.total_chamados_indefinidos ?? 0), 0),
          totalInteracoes: historicos.reduce((a, h) => a + (h.total_interacoes_historico ?? 0), 0),
          ultimaAtualizacao: historicos[0]?.atualizado_em ?? null,
          semChamados: historicos.reduce((a, h) => a + (h.total_chamados_historico ?? 0), 0) === 0,
        }
      }
    }
  }

  if (precisaEnriquecerCiclo) {
    const { data: vinculos } = await supabase
      .from('venda_conversa_vinculos')
      .select('considerada_no_ciclo_venda, data_inicio_ciclo_venda, data_fim_ciclo_venda, numero_lancamento_venda_anterior')
      .eq('numero_lancamento', job.numero_lancamento)

    if (vinculos && vinculos.length > 0) {
      const vinculosCiclo = vinculos.filter((v) => v.considerada_no_ciclo_venda)
      resultadoJson = {
        ...resultadoJson,
        totalCicloVenda: vinculosCiclo.length,
        inicioCicloVenda: vinculos[0]?.data_inicio_ciclo_venda ?? null,
        fimCicloVenda: vinculos[0]?.data_fim_ciclo_venda ?? null,
        vendaAnterior: vinculos[0]?.numero_lancamento_venda_anterior ?? null,
      }
    }
  }

  return NextResponse.json({
    jobId: job.id,
    numeroLancamento: job.numero_lancamento,
    status: job.status,
    tipoSincronizacao: job.tipo_sincronizacao,
    resultadoJson,
    erroMensagem: job.erro_mensagem,
    solicitadoPor: job.solicitado_por,
    solicitadoEm: job.solicitado_em,
    iniciadoEm: job.iniciado_em,
    finalizadoEm: job.finalizado_em,
  })
}
