import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'

function normalizarPagina(value: string | null): number {
  const pagina = Number.parseInt(value || '1', 10)
  return Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1
}

// GET /api/recebimento/problemas-pendentes — lista problemas não resolvidos
export async function GET(request: Request) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const supabase = await createClient()

  // Verificar se quer apenas não resolvidos (para modal de finalização)
  const { searchParams } = new URL(request.url)
  const apenasNaoResolvidos = searchParams.get('apenas_nao_resolvidos') === 'true'
  const resolvidoParam = searchParams.get('resolvido')

  // Paginação exclusiva da aba raiz. O parâmetro legado
  // `apenas_nao_resolvidos=true` permanece sem limite para não esconder
  // pendências no fluxo de recebimento em andamento.
  if (resolvidoParam === 'true' || resolvidoParam === 'false') {
    const resolvido = resolvidoParam === 'true'
    const pagina = normalizarPagina(searchParams.get('page'))
    const inicio = (pagina - 1) * TABLE_PAGE_SIZE
    const fim = inicio + TABLE_PAGE_SIZE - 1

    const { data: problemas, error, count } = await supabase
      .from('recebimento_problemas_pendentes')
      .select(`
        *,
        recebimento:recebimento_id(
          periodo_inicio,
          periodo_fim,
          recebimento_nfes(
            nfe:nfe_id(numero_nf)
          )
        )
      `, { count: 'exact' })
      .eq('resolvido', resolvido)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(inicio, fim)

    if (error) {
      console.error('[LOG] Erro ao buscar problemas pendentes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const total = count || 0
    return NextResponse.json({
      data: problemas || [],
      pagination: {
        page: pagina,
        limit: TABLE_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / TABLE_PAGE_SIZE),
      },
    })
  }

  // Buscar problemas com informações do recebimento
  const query = supabase
    .from('recebimento_problemas_pendentes')
    .select(`
      *,
      recebimento:recebimento_id(
        periodo_inicio,
        periodo_fim,
        recebimento_nfes(
          nfe:nfe_id(numero_nf)
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (apenasNaoResolvidos) {
    query.eq('resolvido', false)
  }

  const { data: problemas, error } = await query

  if (error) {
    console.error('[LOG] Erro ao buscar problemas pendentes:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(problemas || [])
}

// POST /api/recebimento/problemas-pendentes — cria pendência global manual
export async function POST(request: Request) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : ''
  if (!descricao) {
    return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: problema, error } = await supabase
    .from('recebimento_problemas_pendentes')
    .insert({ descricao })
    .select('id, recebimento_id, descricao, resolvido, created_at')
    .single()

  if (error) {
    console.error('[LOG] Erro ao criar problema pendente:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(problema, { status: 201 })
}
