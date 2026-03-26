import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// POST /api/recebimento/problemas-pendentes/resolver — marca problemas como resolvidos
export async function POST(request: NextRequest) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { problema_ids } = body

  if (!problema_ids || !Array.isArray(problema_ids) || problema_ids.length === 0) {
    return NextResponse.json({ error: 'IDs de problemas não fornecidos' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('recebimento_problemas_pendentes')
    .update({
      resolvido: true,
      resolvido_em: new Date().toISOString(),
      resolvido_por: auth.userId,
    })
    .in('id', problema_ids)

  if (error) {
    console.error('[LOG] Erro ao marcar problemas como resolvidos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[LOG] ${problema_ids.length} problema(s) marcado(s) como resolvido(s) por ${auth.email}`)

  return NextResponse.json({ message: 'Problemas marcados como resolvidos' })
}
