import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAtendimentoPresencialClientesAccess } from '@/lib/atendimento-presencial/api-auth'
import {
  detectarTipoBuscaCliente,
  escaparTermoIlike,
  normalizarTermosBuscaNome,
  normalizarTrechoBuscaTelefone,
  normalizarTermoBusca,
  serializarClientePresencial,
  validarPayloadCliente,
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
  'created_at',
  'updated_at',
].join(', ')

function limitarResultado(valor: string | null) {
  const parsed = Number.parseInt(valor ?? '', 10)
  if (Number.isNaN(parsed)) return 10
  return Math.min(Math.max(parsed, 1), 30)
}

export async function GET(request: Request) {
  try {
    const auth = await requireAtendimentoPresencialClientesAccess()
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const termo = normalizarTermoBusca(url.searchParams.get('q'))
    const telefoneParam = normalizarTermoBusca(url.searchParams.get('telefone'))
    const nomeParam = normalizarTermoBusca(url.searchParams.get('nome'))
    const limit = limitarResultado(url.searchParams.get('limit'))
    const page = Math.max(Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1, 1)
    const from = (page - 1) * limit
    const to = from + limit - 1

    const tipoBusca = telefoneParam
      ? 'telefone'
      : nomeParam
      ? 'nome'
      : detectarTipoBuscaCliente(termo)

    if (tipoBusca === 'mista_invalida') {
      return NextResponse.json(
        { ok: false, message: 'Busca invalida. Use apenas nome ou apenas telefone.' },
        { status: 422 }
      )
    }

    const telefoneBusca = tipoBusca === 'telefone' ? (telefoneParam || termo) : ''
    const nomeBusca = tipoBusca === 'nome' ? (nomeParam || termo) : ''
    const telefoneTrecho = normalizarTrechoBuscaTelefone(telefoneBusca)
    const termosNome = normalizarTermosBuscaNome(nomeBusca)

    if (tipoBusca === 'telefone' && !telefoneTrecho) {
      return NextResponse.json({
        ok: true,
        clientes: [],
        meta: { page, limit, total: 0 },
      })
    }

    if (tipoBusca === 'nome' && termosNome.some((item) => item.length < 2)) {
      return NextResponse.json(
        { ok: false, message: 'Busca por nome deve ter ao menos 2 caracteres' },
        { status: 422 }
      )
    }

    if (tipoBusca === 'vazia' || (!telefoneTrecho && termosNome.length === 0)) {
      return NextResponse.json({
        ok: true,
        clientes: [],
        meta: { page, limit, total: 0 },
      })
    }

    const supabase = createServiceClient()
    let query = supabase
      .from('atendimento_presencial_clientes')
      .select(SELECT_CLIENTE, { count: 'exact' })
      .eq('status', 'ativo')

    if (telefoneTrecho) {
      const trechoEscapado = escaparTermoIlike(telefoneTrecho)
      query = query.or(
        `telefone_normalizado.ilike.%${trechoEscapado}%,telefone_normalizado_ddi.ilike.%${trechoEscapado}%`
      )
      console.log(
        `[ATENDIMENTO PRESENCIAL CLIENTES] busca telefone=${mascararTelefoneParaLog(telefoneBusca)} usuario=${auth.allowedUser.id}`
      )
    } else {
      for (const termoNome of termosNome) {
        query = query.ilike('nome', `%${escaparTermoIlike(termoNome)}%`)
      }
      console.log(`[ATENDIMENTO PRESENCIAL CLIENTES] busca nome usuario=${auth.allowedUser.id}`)
    }

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro ao buscar clientes:', error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisicao' },
        { status: 500 }
      )
    }

    const clientes = ((data ?? []) as unknown as ClientePresencialRow[]).map((row) => ({
      ...serializarClientePresencial(row),
      correspondenciaExataTelefone:
        Boolean(telefoneTrecho) &&
        Boolean(row.telefone_normalizado?.includes(telefoneTrecho) || row.telefone_normalizado_ddi?.includes(telefoneTrecho)),
    }))

    return NextResponse.json({
      ok: true,
      clientes,
      meta: { page, limit, total: count ?? clientes.length },
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro geral no GET:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisicao' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAtendimentoPresencialClientesAccess()
    if (!auth.ok) return auth.response

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, message: 'Payload invalido' },
        { status: 400 }
      )
    }

    const validacao = validarPayloadCliente(body)
    if (!validacao.ok) {
      console.warn(`[ATENDIMENTO PRESENCIAL CLIENTES] validacao falhou field=${validacao.field}`)
      return NextResponse.json(
        { ok: false, message: validacao.message, field: validacao.field },
        { status: 422 }
      )
    }

    const supabase = createServiceClient()

    if (validacao.telefoneNormalizado) {
      const { data: existente, error: existenteError } = await supabase
        .from('atendimento_presencial_clientes')
        .select(SELECT_CLIENTE)
        .eq('status', 'ativo')
        .eq('telefone_normalizado', validacao.telefoneNormalizado)
        .maybeSingle()

      if (existenteError) {
        console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro ao verificar duplicidade:', existenteError)
        return NextResponse.json(
          { ok: false, message: 'Erro ao processar requisicao' },
          { status: 500 }
        )
      }

      if (existente) {
        console.log(
          `[ATENDIMENTO PRESENCIAL CLIENTES] cliente existente telefone=${mascararTelefoneParaLog(validacao.telefoneInformado)}`
        )
        return NextResponse.json({
          ok: true,
          cliente: serializarClientePresencial(existente as unknown as ClientePresencialRow),
          clienteExistente: true,
        })
      }
    }

    const insertPayload = {
      nome: validacao.nome,
      telefone_informado: validacao.telefoneInformado,
      telefone_normalizado: validacao.telefoneNormalizado,
      telefone_normalizado_ddi: validacao.telefoneNormalizadoDDI,
      parentesco: validacao.parentesco,
      parentesco_outro: validacao.parentescoOutro,
      criado_por: auth.allowedUser.id,
      atualizado_por: auth.allowedUser.id,
    }

    const { data: criado, error: insertError } = await supabase
      .from('atendimento_presencial_clientes')
      .insert(insertPayload)
      .select(SELECT_CLIENTE)
      .single()

    if (insertError) {
      if (insertError.code === '23505' && validacao.telefoneNormalizado) {
        const { data: existenteAposConflito, error: conflitoSelectError } = await supabase
          .from('atendimento_presencial_clientes')
          .select(SELECT_CLIENTE)
          .eq('status', 'ativo')
          .eq('telefone_normalizado', validacao.telefoneNormalizado)
          .single()

        if (!conflitoSelectError && existenteAposConflito) {
          console.warn(
            `[ATENDIMENTO PRESENCIAL CLIENTES] conflito concorrente telefone=${mascararTelefoneParaLog(validacao.telefoneInformado)}`
          )
          return NextResponse.json({
            ok: true,
          cliente: serializarClientePresencial(existenteAposConflito as unknown as ClientePresencialRow),
            clienteExistente: true,
          })
        }
      }

      console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro ao criar cliente:', insertError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisicao' },
        { status: 500 }
      )
    }

    console.log(`[ATENDIMENTO PRESENCIAL CLIENTES] cliente criado usuario=${auth.allowedUser.id}`)

    return NextResponse.json(
      {
        ok: true,
        cliente: serializarClientePresencial(criado as unknown as ClientePresencialRow),
        clienteExistente: false,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro geral no POST:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisicao' },
      { status: 500 }
    )
  }
}
