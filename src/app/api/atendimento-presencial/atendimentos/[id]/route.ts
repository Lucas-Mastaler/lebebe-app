import { NextResponse } from 'next/server'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'
import {
  carregarPerfilAtendimento,
  isUuid,
  listarUnidadesDoContexto,
  serializarAtendimentoPresencial,
  usuarioPodeAcessarRascunho,
  type AtendimentoPresencialRow,
} from '@/lib/atendimento-presencial/rascunhos'
import { serializarClienteRegistro, type ClienteRegistroRow } from '@/lib/atendimento-presencial/registros'
import {
  normalizarNomeConsultora,
  validarFichaDadosRascunho,
  validarFichaParaConclusao,
} from '@/lib/atendimento-presencial/ficha-schema'

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
  'virada_cartao_dia',
  'virada_cartao_mes',
  'consultora_nome',
  'concluido_em',
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

function calcularPermissaoEdicao(params: {
  row: AtendimentoPresencialRow
  perfil: string
  usuarioId: string
  role?: string
}) {
  if (params.role === 'superadmin' || params.perfil === 'superadmin') {
    return { podeEditar: true, motivoBloqueio: null, limiteEdicaoEm: null }
  }
  if (params.perfil === 'gestao') {
    return { podeEditar: false, motivoBloqueio: 'Voce nao possui permissao para editar este atendimento.', limiteEdicaoEm: null }
  }
  if (params.perfil === 'supervisora_loja') {
    return { podeEditar: true, motivoBloqueio: null, limiteEdicaoEm: null }
  }
  if (params.perfil === 'consultora') {
    if (params.row.consultora_usuario_id !== params.usuarioId) {
      return { podeEditar: false, motivoBloqueio: 'Voce nao possui permissao para editar este atendimento.', limiteEdicaoEm: null }
    }
    if (!params.row.concluido_em) {
      return { podeEditar: false, motivoBloqueio: 'Atendimento sem data de conclusao.', limiteEdicaoEm: null }
    }
    const limite = new Date(params.row.concluido_em)
    limite.setDate(limite.getDate() + 3)
    if (Date.now() > limite.getTime()) {
      return { podeEditar: false, motivoBloqueio: 'Prazo de edicao encerrado.', limiteEdicaoEm: limite.toISOString() }
    }
    return { podeEditar: true, motivoBloqueio: null, limiteEdicaoEm: limite.toISOString() }
  }
  return { podeEditar: false, motivoBloqueio: 'Voce nao possui permissao para editar este atendimento.', limiteEdicaoEm: null }
}

function mapearErroRpcEdicao(error: { code?: string; message?: string }) {
  const message = error.message ?? ''
  if (error.code === 'P0003' || message.includes('version_conflict')) {
    return jsonErro('Este atendimento foi alterado por outra pessoa. Recarregue os dados antes de salvar novamente.', 409)
  }
  if (error.code === 'P0002' || message.includes('atendimento_not_found')) {
    return jsonErro('Atendimento nao encontrado', 404)
  }
  if (error.code === '42501' || message.includes('access_denied')) {
    return jsonErro('Voce nao possui permissao para editar este atendimento.', 403)
  }
  if (message.includes('nenhuma_alteracao')) {
    return NextResponse.json({ ok: true, semAlteracoes: true, message: 'Nao houve mudancas para salvar.' })
  }
  if (error.code === '23514') {
    return jsonErro('Dados obrigatorios da edicao nao foram preenchidos corretamente.', 400)
  }
  if (error.code === 'P0001') {
    return jsonErro('Atendimento nao pode ser editado neste estado.', 409)
  }
  return null
}

async function carregarContextoRegistros() {
  const auth = await requireModuleAccess('atendimento_presencial_registros')
  if (!auth.ok) return { ok: false as const, response: auth.response }

  const windowAccess = await checkAccessWindowForUser({
    usuarioId: auth.allowedUser.id,
    role: auth.allowedUser.role as 'user' | 'superadmin',
  })
  if (!windowAccess.ok) return { ok: false as const, response: jsonErro('Fora da janela de acesso', 403) }

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!isUuid(id)) return jsonErro('ID do atendimento invalido', 400)

    const loaded = await carregarContextoRegistros()
    if (!loaded.ok) return loaded.response

    const { data, error } = await loaded.supabase
      .from('atendimento_presencial_atendimentos')
      .select(SELECT_ATENDIMENTO)
      .eq('id', id)
      .eq('status', 'concluido')
      .maybeSingle()

    if (error) {
      console.error('[ATENDIMENTO PRESENCIAL REGISTRO] Erro ao buscar atendimento:', error)
      return jsonErro('Erro ao processar requisicao', 500)
    }
    if (!data) return jsonErro('Atendimento nao encontrado', 404)

    const row = data as unknown as AtendimentoPresencialRow
    if (!usuarioPodeAcessarRascunho({
      row,
      authUserId: loaded.contexto.usuarioId,
      perfil: loaded.contexto.perfil,
      unidadesPermitidas: loaded.contexto.unidadesPermitidas,
    })) {
      return jsonErro('Acesso negado ao atendimento', 403)
    }

    const [cliente, criancas, departamentos, produtos, motivos, historico] = await Promise.all([
      row.cliente_id
        ? loaded.supabase
          .from('atendimento_presencial_clientes')
          .select('id, nome, telefone_informado, parentesco, parentesco_outro')
          .eq('id', row.cliente_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      loaded.supabase.from('atendimento_presencial_criancas').select('*').eq('atendimento_id', id).order('ordem', { ascending: true }),
      loaded.supabase.from('atendimento_presencial_departamentos').select('*').eq('atendimento_id', id).order('ordem', { ascending: true }),
      loaded.supabase.from('atendimento_presencial_produtos_interesse').select('*').eq('atendimento_id', id).order('ordem', { ascending: true }),
      loaded.supabase.from('atendimento_presencial_motivos').select('*').eq('atendimento_id', id).order('ordem', { ascending: true }),
      loaded.supabase.from('atendimento_presencial_historico').select('*').eq('atendimento_id', id).order('created_at', { ascending: false }),
    ])

    if (cliente.error || criancas.error || departamentos.error || produtos.error || motivos.error || historico.error) {
      console.error('[ATENDIMENTO PRESENCIAL REGISTRO] Erro ao carregar detalhes:', {
        cliente: cliente.error,
        criancas: criancas.error,
        departamentos: departamentos.error,
        produtos: produtos.error,
        motivos: motivos.error,
        historico: historico.error,
      })
      return jsonErro('Erro ao processar requisicao', 500)
    }

    return NextResponse.json({
      ok: true,
      atendimento: serializarAtendimentoPresencial(row),
      cliente: serializarClienteRegistro(cliente.data as ClienteRegistroRow | null),
      criancas: criancas.data ?? [],
      departamentos: departamentos.data ?? [],
      produtosInteresse: produtos.data ?? [],
      motivos: motivos.data ?? [],
      historico: historico.data ?? [],
      ...calcularPermissaoEdicao({
        row,
        perfil: loaded.contexto.perfil,
        usuarioId: loaded.contexto.usuarioId,
        role: loaded.contexto.perfil === 'superadmin' ? 'superadmin' : undefined,
      }),
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL REGISTRO] Erro geral:', error)
    return jsonErro('Erro ao processar requisicao', 500)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!isUuid(id)) return jsonErro('ID do atendimento invalido', 400)

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

    const clienteId = typeof payload.clienteId === 'string' && isUuid(payload.clienteId)
      ? payload.clienteId
      : null
    if (!clienteId) return jsonErro('Cliente invalida', 400, { field: 'clienteId' })

    const validacaoDados = validarFichaDadosRascunho(payload.dadosRascunho)
    if (!validacaoDados.ok) {
      return jsonErro(validacaoDados.message, 400, { field: validacaoDados.field })
    }

    const validacaoConclusao = validarFichaParaConclusao({
      ficha: validacaoDados.dados,
      clienteId,
      numeroLancamento: payload.numeroLancamento,
    })
    if (!validacaoConclusao.ok) {
      return jsonErro(validacaoConclusao.message, 400, { field: validacaoConclusao.field })
    }

    const loaded = await carregarContextoRegistros()
    if (!loaded.ok) return loaded.response

    const { data, error } = await loaded.supabase
      .from('atendimento_presencial_atendimentos')
      .select(SELECT_ATENDIMENTO)
      .eq('id', id)
      .eq('status', 'concluido')
      .maybeSingle()

    if (error) {
      console.error('[ATENDIMENTO PRESENCIAL REGISTRO PATCH] Erro ao buscar atendimento:', error)
      return jsonErro('Erro ao processar requisicao', 500)
    }
    if (!data) return jsonErro('Atendimento nao encontrado', 404)

    const row = data as unknown as AtendimentoPresencialRow
    if (!usuarioPodeAcessarRascunho({
      row,
      authUserId: loaded.contexto.usuarioId,
      perfil: loaded.contexto.perfil,
      unidadesPermitidas: loaded.contexto.unidadesPermitidas,
    })) {
      return jsonErro('Acesso negado ao atendimento', 403)
    }
    if (row.version !== expectedVersion) {
      return jsonErro('Este atendimento foi alterado por outra pessoa. Recarregue os dados antes de salvar novamente.', 409)
    }

    const dadosEdicao = {
      ...validacaoDados.dados,
      clienteId,
    }

    const consultoraNome = typeof payload.consultoraNome === 'string' ? normalizarNomeConsultora(payload.consultoraNome) : ''

    const { data: rpcData, error: rpcError } = await loaded.supabase.rpc('atendimento_presencial_editar_concluido', {
      p_atendimento_id: id,
      p_expected_version: expectedVersion,
      p_usuario_id: loaded.contexto.usuarioId,
      p_dados: dadosEdicao,
      p_numero_lancamento: validacaoConclusao.numeroLancamento,
      p_consultora_nome: consultoraNome || null,
    })

    if (rpcError) {
      const response = mapearErroRpcEdicao(rpcError)
      if (response) return response
      console.error('[ATENDIMENTO PRESENCIAL REGISTRO PATCH] Erro ao editar atendimento:', rpcError)
      return jsonErro('Erro ao processar requisicao', 500)
    }

    const retorno = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as { id?: unknown; version?: unknown } | null | undefined
    return NextResponse.json({
      ok: true,
      id: typeof retorno?.id === 'string' ? retorno.id : id,
      version: typeof retorno?.version === 'number' ? retorno.version : null,
      message: 'Atendimento atualizado.',
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL REGISTRO PATCH] Erro geral:', error)
    return jsonErro('Erro ao processar requisicao', 500)
  }
}
