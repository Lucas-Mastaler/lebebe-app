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

const SELECT_CLIENTE_BASE = [
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

const SELECT_CLIENTE_COM_ORIGEM = [
  SELECT_CLIENTE_BASE,
  'origem_consultora_nome',
  'origem_consultora_usuario_id',
  'origem_unidade_id',
  'origem_atendimento_id',
].join(', ')

function limitarResultado(valor: string | null) {
  const parsed = Number.parseInt(valor ?? '', 10)
  if (Number.isNaN(parsed)) return 20
  return Math.min(Math.max(parsed, 1), 20)
}

function normalizarFiltroConsultora(valor: string | null) {
  return normalizarTermoBusca(valor) || ''
}

function isErroSchemaOrigemCliente(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '42703' && (error.message ?? '').includes('origem_')
}

async function carregarConsultorasOrigem(supabase: ReturnType<typeof createServiceClient>) {
  const { data, error } = await supabase
    .from('atendimento_presencial_clientes')
    .select('origem_consultora_nome')
    .eq('status', 'ativo')
    .not('origem_consultora_nome', 'is', null)
    .order('origem_consultora_nome', { ascending: true })

  if (isErroSchemaOrigemCliente(error)) return []
  if (error) throw error
  const nomes = new Set<string>()
  for (const row of (data ?? []) as Array<{ origem_consultora_nome: string | null }>) {
    const nome = normalizarFiltroConsultora(row.origem_consultora_nome)
    if (nome) nomes.add(nome)
  }
  return Array.from(nomes).map((nome) => ({ nome }))
}

async function carregarUnidadesPorId(
  supabase: ReturnType<typeof createServiceClient>,
  unidadeIds: string[]
) {
  if (unidadeIds.length === 0) return new Map<string, string>()
  const { data, error } = await supabase
    .from('app_unidades')
    .select('id, nome')
    .in('id', unidadeIds)

  if (error) throw error
  return new Map((data ?? []).map((unidade) => [unidade.id, unidade.nome]))
}

export async function GET(request: Request) {
  try {
    const auth = await requireAtendimentoPresencialClientesAccess()
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const termo = normalizarTermoBusca(url.searchParams.get('q'))
    const telefoneParam = normalizarTermoBusca(url.searchParams.get('telefone'))
    const nomeParam = normalizarTermoBusca(url.searchParams.get('nome'))
    const limit = limitarResultado(url.searchParams.get('pageSize') ?? url.searchParams.get('limit'))
    const page = Math.max(Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1, 1)
    const consultoraOrigem = normalizarFiltroConsultora(url.searchParams.get('consultoraOrigem'))
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

    if (termo && tipoBusca === 'vazia') {
      return NextResponse.json({
        ok: true,
        clientes: [],
        consultoras: [],
        meta: { page, pageSize: limit, total: 0, totalPages: 1 },
      })
    }

    const supabase = createServiceClient()
    const executarConsultaClientes = async (select: string, usarOrigem: boolean) => {
      let query = supabase
        .from('atendimento_presencial_clientes')
        .select(select, { count: 'exact' })
        .eq('status', 'ativo')

      if (usarOrigem && consultoraOrigem) {
        query = query.ilike('origem_consultora_nome', escaparTermoIlike(consultoraOrigem))
      }

      if (telefoneTrecho) {
        const trechoEscapado = escaparTermoIlike(telefoneTrecho)
        query = query.or(
          `telefone_normalizado.ilike.%${trechoEscapado}%,telefone_normalizado_ddi.ilike.%${trechoEscapado}%`
        )
      } else if (termosNome.length > 0) {
        for (const termoNome of termosNome) {
          query = query.ilike('nome', `%${escaparTermoIlike(termoNome)}%`)
        }
      }

      return query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
    }

    if (telefoneTrecho) {
      console.log(
        `[ATENDIMENTO PRESENCIAL CLIENTES] busca telefone=${mascararTelefoneParaLog(telefoneBusca)} usuario=${auth.allowedUser.id}`
      )
    } else if (termosNome.length > 0) {
      console.log(`[ATENDIMENTO PRESENCIAL CLIENTES] busca nome usuario=${auth.allowedUser.id}`)
    } else {
      console.log(`[ATENDIMENTO PRESENCIAL CLIENTES] listagem usuario=${auth.allowedUser.id}`)
    }

    let origemDisponivel = true
    let { data, error, count } = await executarConsultaClientes(SELECT_CLIENTE_COM_ORIGEM, true)

    if (isErroSchemaOrigemCliente(error)) {
      origemDisponivel = false
      ;({ data, error, count } = await executarConsultaClientes(SELECT_CLIENTE_BASE, false))
    }

    if (error) {
      console.error('[ATENDIMENTO PRESENCIAL CLIENTES] Erro ao buscar clientes:', error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisicao' },
        { status: 500 }
      )
    }

    const rows = (data ?? []) as unknown as ClientePresencialRow[]
    const unidadesPorId = origemDisponivel
      ? await carregarUnidadesPorId(
          supabase,
          Array.from(new Set(rows.map((row) => row.origem_unidade_id).filter((id): id is string => Boolean(id))))
        )
      : new Map<string, string>()
    const clientes = rows.map((row) => ({
      ...serializarClientePresencial(row, { unidadeNome: row.origem_unidade_id ? unidadesPorId.get(row.origem_unidade_id) ?? null : null }),
      correspondenciaExataTelefone:
        Boolean(telefoneTrecho) &&
        Boolean(row.telefone_normalizado?.includes(telefoneTrecho) || row.telefone_normalizado_ddi?.includes(telefoneTrecho)),
    }))
    const consultoras = origemDisponivel ? await carregarConsultorasOrigem(supabase) : []

    return NextResponse.json({
      ok: true,
      clientes,
      consultoras,
      meta: {
        page,
        pageSize: limit,
        total: count ?? clientes.length,
        totalPages: Math.max(Math.ceil((count ?? clientes.length) / limit), 1),
      },
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
        .select(SELECT_CLIENTE_BASE)
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
      .select(SELECT_CLIENTE_BASE)
      .single()

    if (insertError) {
      if (insertError.code === '23505' && validacao.telefoneNormalizado) {
        const { data: existenteAposConflito, error: conflitoSelectError } = await supabase
          .from('atendimento_presencial_clientes')
          .select(SELECT_CLIENTE_BASE)
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
