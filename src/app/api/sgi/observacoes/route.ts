import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'

// GET /api/sgi/observacoes?numeroLancamento=X
export async function GET(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const numeroLancamento = request.nextUrl.searchParams.get('numeroLancamento')
  if (!numeroLancamento) return NextResponse.json({ error: 'numeroLancamento obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inteligencia_comercial_observacoes')
    .select('id, numero_lancamento, cliente_nome, observacao, criado_por, created_at, updated_at')
    .eq('numero_lancamento', numeroLancamento)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ observacoes: data ?? [] })
}

// POST /api/sgi/observacoes
export async function POST(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json()
  const { numeroLancamento, observacao } = body

  if (!numeroLancamento || !observacao?.trim()) {
    return NextResponse.json({ error: 'numeroLancamento e observacao são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()
  const supabaseAdmin = createServiceClient()

  // Busca id e cliente da venda
  const { data: venda } = await supabase
    .from('sgi_documentos_saida')
    .select('id, cliente')
    .eq('numero_lancamento', numeroLancamento)
    .single()

  // Busca telefones da venda
  const { data: contatos } = await supabase
    .from('sgi_documentos_saida_contatos')
    .select('telefone_normalizado_ddi')
    .eq('numero_lancamento', numeroLancamento)
    .not('telefone_normalizado_ddi', 'is', null)

  const { data: nova, error } = await supabaseAdmin
    .from('inteligencia_comercial_observacoes')
    .insert({
      documento_saida_id: venda?.id ?? null,
      numero_lancamento: numeroLancamento,
      cliente_nome: venda?.cliente ?? null,
      telefones_cliente_json: (contatos ?? []).map((c) => c.telefone_normalizado_ddi),
      observacao: observacao.trim(),
      criado_por: auth.email,
      atualizado_por: auth.email,
    })
    .select('id, numero_lancamento, cliente_nome, observacao, criado_por, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ observacao: nova })
}
