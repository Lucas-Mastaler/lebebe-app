import { NextRequest, NextResponse } from 'next/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import { buscarMensagensTicketPaginado } from '@/lib/digisac/sgi-sync'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const ticketId = searchParams.get('ticketId')

  if (!ticketId) {
    return NextResponse.json({ error: 'ticketId é obrigatório' }, { status: 400 })
  }

  try {
    const { mensagens, incompleto } = await buscarMensagensTicketPaginado(ticketId)

    const mensagensSimplificadas = mensagens.map((m) => ({
      id: m.id,
      text: m.text ?? '',
      isFromMe: m.isFromMe ?? false,
      timestamp: m.timestamp ?? null,
    }))

    return NextResponse.json({
      mensagens: mensagensSimplificadas,
      total: mensagensSimplificadas.length,
      incompleto,
    })
  } catch (err) {
    console.error('[api/digisac/mensagens] erro:', err instanceof Error ? err.message : 'erro desconhecido')
    return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 })
  }
}
