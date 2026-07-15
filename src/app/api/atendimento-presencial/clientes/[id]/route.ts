import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAtendimentoPresencialClientesAccess } from '@/lib/atendimento-presencial/api-auth'
import { serializarClientePresencial, type ClientePresencialRow } from '@/lib/atendimento-presencial/clientes'

export const runtime = 'nodejs'

const SELECT_CLIENTE = [
  'id',
  'nome',
  'telefone_informado',
  'telefone_normalizado',
  'telefone_normalizado_ddi',
  'parentesco',
  'parentesco_outro',
  'status',
  'version',
  'created_at',
  'updated_at',
].join(', ')

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAtendimentoPresencialClientesAccess()
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!id?.trim()) {
      return NextResponse.json(
        { ok: false, message: 'ID da cliente e obrigatorio' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('atendimento_presencial_clientes')
      .select(SELECT_CLIENTE)
      .eq('id', id)
      .eq('status', 'ativo')
      .maybeSingle()

    if (error) {
      console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro ao buscar cliente por ID:', error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisicao' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, message: 'Cliente nao encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      cliente: serializarClientePresencial(data as unknown as ClientePresencialRow),
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro geral no GET por ID:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisicao' },
      { status: 500 }
    )
  }
}
