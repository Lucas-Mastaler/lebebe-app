import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validarFichaDadosRascunho, validarFichaParaConclusao } from '@/lib/atendimento-presencial/ficha-schema'
import {
  carregarPerfilAtendimento,
  isUuid,
  listarUnidadesDoContexto,
  rascunhoExpirado,
  requireAtendimentoPresencialFichaAccess,
  serializarAtendimentoPresencial,
  usuarioPodeAcessarRascunho,
  type AtendimentoPresencialRow,
} from '@/lib/atendimento-presencial/rascunhos'

export const runtime = 'nodejs'

const SELECT_ATENDIMENTO = [
  'id',
  'cliente_id',
  'consultora_usuario_id',
  'unidade_id',
  'status',
  'draft_client_id',
  'dados_rascunho',
  'resultado_atendimento',
  'motivo_outro',
  'observacoes',
  'numero_lancamento',
  'concluido_em',
  'iniciado_em',
  'ultima_atividade_em',
  'expira_em',
  'version',
  'criado_por',
  'atualizado_por',
  'created_at',
  'updated_at',
  'consultora_nome',
].join(', ')

function jsonErro(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, message, ...extra }, { status })
}

async function carregarContexto() {
  const auth = await requireAtendimentoPresencialFichaAccess()
  if (!auth.ok) return { ok: false as const, response: auth.response }

  const supabase = createServiceClient()
  const perfil = await carregarPerfilAtendimento(supabase, auth.allowedUser)
  if (!perfil) return { ok: false as const, response: jsonErro('Perfil nao encontrado', 403) }

  const unidadesPermitidas = await listarUnidadesDoContexto(supabase, auth.allowedUser, perfil)
  return {
    ok: true as const,
    supabase,
    allowedUser: auth.allowedUser,
    contexto: {
      perfil,
      usuarioId: auth.allowedUser.id,
      role: auth.allowedUser.role,
      unidadesPermitidas,
    },
  }
}

function mapearErroRpc(error: { code?: string; message?: string }) {
  const message = error.message ?? ''
  if (error.code === 'P0003' || message.includes('version_conflict')) {
    return jsonErro('Conflito de versao', 409)
  }
  if (error.code === 'P0004' || message.includes('rascunho_expirado')) {
    return jsonErro('Rascunho expirado', 410)
  }
  if (error.code === 'P0002' || message.includes('atendimento_not_found')) {
    return jsonErro('Rascunho nao encontrado', 404)
  }
  if (error.code === 'P0001' || message.includes('atendimento_not_draft')) {
    return jsonErro('Atendimento ja concluido', 409)
  }
  if (error.code === '42501' || message.includes('access_denied')) {
    return jsonErro('Acesso negado ao rascunho', 403)
  }
  if (error.code === '23514') {
    return jsonErro('Dados obrigatorios da conclusao nao foram preenchidos', 422)
  }
  return null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!isUuid(id)) return jsonErro('ID do rascunho invalido', 400)

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
    const expectedVersion = Number(payload.version)
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return jsonErro('Versao esperada invalida', 422, { field: 'version' })
    }

    const loaded = await carregarContexto()
    if (!loaded.ok) return loaded.response

    const { data, error } = await loaded.supabase
      .from('atendimento_presencial_atendimentos')
      .select(SELECT_ATENDIMENTO)
      .eq('id', id)
      .eq('status', 'rascunho')
      .maybeSingle()

    if (error) {
      console.error('[ATENDIMENTO PRESENCIAL CONCLUIR] Erro ao buscar rascunho:', error)
      return jsonErro('Erro ao processar requisicao', 500)
    }
    if (!data) return jsonErro('Rascunho nao encontrado', 404)

    const row = data as unknown as AtendimentoPresencialRow
    if (!usuarioPodeAcessarRascunho({
      row,
      authUserId: loaded.contexto.usuarioId,
      perfil: loaded.contexto.perfil,
      unidadesPermitidas: loaded.contexto.unidadesPermitidas,
    })) {
      return jsonErro('Acesso negado ao rascunho', 403)
    }
    if (rascunhoExpirado(row.expira_em)) {
      return jsonErro('Rascunho expirado', 410, { rascunho: serializarAtendimentoPresencial(row) })
    }

    const validacaoDados = validarFichaDadosRascunho(row.dados_rascunho)
    if (!validacaoDados.ok) {
      return jsonErro(validacaoDados.message, 422, { field: validacaoDados.field })
    }

    const validacaoConclusao = validarFichaParaConclusao({
      ficha: validacaoDados.dados,
      clienteId: row.cliente_id,
      numeroLancamento: payload.numeroLancamento,
    })
    if (!validacaoConclusao.ok) {
      return jsonErro(validacaoConclusao.message, 422, { field: validacaoConclusao.field })
    }

    const consultoraNome = typeof payload.consultoraNome === 'string' ? payload.consultoraNome.trim() : ''

    const { error: rpcError } = await loaded.supabase.rpc('atendimento_presencial_concluir', {
      p_atendimento_id: id,
      p_expected_version: expectedVersion,
      p_usuario_id: loaded.contexto.usuarioId,
      p_numero_lancamento: validacaoConclusao.numeroLancamento,
      p_consultora_nome: consultoraNome || null,
    })

    if (rpcError) {
      const response = mapearErroRpc(rpcError)
      if (response) return response
      console.error('[ATENDIMENTO PRESENCIAL CONCLUIR] Erro ao concluir atendimento:', rpcError)
      return jsonErro('Erro ao processar requisicao', 500)
    }

    const { data: concluido, error: selectError } = await loaded.supabase
      .from('atendimento_presencial_atendimentos')
      .select(SELECT_ATENDIMENTO)
      .eq('id', id)
      .single()

    if (selectError || !concluido) {
      console.error('[ATENDIMENTO PRESENCIAL CONCLUIR] Erro ao recarregar atendimento:', selectError)
      return jsonErro('Erro ao processar requisicao', 500)
    }

    console.log(`[ATENDIMENTO PRESENCIAL CONCLUIR] atendimento=${id} usuario=${loaded.contexto.usuarioId}`)

    return NextResponse.json({
      ok: true,
      atendimento: serializarAtendimentoPresencial(concluido as unknown as AtendimentoPresencialRow),
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL CONCLUIR] Erro geral:', error)
    return jsonErro('Erro ao processar requisicao', 500)
  }
}
