import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const access = await requireModuleAccess('pos_venda_atendimento_automatico')
  if (!access.ok) return access.response

  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const tipoSolicitacao = searchParams.get('tipo_solicitacao')
    const busca = searchParams.get('busca')

    let query = supabase
      .from('atendimento_automatico_sessoes')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('status', status)
    if (tipoSolicitacao) query = query.eq('tipo_solicitacao', tipoSolicitacao)
    if (busca) {
      query = query.or(`telefone.ilike.%${busca}%,digisac_ticket_id.ilike.%${busca}%,digisac_contact_id.ilike.%${busca}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[posvenda-listar] erro:', error)
      return NextResponse.json({ ok: false, message: 'Erro ao listar sessoes' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, sessoes: data ?? [] })
  } catch (err) {
    console.error('[posvenda-listar] erro inesperado:', err)
    return NextResponse.json({ ok: false, message: 'Erro interno' }, { status: 500 })
  }
}
