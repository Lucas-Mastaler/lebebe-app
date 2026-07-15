import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  calcularExpiracaoRascunho,
  carregarPerfilAtendimento,
  isUuid,
  listarUnidadesDoContexto,
  rascunhoExpirado,
  requireAtendimentoPresencialFichaAccess,
  serializarAtendimentoPresencial,
  usuarioPodeAcessarRascunho,
  validarDadosRascunho,
  type AtendimentoPresencialRow,
} from '@/lib/atendimento-presencial/rascunhos'

export const runtime = 'nodejs'

const SELECT_RASCUNHO = [
  'id',
  'cliente_id',
  'consultora_usuario_id',
  'unidade_id',
  'status',
  'draft_client_id',
  'dados_rascunho',
  'iniciado_em',
  'ultima_atividade_em',
  'expira_em',
  'version',
  'criado_por',
  'atualizado_por',
  'created_at',
  'updated_at',
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
    contexto: {
      perfil,
      usuarioId: auth.allowedUser.id,
      unidadesPermitidas,
    },
  }
}

async function buscarRascunhoVisivel(id: string) {
  const loaded = await carregarContexto()
  if (!loaded.ok) return loaded

  const { data, error } = await loaded.supabase
    .from('atendimento_presencial_atendimentos')
    .select(SELECT_RASCUNHO)
    .eq('id', id)
    .eq('status', 'rascunho')
    .maybeSingle()

  if (error) {
    console.error('[ATENDIMENTO PRESENCIAL RASCUNHO] Erro ao buscar rascunho:', error)
    return { ok: false as const, response: jsonErro('Erro ao processar requisicao', 500) }
  }

  if (!data) return { ok: false as const, response: jsonErro('Rascunho nao encontrado', 404) }

  const row = data as unknown as AtendimentoPresencialRow
  if (!usuarioPodeAcessarRascunho({
    row,
    authUserId: loaded.contexto.usuarioId,
    perfil: loaded.contexto.perfil,
    unidadesPermitidas: loaded.contexto.unidadesPermitidas,
  })) {
    return { ok: false as const, response: jsonErro('Acesso negado ao rascunho', 403) }
  }

  return { ...loaded, ok: true as const, row }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isUuid(id)) return jsonErro('ID do rascunho invalido', 400)

  const loaded = await buscarRascunhoVisivel(id)
  if (!loaded.ok) return loaded.response

  if (rascunhoExpirado(loaded.row.expira_em)) {
    return jsonErro('Rascunho expirado', 410, {
      rascunho: serializarAtendimentoPresencial(loaded.row),
    })
  }

  return NextResponse.json({
    ok: true,
    rascunho: serializarAtendimentoPresencial(loaded.row),
  })
}

export async function PATCH(
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

    const validacaoDados = validarDadosRascunho(payload.dadosRascunho)
    if (!validacaoDados.ok) return jsonErro(validacaoDados.message, 422, { field: validacaoDados.field })

    const loaded = await buscarRascunhoVisivel(id)
    if (!loaded.ok) return loaded.response

    if (rascunhoExpirado(loaded.row.expira_em)) {
      return jsonErro('Rascunho expirado', 410, {
        rascunho: serializarAtendimentoPresencial(loaded.row),
      })
    }

    const agora = new Date()
    const expiraEm = calcularExpiracaoRascunho(agora)
    const { data: atualizado, error: updateError } = await loaded.supabase
      .from('atendimento_presencial_atendimentos')
      .update({
        dados_rascunho: validacaoDados.dados,
        ultima_atividade_em: agora.toISOString(),
        expira_em: expiraEm.toISOString(),
        atualizado_por: loaded.contexto.usuarioId,
      })
      .eq('id', id)
      .eq('version', expectedVersion)
      .select(SELECT_RASCUNHO)
      .maybeSingle()

    if (updateError) {
      console.error('[ATENDIMENTO PRESENCIAL RASCUNHO] Erro ao atualizar rascunho:', updateError)
      return jsonErro('Erro ao processar requisicao', 500)
    }

    if (!atualizado) {
      const { data: atual } = await loaded.supabase
        .from('atendimento_presencial_atendimentos')
        .select(SELECT_RASCUNHO)
        .eq('id', id)
        .maybeSingle()

      return NextResponse.json(
        {
          ok: false,
          message: 'Conflito de versao',
          rascunho: atual ? serializarAtendimentoPresencial(atual as unknown as AtendimentoPresencialRow) : null,
        },
        { status: 409 }
      )
    }

    console.log(`[ATENDIMENTO PRESENCIAL RASCUNHO] autosave usuario=${loaded.contexto.usuarioId}`)

    return NextResponse.json({
      ok: true,
      rascunho: serializarAtendimentoPresencial(atualizado as unknown as AtendimentoPresencialRow),
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL RASCUNHO] Erro geral no PATCH:', error)
    return jsonErro('Erro ao processar requisicao', 500)
  }
}
