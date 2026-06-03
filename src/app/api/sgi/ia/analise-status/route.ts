import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const numeroLancamento = searchParams.get('numeroLancamento')

  if (!numeroLancamento) {
    return NextResponse.json({ error: 'numeroLancamento é obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()

  // Busca job mais recente
  const { data: job } = await supabase
    .from('ia_analise_comercial_fila')
    .select('*')
    .eq('numero_lancamento', numeroLancamento)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!job) {
    return NextResponse.json({
      status: 'nao_iniciado',
      job: null,
      chamados: [],
      consolidado: null,
    })
  }

  // Busca análises individuais
  const { data: chamados } = await supabase
    .from('digisac_chamados_analise_ia')
    .select(`
      id,
      digisac_ticket_id,
      status,
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
      transcript_truncado,
      transcript_tamanho_chars,
      total_mensagens,
      modelo_ia,
      erro_mensagem,
      analisado_em
    `)
    .eq('fila_id', job.id)
    .order('created_at', { ascending: true })

  // Enriquece com protocolo e data do ticket
  const ticketIds = (chamados ?? []).map((c) => c.digisac_ticket_id)
  let ticketInfoMap: Record<string, { protocolo: string | null; started_at: string | null }> = {}
  if (ticketIds.length > 0) {
    const { data: conversas } = await supabase
      .from('digisac_conversas_resumo')
      .select('digisac_ticket_id, protocolo, started_at')
      .in('digisac_ticket_id', ticketIds)
    for (const c of (conversas ?? [])) {
      ticketInfoMap[c.digisac_ticket_id] = { protocolo: c.protocolo, started_at: c.started_at }
    }
  }

  const chamadosEnriquecidos = (chamados ?? [])
    .map((c) => ({
      ...c,
      protocolo: ticketInfoMap[c.digisac_ticket_id]?.protocolo ?? null,
      data_chamado: ticketInfoMap[c.digisac_ticket_id]?.started_at ?? null,
    }))
    .sort((a, b) => {
      if (!a.data_chamado && !b.data_chamado) return 0
      if (!a.data_chamado) return 1
      if (!b.data_chamado) return -1
      return new Date(a.data_chamado).getTime() - new Date(b.data_chamado).getTime()
    })

  // Busca consolidado
  const { data: consolidado } = await supabase
    .from('venda_analise_comercial_ia')
    .select('*')
    .eq('numero_lancamento', numeroLancamento)
    .maybeSingle()

  return NextResponse.json({
    status: job.status,
    job: {
      id: job.id,
      status: job.status,
      totalChamados: job.total_chamados,
      chamadosProcessados: job.chamados_processados,
      chamadosComErro: job.chamados_com_erro,
      solicitadoPor: job.solicitado_por,
      iniciadoEm: job.iniciado_em,
      finalizadoEm: job.finalizado_em,
      erroMensagem: job.erro_mensagem,
    },
    chamados: chamadosEnriquecidos,
    consolidado,
  })
}
