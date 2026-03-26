import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// GET /api/recebimento/problemas-pendentes — lista problemas não resolvidos
export async function GET() {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recebimento_problemas_pendentes')
    .select('*')
    .eq('resolvido', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[LOG] Erro ao buscar problemas pendentes:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
