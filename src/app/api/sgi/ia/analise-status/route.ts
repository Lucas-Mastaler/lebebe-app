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
      analisado_em,
      nome_bebe,
      previsao_nascimento_bebe
    `)
    .eq('fila_id', job.id)
    .order('created_at', { ascending: true })

  // Enriquece com protocolo, data, tipo, telefone, loja e consultora
  const ticketIds = (chamados ?? []).map((c) => c.digisac_ticket_id)
  const ticketInfoMap: Record<string, { protocolo: string | null; started_at: string | null; telefone_normalizado: string | null; department_nome: string | null; user_nome: string | null }> = {}
  const vinculoMap: Record<string, { inicio_chamado: string | null; ordem_conversa_para_venda: number | null }> = {}

  if (ticketIds.length > 0) {
    const { data: conversas } = await supabase
      .from('digisac_conversas_resumo')
      .select('digisac_ticket_id, protocolo, started_at, telefone_normalizado, department_nome, user_nome')
      .in('digisac_ticket_id', ticketIds)
    for (const c of (conversas ?? [])) {
      ticketInfoMap[c.digisac_ticket_id] = {
        protocolo: c.protocolo,
        started_at: c.started_at,
        telefone_normalizado: c.telefone_normalizado,
        department_nome: c.department_nome ?? null,
        user_nome: c.user_nome ?? null,
      }
    }

    const { data: vinculos } = await supabase
      .from('venda_conversa_vinculos')
      .select('digisac_ticket_id, inicio_chamado, ordem_conversa_para_venda')
      .eq('numero_lancamento', numeroLancamento)
      .in('digisac_ticket_id', ticketIds)
    for (const v of (vinculos ?? [])) {
      vinculoMap[v.digisac_ticket_id] = {
        inicio_chamado: v.inicio_chamado,
        ordem_conversa_para_venda: v.ordem_conversa_para_venda ?? null,
      }
    }
  }

  const chamadosEnriquecidos = (chamados ?? [])
    .map((c) => ({
      ...c,
      protocolo: ticketInfoMap[c.digisac_ticket_id]?.protocolo ?? null,
      data_chamado: ticketInfoMap[c.digisac_ticket_id]?.started_at ?? null,
      telefone: ticketInfoMap[c.digisac_ticket_id]?.telefone_normalizado ?? null,
      tipo_chamado: vinculoMap[c.digisac_ticket_id]?.inicio_chamado ?? null,
      ordem_ciclo: vinculoMap[c.digisac_ticket_id]?.ordem_conversa_para_venda ?? null,
      department_nome: ticketInfoMap[c.digisac_ticket_id]?.department_nome ?? null,
      user_nome: ticketInfoMap[c.digisac_ticket_id]?.user_nome ?? null,
    }))
    .sort((a, b) => {
      // Ordena pela mesma ordem usada pela IA no prompt consolidado
      // (ordem_conversa_para_venda) com fallback para started_at
      const aOrdem = a.ordem_ciclo ?? Number.MAX_SAFE_INTEGER
      const bOrdem = b.ordem_ciclo ?? Number.MAX_SAFE_INTEGER
      if (aOrdem !== bOrdem) return aOrdem - bOrdem
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
