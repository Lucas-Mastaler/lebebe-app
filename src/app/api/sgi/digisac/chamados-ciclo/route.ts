import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const numeroLancamento = searchParams.get('numeroLancamento')

  if (!numeroLancamento) {
    return NextResponse.json({ error: 'numeroLancamento é obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: vinculos, error } = await supabase
    .from('venda_conversa_vinculos')
    .select('digisac_ticket_id, inicio_chamado, telefone_normalizado, telefone_normalizado_ddi, data_conversa')
    .eq('numero_lancamento', numeroLancamento)
    .eq('considerada_no_ciclo_venda', true)

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar vínculos' }, { status: 500 })
  }

  const ticketIds = (vinculos ?? []).map((v) => v.digisac_ticket_id)

  const conversaMap: Record<string, { protocolo: string | null; started_at: string | null; department_nome: string | null }> = {}
  if (ticketIds.length > 0) {
    const { data: conversas } = await supabase
      .from('digisac_conversas_resumo')
      .select('digisac_ticket_id, protocolo, started_at, department_nome')
      .in('digisac_ticket_id', ticketIds)
    for (const c of (conversas ?? [])) {
      conversaMap[c.digisac_ticket_id] = {
        protocolo: c.protocolo,
        started_at: c.started_at,
        department_nome: c.department_nome,
      }
    }
  }

  const chamados = (vinculos ?? [])
    .map((v) => ({
      digisac_ticket_id: v.digisac_ticket_id,
      protocolo: conversaMap[v.digisac_ticket_id]?.protocolo ?? null,
      data_inicio: conversaMap[v.digisac_ticket_id]?.started_at ?? v.data_conversa ?? null,
      tipo_chamado: v.inicio_chamado ?? null,
      telefone: v.telefone_normalizado ?? null,
      telefone_ddi: v.telefone_normalizado_ddi ?? null,
      departamento: conversaMap[v.digisac_ticket_id]?.department_nome ?? null,
    }))
    .sort((a, b) => {
      if (!a.data_inicio && !b.data_inicio) return 0
      if (!a.data_inicio) return 1
      if (!b.data_inicio) return -1
      return new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime()
    })

  return NextResponse.json({ chamados })
}
