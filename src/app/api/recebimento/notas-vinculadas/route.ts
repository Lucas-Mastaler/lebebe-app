import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'

function normalizarPagina(value: string | null): number {
  const pagina = Number.parseInt(value || '1', 10)
  return Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1
}

// GET /api/recebimento/notas-vinculadas — lista NFs paginadas com filtros
export async function GET(request: NextRequest) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const pagina = normalizarPagina(searchParams.get('page'))
  const dataInicio = searchParams.get('data_inicio')
  const dataFim = searchParams.get('data_fim')
  const numeroNf = searchParams.get('numero_nf')?.replace(/\D/g, '')
  const supabase = await createClient()

  let query = supabase
    .from('nfe')
    .select(`
      id,
      numero_nf,
      data_emissao,
      peso_total,
      volumes_total,
      is_os,
      created_at,
      recebimento_nfes(nfe_id)
    `, { count: 'exact' })

  if (dataInicio) query = query.gte('data_emissao', dataInicio)
  if (dataFim) query = query.lte('data_emissao', dataFim)
  if (numeroNf) query = query.ilike('numero_nf', `%${numeroNf}%`)

  const inicio = (pagina - 1) * TABLE_PAGE_SIZE
  const fim = inicio + TABLE_PAGE_SIZE - 1
  const { data, error, count } = await query
    .order('numero_nf', { ascending: false })
    .range(inicio, fim)

  if (error) {
    console.error('[LOG] Erro ao listar notas vinculadas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const total = count || 0
  return NextResponse.json({
    data: (data || []).map((nfe) => ({
      ...nfe,
      is_vinculada: (nfe.recebimento_nfes?.length ?? 0) > 0,
      recebimento_nfes: undefined,
    })),
    pagination: {
      page: pagina,
      limit: TABLE_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / TABLE_PAGE_SIZE),
    },
  })
}
