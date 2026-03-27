import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

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
