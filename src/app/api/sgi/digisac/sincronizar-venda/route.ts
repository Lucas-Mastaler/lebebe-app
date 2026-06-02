import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'

const CACHE_24H_MS = 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  let body: { numeroLancamento?: string; forcarAtualizacao?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { numeroLancamento, forcarAtualizacao = false } = body

  if (!numeroLancamento) {
    return NextResponse.json({ error: 'numeroLancamento é obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()
  const supabaseAdmin = createServiceClient()

  // Busca a venda
  const { data: venda, error: vendaErr } = await supabase
    .from('sgi_documentos_saida')
    .select('id, numero_lancamento, data_fechamento, cliente')
    .eq('numero_lancamento', numeroLancamento)
    .single()

  if (vendaErr || !venda) {
    return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
  }

  // Busca telefones da venda
  const { data: contatos } = await supabase
    .from('sgi_documentos_saida_contatos')
    .select('telefone_normalizado, telefone_normalizado_ddi, principal')
    .eq('numero_lancamento', numeroLancamento)
    .not('telefone_normalizado_ddi', 'is', null)

  const telefones = (contatos ?? []).filter((c) => c.telefone_normalizado_ddi)

  if (telefones.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum telefone válido encontrado para esta venda' },
      { status: 422 }
    )
  }

  // Verifica se já existe job pendente/processando
  const { data: jobExistente } = await supabase
    .from('digisac_sync_fila')
    .select('id, status, tipo_sincronizacao, solicitado_em')
    .eq('numero_lancamento', numeroLancamento)
    .in('status', ['pendente', 'processando'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (jobExistente) {
    return NextResponse.json({
      jobId: jobExistente.id,
      numeroLancamento,
      status: jobExistente.status,
      tipoSincronizacao: jobExistente.tipo_sincronizacao,
      mensagem: 'Job já em andamento para esta venda',
    })
  }

  // Verificar cache por telefone (todos devem ter cache válido para ignorar)
  const telefonesDDI = telefones.map((t) => t.telefone_normalizado_ddi)

  const { data: historicos } = await supabase
    .from('digisac_cliente_historico_resumo')
    .select('telefone_normalizado_ddi, atualizado_em, total_chamados_historico, total_chamados_ativos, total_chamados_receptivos, total_chamados_indefinidos, total_interacoes_historico')
    .in('telefone_normalizado_ddi', telefonesDDI)

  const agora = Date.now()
  const todosComCacheValido =
    !forcarAtualizacao &&
    historicos !== null &&
    historicos.length === telefonesDDI.length &&
    historicos.every((h) => {
      if (!h.atualizado_em) return false
      return agora - new Date(h.atualizado_em).getTime() < CACHE_24H_MS
    })

  if (todosComCacheValido) {
    // Registra na fila como ignorado
    const { data: jobIgnorado } = await supabaseAdmin
      .from('digisac_sync_fila')
      .insert({
        numero_lancamento: numeroLancamento,
        documento_saida_id: venda.id,
        tipo_sincronizacao: 'incremental_cache_vencido',
        status: 'ignorado_cache_valido',
        solicitado_por: auth.email,
        resultado_json: { motivo: 'cache_valido_24h' },
        telefones_processados_json: telefonesDDI,
        solicitado_em: new Date().toISOString(),
      })
      .select('id')
      .single()

    const historico = historicos[0]
    return NextResponse.json({
      jobId: jobIgnorado?.id ?? null,
      numeroLancamento,
      status: 'ignorado_cache_valido',
      tipoSincronizacao: 'ignorado_cache_valido',
      mensagem: 'Cache válido (< 24h). Use forcarAtualizacao=true para forçar.',
      resultadoCache: {
        ultimaAtualizacao: historico?.atualizado_em ?? null,
        totalHistorico: historicos.reduce((a, h) => a + (h.total_chamados_historico ?? 0), 0),
        totalAtivos: historicos.reduce((a, h) => a + (h.total_chamados_ativos ?? 0), 0),
        totalReceptivos: historicos.reduce((a, h) => a + (h.total_chamados_receptivos ?? 0), 0),
        totalIndefinidos: historicos.reduce((a, h) => a + (h.total_chamados_indefinidos ?? 0), 0),
        totalInteracoes: historicos.reduce((a, h) => a + (h.total_interacoes_historico ?? 0), 0),
      },
    })
  }

  // Determina tipo de sincronização
  const temAlgumHistorico = historicos && historicos.length > 0
  let tipoSincronizacao: string

  if (!temAlgumHistorico) {
    tipoSincronizacao = 'primeira_sincronizacao'
  } else if (forcarAtualizacao) {
    tipoSincronizacao = 'forcada_incremental'
  } else {
    tipoSincronizacao = 'incremental_cache_vencido'
  }

  // Cria o job na fila
  const { data: novoJob, error: jobErr } = await supabaseAdmin
    .from('digisac_sync_fila')
    .insert({
      numero_lancamento: numeroLancamento,
      documento_saida_id: venda.id,
      tipo_sincronizacao: tipoSincronizacao,
      status: 'pendente',
      solicitado_por: auth.email,
      telefones_processados_json: telefonesDDI,
      solicitado_em: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (jobErr || !novoJob) {
    console.error('[sincronizar-venda] erro ao criar job:', jobErr)
    return NextResponse.json({ error: 'Erro ao criar job na fila' }, { status: 500 })
  }

  return NextResponse.json({
    jobId: novoJob.id,
    numeroLancamento,
    status: 'pendente',
    tipoSincronizacao,
    mensagem: 'Job criado. Chame POST /api/sgi/digisac/processar-fila com o jobId para processar.',
  })
}
