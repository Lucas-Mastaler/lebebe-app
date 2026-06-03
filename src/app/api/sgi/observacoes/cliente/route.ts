import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'

// GET /api/sgi/observacoes/cliente?numeroLancamento=X
// Retorna todas as observações de outros lançamentos que compartilham telefone com este lançamento
export async function GET(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const numeroLancamento = request.nextUrl.searchParams.get('numeroLancamento')
  if (!numeroLancamento) return NextResponse.json({ error: 'numeroLancamento obrigatório' }, { status: 400 })

  const supabase = await createClient()

  // Busca telefones do lançamento atual
  const { data: contatosAtuais } = await supabase
    .from('sgi_documentos_saida_contatos')
    .select('telefone_normalizado_ddi')
    .eq('numero_lancamento', numeroLancamento)
    .not('telefone_normalizado_ddi', 'is', null)

  const telefones = (contatosAtuais ?? []).map((c) => c.telefone_normalizado_ddi).filter(Boolean)

  if (telefones.length === 0) {
    return NextResponse.json({ observacoes: [] })
  }

  // Busca outros lançamentos que têm esses telefones
  const { data: outrosContatos } = await supabase
    .from('sgi_documentos_saida_contatos')
    .select('numero_lancamento')
    .in('telefone_normalizado_ddi', telefones)
    .neq('numero_lancamento', numeroLancamento)

  const outrosLancamentos = [...new Set((outrosContatos ?? []).map((c) => c.numero_lancamento))]

  if (outrosLancamentos.length === 0) {
    return NextResponse.json({ observacoes: [] })
  }

  // Busca observações desses outros lançamentos
  const { data, error } = await supabase
    .from('inteligencia_comercial_observacoes')
    .select('id, numero_lancamento, cliente_nome, observacao, criado_por, created_at')
    .in('numero_lancamento', outrosLancamentos)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ observacoes: data ?? [] })
}
