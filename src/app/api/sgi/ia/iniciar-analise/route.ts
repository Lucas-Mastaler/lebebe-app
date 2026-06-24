import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  let body: { numeroLancamento?: string; reanalisar?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { numeroLancamento, reanalisar = false } = body
  if (!numeroLancamento) {
    return NextResponse.json({ error: 'numeroLancamento é obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()
  const supabaseAdmin = createServiceClient()

  // Busca venda
  const { data: venda, error: vendaErr } = await supabase
    .from('sgi_documentos_saida')
    .select('id, numero_lancamento, data_fechamento, cliente')
    .eq('numero_lancamento', numeroLancamento)
    .single()

  if (vendaErr || !venda) {
    return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
  }

  // Busca tickets do ciclo
  const { data: vinculos, error: vinculosErr } = await supabase
    .from('venda_conversa_vinculos')
    .select('digisac_ticket_id, data_conversa, ordem_conversa_para_venda, dias_antes_da_venda, inicio_chamado')
    .eq('numero_lancamento', numeroLancamento)
    .eq('considerada_no_ciclo_venda', true)
    .order('ordem_conversa_para_venda', { ascending: true })

  if (vinculosErr) {
    return NextResponse.json({ error: 'Erro ao buscar vínculos do ciclo' }, { status: 500 })
  }

  if (!vinculos || vinculos.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum chamado no ciclo da venda. Sincronize o Digisac primeiro.' },
      { status: 422 }
    )
  }

  // Verifica job ativo
  const { data: jobAtivo } = await supabase
    .from('ia_analise_comercial_fila')
    .select('id, status, chamados_processados, total_chamados')
    .eq('numero_lancamento', numeroLancamento)
    .in('status', ['pendente', 'processando'])
    .maybeSingle()

  if (jobAtivo && !reanalisar) {
    return NextResponse.json({
      jaEmAndamento: true,
      filaId: jobAtivo.id,
      status: jobAtivo.status,
      chamadosProcessados: jobAtivo.chamados_processados,
      totalChamados: jobAtivo.total_chamados,
    })
  }

  // Se reanalisar, cancela job anterior
  if (reanalisar) {
    await supabaseAdmin
      .from('ia_analise_comercial_fila')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('numero_lancamento', numeroLancamento)
      .in('status', ['pendente', 'processando'])
  }

  // Cria novo job
  const { data: novoJob, error: jobErr } = await supabaseAdmin
    .from('ia_analise_comercial_fila')
    .insert({
      numero_lancamento: numeroLancamento,
      documento_saida_id: venda.id,
      status: 'pendente',
      total_chamados: vinculos.length,
      chamados_processados: 0,
      chamados_com_erro: 0,
      solicitado_por: auth.email,
      iniciado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (jobErr || !novoJob) {
    console.error('[ia/iniciar-analise] erro ao criar job:', jobErr)
    return NextResponse.json({ error: 'Erro ao criar job de análise' }, { status: 500 })
  }

  const filaId = novoJob.id

  // Cria registros pendentes para cada chamado (upsert por unique)
  const registrosChamados = vinculos.map((v) => ({
    numero_lancamento: numeroLancamento,
    digisac_ticket_id: v.digisac_ticket_id,
    fila_id: filaId,
    status: 'pendente',
    updated_at: new Date().toISOString(),
  }))

  const { error: insertErr } = await supabaseAdmin
    .from('digisac_chamados_analise_ia')
    .upsert(registrosChamados, {
      onConflict: 'numero_lancamento,digisac_ticket_id',
      ignoreDuplicates: false,
    })

  if (insertErr) {
    console.error('[ia/iniciar-analise] erro ao criar registros de chamados:', insertErr)
    return NextResponse.json({ error: 'Erro ao preparar registros dos chamados' }, { status: 500 })
  }

  // Atualiza fila_id nos registros e limpa todos os campos da análise anterior
  // para evitar que dados antigos (influencia_compra, grau_influencia etc.) apareçam
  // durante o processamento do novo job
  await supabaseAdmin
    .from('digisac_chamados_analise_ia')
    .update({
      fila_id: filaId,
      status: 'pendente',
      erro_mensagem: null,
      resumo_chamado: null,
      influencia_compra: null,
      grau_influencia: null,
      motivo_influencia: null,
      produtos_mencionados: [],
      objecoes_identificadas: [],
      intencao_cliente: null,
      sentimento_cliente: null,
      pontos_de_atencao: [],
      confianca_analise: null,
      nome_bebe: null,
      previsao_nascimento_bebe: null,
      transcript_truncado: false,
      transcript_tamanho_chars: null,
      total_mensagens: null,
      modelo_ia: null,
      analisado_em: null,
      updated_at: new Date().toISOString(),
    })
    .eq('numero_lancamento', numeroLancamento)
    .in('digisac_ticket_id', vinculos.map((v) => v.digisac_ticket_id))

  return NextResponse.json({
    filaId,
    totalChamados: vinculos.length,
    numeroLancamento,
  })
}
