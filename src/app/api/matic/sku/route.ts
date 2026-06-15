import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { normalizeCode } from '@/lib/matic/normalize-code'

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

// POST /api/matic/sku — cria um novo SKU em matic_sku
export async function POST(request: NextRequest) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await request.json()

  // Validar campos obrigatórios
  const codigoRaw = body.codigo_produto
  if (!codigoRaw || typeof codigoRaw !== 'string' || codigoRaw.trim() === '') {
    return NextResponse.json({ error: 'codigo_produto é obrigatório' }, { status: 400 })
  }
  const codigoProduto = normalizeCode(codigoRaw)

  const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : ''

  const volumesPorItem =
    typeof body.volumes_por_item === 'number' && Number.isInteger(body.volumes_por_item) && body.volumes_por_item >= 1
      ? body.volumes_por_item
      : 1

  const ativo = typeof body.ativo === 'boolean' ? body.ativo : true

  // ref_meia / ref_inteira: string ou null
  const refMeia = body.ref_meia === null || body.ref_meia === '' ? null : typeof body.ref_meia === 'string' ? body.ref_meia.trim() : null
  const refInteira = body.ref_inteira === null || body.ref_inteira === '' ? null : typeof body.ref_inteira === 'string' ? body.ref_inteira.trim() : null

  const supabase = await createClient()

  // Verificar duplicados antes de criar
  const { data: existentes } = await supabase
    .from('matic_sku')
    .select('codigo_produto, ref_meia, ref_inteira')

  const conflitos: string[] = []
  for (const sku of (existentes || [])) {
    if (sku.codigo_produto === codigoProduto) {
      conflitos.push(`codigo_produto "${codigoProduto}"`)
    }
    if (refMeia && sku.ref_meia && normalizeCode(sku.ref_meia) === normalizeCode(refMeia)) {
      conflitos.push(`ref_meia "${refMeia}" (normalizada)`)
    }
    if (refInteira && sku.ref_inteira && normalizeCode(sku.ref_inteira) === normalizeCode(refInteira)) {
      conflitos.push(`ref_inteira "${refInteira}" (normalizada)`)
    }
  }

  if (conflitos.length > 0) {
    return NextResponse.json(
      { error: 'SKU já existe', detalhes: `Já existe SKU com: ${[...new Set(conflitos)].join(', ')}. Use PATCH no SKU existente.` },
      { status: 409 }
    )
  }

  const insertData = {
    codigo_produto: codigoProduto,
    descricao,
    ativo,
    volumes_por_item: volumesPorItem,
    ref_meia: refMeia,
    ref_inteira: refInteira,
    updated_at: new Date().toISOString(),
  }

  console.log(
    `[LOG][SKU_CREATE] user=${auth.email} codigo=${codigoProduto} ref_meia=${refMeia} ref_inteira=${refInteira} descricao="${descricao}" volumes=${volumesPorItem}`
  )

  const { data, error } = await supabase
    .from('matic_sku')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('[LOG][SKU_CREATE] Erro ao inserir matic_sku:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
