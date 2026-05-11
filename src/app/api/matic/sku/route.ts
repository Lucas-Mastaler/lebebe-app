import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// GET /api/matic/sku — busca paginada de produtos em matic_sku
export async function GET(request: NextRequest) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

  const supabase = await createClient()

  let query = supabase
    .from('matic_sku')
    .select(
      'codigo_produto, descricao, corredor_sugerido, nivel_sugerido, prateleira_sugerida, ativo, ref_meia, ref_inteira, volumes_por_item, updated_at',
      { count: 'exact' }
    )

  if (q) {
    query = query.or(
      `descricao.ilike.%${q}%,codigo_produto.ilike.%${q}%,ref_meia.ilike.%${q}%,ref_inteira.ilike.%${q}%`
    )
  }

  query = query.order('descricao', { ascending: true })

  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('[LOG][SKU_GET] Erro ao buscar matic_sku:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}
