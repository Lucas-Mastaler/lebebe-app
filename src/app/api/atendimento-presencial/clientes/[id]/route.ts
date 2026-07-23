import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAtendimentoPresencialClientesAccess } from '@/lib/atendimento-presencial/api-auth'
import {
  serializarClientePresencial,
  validarAtualizacaoTelefoneCliente,
  type ClientePresencialRow,
} from '@/lib/atendimento-presencial/clientes'
import { mascararTelefoneParaLog } from '@/lib/atendimento-presencial/telefone'

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
  'origem_consultora_nome',
  'origem_consultora_usuario_id',
  'origem_unidade_id',
  'origem_atendimento_id',
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

export async function PATCH(
  request: Request,
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, message: 'Payload invalido' },
        { status: 400 }
      )
    }

    const validacao = validarAtualizacaoTelefoneCliente(body)
    if (!validacao.ok) {
      return NextResponse.json(
        { ok: false, message: validacao.message, field: validacao.field },
        { status: 422 }
      )
    }

    const supabase = createServiceClient()
    if (validacao.telefoneNormalizado) {
      const { data: existente, error: existenteError } = await supabase
        .from('atendimento_presencial_clientes')
        .select('id')
        .eq('status', 'ativo')
        .eq('telefone_normalizado', validacao.telefoneNormalizado)
        .neq('id', id)
        .maybeSingle()

      if (existenteError) {
        console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro ao verificar duplicidade de telefone:', existenteError)
        return NextResponse.json(
          { ok: false, message: 'Erro ao processar requisicao' },
          { status: 500 }
        )
      }

      if (existente) {
        console.warn(
          `[ATENDIMENTO PRESENCIAL CLIENTES] telefone duplicado=${mascararTelefoneParaLog(validacao.telefoneInformado)}`
        )
        return NextResponse.json(
          { ok: false, message: 'Telefone ja cadastrado em outra cliente', field: 'telefone' },
          { status: 409 }
        )
      }
    }

    const { data: atualizado, error: updateError } = await supabase
      .from('atendimento_presencial_clientes')
      .update({
        telefone_informado: validacao.telefoneInformado,
        telefone_normalizado: validacao.telefoneNormalizado,
        telefone_normalizado_ddi: validacao.telefoneNormalizadoDDI,
        atualizado_por: auth.allowedUser.id,
      })
      .eq('id', id)
      .eq('status', 'ativo')
      .eq('version', validacao.version)
      .select(SELECT_CLIENTE)
      .maybeSingle()

    if (updateError) {
      if (updateError.code === '23505' && validacao.telefoneNormalizado) {
        return NextResponse.json(
          { ok: false, message: 'Telefone ja cadastrado em outra cliente', field: 'telefone' },
          { status: 409 }
        )
      }
      console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro ao atualizar telefone:', updateError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisicao' },
        { status: 500 }
      )
    }

    if (!atualizado) {
      const { data: atual } = await supabase
        .from('atendimento_presencial_clientes')
        .select(SELECT_CLIENTE)
        .eq('id', id)
        .maybeSingle()

      return NextResponse.json(
        {
          ok: false,
          message: 'Conflito de versao',
          cliente: atual ? serializarClientePresencial(atual as unknown as ClientePresencialRow) : null,
        },
        { status: 409 }
      )
    }

    console.log(
      `[ATENDIMENTO PRESENCIAL CLIENTES] telefone atualizado=${mascararTelefoneParaLog(validacao.telefoneInformado)} usuario=${auth.allowedUser.id}`
    )

    return NextResponse.json({
      ok: true,
      cliente: serializarClientePresencial(atualizado as unknown as ClientePresencialRow),
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro geral no PATCH de telefone:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisicao' },
      { status: 500 }
    )
  }
}
