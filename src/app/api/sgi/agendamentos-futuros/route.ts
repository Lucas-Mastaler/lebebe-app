import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import { buscarAgendamentosFuturos } from '@/lib/digisac/buscarAgendamentosPorTelefones'

export const runtime = 'nodejs'

/**
 * GET /api/sgi/agendamentos-futuros?numeroLancamento=XXXXX
 *
 * Retorna agendamentos futuros no Digisac vinculados ao cliente da venda,
 * filtrando scheduledAt > data_fechamento da venda.
 *
 * Sem migration. Sem tabela nova. Consulta em tempo real.
 */
export async function GET(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const numeroLancamento = searchParams.get('numeroLancamento')?.trim()

  if (!numeroLancamento) {
    return NextResponse.json({ error: 'numeroLancamento é obrigatório' }, { status: 400 })
  }

  console.log(`[AGENDAMENTOS-FUTUROS] numeroLancamento=${numeroLancamento}`)

  const supabase = await createClient()

  // 1. Buscar a data de fechamento da venda
  const { data: doc, error: docError } = await supabase
    .from('sgi_documentos_saida')
    .select('data_fechamento')
    .eq('numero_lancamento', numeroLancamento)
    .single()

  if (docError || !doc) {
    console.error(`[AGENDAMENTOS-FUTUROS] Venda não encontrada:`, docError)
    return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
  }

  const dataFechamento = doc.data_fechamento
  if (!dataFechamento) {
    console.warn(`[AGENDAMENTOS-FUTUROS] Venda ${numeroLancamento} sem data_fechamento.`)
    return NextResponse.json({ agendamentos: [], total: 0 })
  }

  console.log(`[AGENDAMENTOS-FUTUROS] data_fechamento=${dataFechamento}`)

  // 2. Buscar telefones da venda
  const { data: contatos, error: contatosError } = await supabase
    .from('sgi_documentos_saida_contatos')
    .select('telefone_normalizado, telefone_normalizado_ddi')
    .eq('numero_lancamento', numeroLancamento)

  if (contatosError) {
    console.error(`[AGENDAMENTOS-FUTUROS] Erro ao buscar contatos:`, contatosError)
    return NextResponse.json({ error: 'Erro ao buscar contatos da venda' }, { status: 500 })
  }

  if (!contatos || contatos.length === 0) {
    console.warn(`[AGENDAMENTOS-FUTUROS] Nenhum contato encontrado para ${numeroLancamento}`)
    return NextResponse.json({ agendamentos: [], total: 0 })
  }

  // 3. Coletar todos os telefones (normalizado + com DDI)
  const telefones: string[] = []
  for (const c of contatos) {
    if (c.telefone_normalizado) telefones.push(c.telefone_normalizado)
    if (c.telefone_normalizado_ddi) telefones.push(c.telefone_normalizado_ddi)
  }

  const telefonesUnicos = Array.from(new Set(telefones.filter(Boolean)))
  console.log(`[AGENDAMENTOS-FUTUROS] Telefones únicos:`, telefonesUnicos)

  if (telefonesUnicos.length === 0) {
    return NextResponse.json({ agendamentos: [], total: 0 })
  }

  // 4. Buscar agendamentos futuros no Digisac
  try {
    const agendamentos = await buscarAgendamentosFuturos(telefonesUnicos, dataFechamento)
    console.log(`[AGENDAMENTOS-FUTUROS] Resultado final: ${agendamentos.length} agendamento(s) futuros`)
    return NextResponse.json({ agendamentos, total: agendamentos.length })
  } catch (err: any) {
    console.error(`[AGENDAMENTOS-FUTUROS] Erro ao buscar agendamentos:`, err)

    if (err.message?.includes('autenticação')) {
      return NextResponse.json({ error: 'Falha de autenticação com Digisac' }, { status: 401 })
    }
    if (err.message?.includes('Rate Limit')) {
      return NextResponse.json({ error: 'Muitas requisições ao Digisac. Tente novamente.' }, { status: 429 })
    }

    return NextResponse.json({ error: 'Erro ao buscar agendamentos futuros' }, { status: 500 })
  }
}
