import { NextRequest, NextResponse } from 'next/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { CATEGORIAS, normalizarDescricao, type Categoria } from '@/lib/recebimento/categorias'

export async function GET() {
  const auth = await validateMaticUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const db = createServiceClient()
  const decisoes: Record<string, string> = {}
  const tamanho = 500
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await db.from('recebimento_categorias_decisoes').select('descricao_normalizada,categoria').order('descricao_normalizada').range(pagina * tamanho, pagina * tamanho + tamanho - 1)
    if (error) return NextResponse.json({ error: 'Não foi possível carregar as classificações.' }, { status: 500 })
    for (const row of data || []) decisoes[row.descricao_normalizada] = row.categoria
    if (!data || data.length < tamanho) break
  }
  return NextResponse.json(decisoes)
}

export async function PUT(request: NextRequest) {
  const auth = await validateMaticUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (typeof body.descricao !== 'string' || !body.descricao.trim() || body.descricao.length > 500 || typeof body.categoria !== 'string' || !Object.hasOwn(CATEGORIAS, body.categoria)) return NextResponse.json({ error: 'Descrição ou categoria inválida.' }, { status: 400 })
  const db = createServiceClient()
  const descricao = normalizarDescricao(body.descricao)
  const { error } = await db.from('recebimento_categorias_decisoes').upsert({ descricao_normalizada: descricao, categoria: body.categoria as Categoria, updated_at: new Date().toISOString(), updated_by: auth.userId || null }, { onConflict: 'descricao_normalizada' })
  if (error) return NextResponse.json({ error: 'Não foi possível salvar a classificação.' }, { status: 500 })
  return NextResponse.json({ descricao, categoria: body.categoria })
}
