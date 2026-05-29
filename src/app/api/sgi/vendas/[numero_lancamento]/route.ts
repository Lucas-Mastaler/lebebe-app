import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import type { SgiVendaDetalhe } from '@/types/sgi'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ numero_lancamento: string }> }
) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { numero_lancamento } = await params

  if (!numero_lancamento?.trim()) {
    return NextResponse.json({ error: 'Número de lançamento obrigatório' }, { status: 400 })
  }

  console.log('[API][SGI][VENDA] GET numero_lancamento=', numero_lancamento)

  const supabase = await createClient()

  const { data: doc, error: docError } = await supabase
    .from('sgi_documentos_saida')
    .select('*')
    .eq('numero_lancamento', numero_lancamento.trim())
    .single()

  if (docError || !doc) {
    console.error('[API][SGI][VENDA] Não encontrado:', docError)
    return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
  }

  const [contatosResult, produtosResult, pagamentosResult] = await Promise.all([
    supabase
      .from('sgi_documentos_saida_contatos')
      .select('id, documento_saida_id, numero_lancamento, telefone_original, telefone_normalizado, telefone_normalizado_ddi, principal')
      .eq('documento_saida_id', doc.id)
      .order('principal', { ascending: false }),
    supabase
      .from('sgi_documentos_saida_produtos')
      .select('id, documento_saida_id, numero_lancamento, codigo, produto, local_estocagem, quantidade, quantidade_texto, valor_total, valor_total_texto, categoria_sugerida')
      .eq('documento_saida_id', doc.id),
    supabase
      .from('sgi_documentos_saida_pagamentos')
      .select('id, documento_saida_id, numero_lancamento, forma_pagamento, numero_parcelas, numero_parcelas_texto, percentual, percentual_texto, valor, valor_texto, nsu, numero_autorizacao')
      .eq('documento_saida_id', doc.id),
  ])

  const detalhe: SgiVendaDetalhe = {
    ...doc,
    contatos_lista: contatosResult.data ?? [],
    produtos: produtosResult.data ?? [],
    pagamentos: pagamentosResult.data ?? [],
  }

  return NextResponse.json(detalhe)
}
