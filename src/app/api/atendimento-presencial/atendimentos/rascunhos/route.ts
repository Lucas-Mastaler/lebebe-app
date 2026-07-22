import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  calcularExpiracaoRascunho,
  carregarPerfilAtendimento,
  isUuid,
  listarUnidadesDoContexto,
  requireAtendimentoPresencialFichaAccess,
  serializarAtendimentoPresencial,
  unidadePermitida,
  usuarioPodeAcessarRascunho,
  validarDadosRascunho,
  type AtendimentoPresencialRow,
  type ContextoAtendimento,
} from '@/lib/atendimento-presencial/rascunhos'
import { validarNomeConsultora } from '@/lib/atendimento-presencial/ficha-schema'
import type { AtendimentoPresencialDTO } from '@/lib/atendimento-presencial/rascunhos-shared'

export const runtime = 'nodejs'

const SELECT_RASCUNHO = [
  'id',
  'cliente_id',
  'consultora_usuario_id',
  'unidade_id',
  'status',
  'draft_client_id',
  'dados_rascunho',
  'consultora_nome',
  'iniciado_em',
  'ultima_atividade_em',
  'expira_em',
  'version',
  'criado_por',
  'atualizado_por',
  'created_at',
  'updated_at',
].join(', ')

type SupabaseClientLike = ReturnType<typeof createServiceClient>

async function montarContexto(supabase: SupabaseClientLike, auth: Awaited<ReturnType<typeof requireAtendimentoPresencialFichaAccess>>) {
  if (!auth.ok) return null

  const perfil = await carregarPerfilAtendimento(supabase, auth.allowedUser)
  if (!perfil) return null

  const unidadesPermitidas = await listarUnidadesDoContexto(supabase, auth.allowedUser, perfil)

  return {
    perfil,
    usuarioId: auth.allowedUser.id,
    acessoTotal: auth.acessoTotal,
    unidadesPermitidas,
  } satisfies ContextoAtendimento
}

async function enriquecerRascunhos(
  supabase: SupabaseClientLike,
  rascunhos: AtendimentoPresencialDTO[]
) {
  const clienteIds = Array.from(new Set(rascunhos.map((rascunho) => rascunho.clienteId).filter(Boolean)))
  const consultoraIds = Array.from(new Set(rascunhos.map((rascunho) => rascunho.consultoraUsuarioId).filter(Boolean)))

  const [clientesResult, consultorasResult] = await Promise.all([
    clienteIds.length > 0
      ? supabase
        .from('atendimento_presencial_clientes')
        .select('id, nome')
        .in('id', clienteIds)
      : Promise.resolve({ data: [], error: null }),
    consultoraIds.length > 0
      ? supabase
        .from('usuarios_permitidos')
        .select('id, email')
        .in('id', consultoraIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const nomesClientes = new Map(
    ((clientesResult.data ?? []) as Array<{ id: string; nome: string }>).map((cliente) => [cliente.id, cliente.nome])
  )
  const nomesConsultoras = new Map(
    ((consultorasResult.data ?? []) as Array<{ id: string; email: string }>).map((consultora) => [consultora.id, consultora.email])
  )

  return rascunhos.map((rascunho) => ({
    ...rascunho,
    clienteNome: rascunho.clienteId ? nomesClientes.get(rascunho.clienteId) ?? null : null,
    consultoraNome: nomesConsultoras.get(rascunho.consultoraUsuarioId) ?? null,
  }))
}

function jsonErro(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, message, ...extra }, { status })
}

export async function GET() {
  try {
    const auth = await requireAtendimentoPresencialFichaAccess()
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()
    const contexto = await montarContexto(supabase, auth)
    if (!contexto) return jsonErro('Perfil nao encontrado', 403)

    let query = supabase
      .from('atendimento_presencial_atendimentos')
      .select(SELECT_RASCUNHO)
      .eq('status', 'rascunho')
      .gt('expira_em', new Date().toISOString())

    if (contexto.perfil === 'consultora') {
      query = query.eq('consultora_usuario_id', contexto.usuarioId)
    } else if (contexto.perfil !== 'superadmin') {
      if (contexto.unidadesPermitidas.length === 0) {
        return NextResponse.json({ ok: true, rascunhos: [], contexto, consultorasDisponiveis: [] })
      }
      query = query.in('unidade_id', contexto.unidadesPermitidas.map((unidade) => unidade.id))
    }

    const { data, error } = await query
      .order('ultima_atividade_em', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[ATENDIMENTO PRESENCIAL RASCUNHOS] Erro ao listar rascunhos:', error)
      return jsonErro('Erro ao processar requisicao', 500)
    }

    const rascunhosSerializados = ((data ?? []) as unknown as AtendimentoPresencialRow[]).map(serializarAtendimentoPresencial)
    const rascunhos = await enriquecerRascunhos(supabase, rascunhosSerializados)

    return NextResponse.json({
      ok: true,
      rascunhos,
      contexto,
      consultorasDisponiveis: [],
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL RASCUNHOS] Erro geral no GET:', error)
    return jsonErro('Erro ao processar requisicao', 500)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAtendimentoPresencialFichaAccess()
    if (!auth.ok) return auth.response

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonErro('Payload invalido', 400)
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return jsonErro('Payload invalido', 400)
    }

    const payload = body as Record<string, unknown>
    if (!isUuid(payload.draftClientId)) return jsonErro('draftClientId invalido', 422, { field: 'draftClientId' })

    const supabase = createServiceClient()
    const contexto = await montarContexto(supabase, auth)
    if (!contexto) return jsonErro('Perfil nao encontrado', 403)

    const unidadeIdInformada = typeof payload.unidadeId === 'string' ? payload.unidadeId : ''
    const unidadeId = unidadeIdInformada || (contexto.unidadesPermitidas.length === 1 ? contexto.unidadesPermitidas[0].id : '')
    if (!isUuid(unidadeId)) return jsonErro('Unidade e obrigatoria', 422, { field: 'unidadeId' })
    if (!unidadePermitida(unidadeId, contexto.unidadesPermitidas)) return jsonErro('Unidade nao permitida', 403, { field: 'unidadeId' })

    const consultoraUsuarioId = contexto.usuarioId

    const validacaoDados = validarDadosRascunho(payload.dadosRascunho)
    if (!validacaoDados.ok) return jsonErro(validacaoDados.message, 422, { field: validacaoDados.field })

    const consultoraNome = validacaoDados.dados.consultoraNome ?? ''
    if (!consultoraNome || !validarNomeConsultora(consultoraNome)) {
      return jsonErro('Informe o nome da consultora (apenas letras e espacos, 2 a 30 caracteres).', 400, { field: 'consultoraNome' })
    }

    const clienteId = typeof payload.clienteId === 'string' && payload.clienteId ? payload.clienteId : null
    if (clienteId) {
      if (!isUuid(clienteId)) return jsonErro('Cliente invalida', 422, { field: 'clienteId' })
      const { data: cliente } = await supabase
        .from('atendimento_presencial_clientes')
        .select('id')
        .eq('id', clienteId)
        .eq('status', 'ativo')
        .maybeSingle()
      if (!cliente) return jsonErro('Cliente nao encontrada', 422, { field: 'clienteId' })
    }

    const { data: existente, error: existenteError } = await supabase
      .from('atendimento_presencial_atendimentos')
      .select(SELECT_RASCUNHO)
      .eq('draft_client_id', payload.draftClientId)
      .maybeSingle()

    if (existenteError) {
      console.error('[ATENDIMENTO PRESENCIAL RASCUNHOS] Erro ao verificar idempotencia:', existenteError)
      return jsonErro('Erro ao processar requisicao', 500)
    }

    if (existente) {
      const row = existente as unknown as AtendimentoPresencialRow
      if (!usuarioPodeAcessarRascunho({
        row,
        authUserId: contexto.usuarioId,
        perfil: contexto.perfil,
        unidadesPermitidas: contexto.unidadesPermitidas,
      })) {
        return jsonErro('Acesso negado ao rascunho', 403)
      }
      return NextResponse.json({ ok: true, rascunho: serializarAtendimentoPresencial(row), idempotente: true })
    }

    const agora = new Date()
    const expiraEm = calcularExpiracaoRascunho(agora)
    const { data: criado, error: insertError } = await supabase
      .from('atendimento_presencial_atendimentos')
      .insert({
        cliente_id: clienteId,
        consultora_usuario_id: consultoraUsuarioId,
        unidade_id: unidadeId,
        draft_client_id: payload.draftClientId,
        dados_rascunho: validacaoDados.dados,
        iniciado_em: agora.toISOString(),
        ultima_atividade_em: agora.toISOString(),
        expira_em: expiraEm.toISOString(),
        criado_por: contexto.usuarioId,
        atualizado_por: contexto.usuarioId,
      })
      .select(SELECT_RASCUNHO)
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: aposConflito } = await supabase
          .from('atendimento_presencial_atendimentos')
          .select(SELECT_RASCUNHO)
          .eq('draft_client_id', payload.draftClientId)
          .single()
        if (aposConflito) {
          return NextResponse.json({
            ok: true,
            rascunho: serializarAtendimentoPresencial(aposConflito as unknown as AtendimentoPresencialRow),
            idempotente: true,
          })
        }
      }

      console.error('[ATENDIMENTO PRESENCIAL RASCUNHOS] Erro ao criar rascunho:', insertError)
      return jsonErro('Erro ao processar requisicao', 500)
    }

    console.log(`[ATENDIMENTO PRESENCIAL RASCUNHOS] rascunho criado usuario=${contexto.usuarioId}`)

    return NextResponse.json(
      {
        ok: true,
        rascunho: serializarAtendimentoPresencial(criado as unknown as AtendimentoPresencialRow),
        idempotente: false,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL RASCUNHOS] Erro geral no POST:', error)
    return jsonErro('Erro ao processar requisicao', 500)
  }
}
