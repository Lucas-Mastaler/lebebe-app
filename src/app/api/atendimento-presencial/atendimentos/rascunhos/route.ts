import { PRODUTOS_V2_HABILITADOS } from '@/lib/atendimento-presencial/produtos-config'
import { correspondeNome, filtrarDadosListagem, lerFiltrosListagem, lerPaginas } from '@/lib/atendimento-presencial/filtros-listagem'
import { normalizarNomeConsultora } from '@/lib/atendimento-presencial/ficha-schema'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'
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

  const clientes = clienteIds.length ? await lerPaginas((de, ate) => supabase.from('atendimento_presencial_clientes').select('id, nome, telefone_informado, telefone_normalizado').in('id', clienteIds as string[]).order('id').range(de, ate)) : []
  const mapa = new Map(clientes.map(cliente => [cliente.id, cliente]))
  return rascunhos.map(rascunho => {
    const ficha = rascunho.dadosRascunho
    const tipo = ficha.tipoAtendimento ?? null
    const local = ficha.entradasFormulario?.novoCliente
    const cliente = rascunho.clienteId ? mapa.get(rascunho.clienteId) : null
    return {
      ...rascunho,
      tipoAtendimento: tipo,
      motivoVisita: ficha.motivoVisita ?? null,
      clienteNome: tipo === 'nao_cliente' ? 'Não cliente' : cliente?.nome ?? local?.nome?.trim() ?? null,
      clienteTelefone: tipo === 'nao_cliente' ? null : cliente?.telefone_informado || cliente?.telefone_normalizado || local?.telefone || null,
      clienteCadastroPendente: tipo !== 'nao_cliente' && !rascunho.clienteId && Boolean(local?.nome?.trim()),
      consultoraNome: normalizarNomeConsultora(ficha.consultoraNome || rascunho.consultoraNomeManual) || null,
    }
  })
}

function jsonErro(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, message, ...extra }, { status })
}

export async function GET(request?: Request) {
  try {
    const auth = await requireAtendimentoPresencialFichaAccess()
    if (!auth.ok) return auth.response

    const params = new URL(request?.url ?? 'http://localhost').searchParams
    let filtros
    try { filtros = lerFiltrosListagem(params, true) } catch (error) { return jsonErro(error instanceof Error ? error.message : 'Filtros inválidos', 400) }
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
        return NextResponse.json({ ok: true, rascunhos: [], contexto, consultorasDisponiveis: [], total: 0, page: 1, pageSize: TABLE_PAGE_SIZE })
      }
      query = query.in('unidade_id', contexto.unidadesPermitidas.map((unidade) => unidade.id))
    }

    const data = await lerPaginas((de, ate) => query.order('ultima_atividade_em', { ascending: false }).order('id', { ascending: false }).range(de, ate))
    const rascunhosSerializados = ((data ?? []) as unknown as AtendimentoPresencialRow[]).map(serializarAtendimentoPresencial)

    const enriquecidos = await enriquecerRascunhos(supabase, rascunhosSerializados)
    const consultorasDisponiveis = Array.from(new Set(enriquecidos.map(item => item.consultoraNome).filter((nome): nome is string => Boolean(nome)))).sort().map(nome => ({ nome }))
    const unidadeId = params.get('unidadeId') ?? ''
    if (unidadeId && !unidadePermitida(unidadeId, contexto.unidadesPermitidas)) return jsonErro('Filial não permitida.', 403)
    const agora = Date.now()
    const filtrados = enriquecidos.filter(item =>
      (!unidadeId || item.unidadeId === unidadeId) &&
      (!params.get('clienteNome') || correspondeNome(item.clienteNome, params.get('clienteNome')!)) &&
      (!params.get('consultora') || normalizarNomeConsultora(item.consultoraNome) === normalizarNomeConsultora(params.get('consultora'))) &&
      filtrarDadosListagem({ data: item.ultimaAtividadeEm, tipo: item.tipoAtendimento ?? null, clienteId: item.clienteId, telefone: item.clienteTelefone, expiraEm: item.expiraEm }, filtros, agora))
    const total = filtrados.length
    const paginas = Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE))
    const solicitado = Number(params.get('page') ?? 1)
    const page = Math.min(Number.isInteger(solicitado) && solicitado > 0 ? solicitado : 1, paginas)
    const rascunhos = filtrados.slice((page - 1) * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE)

    return NextResponse.json({
      ok: true,
      rascunhos,
      contexto,
      consultorasDisponiveis, total, page, pageSize: TABLE_PAGE_SIZE,
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
    if (validacaoDados.dados.versaoProdutos === 2 && !PRODUTOS_V2_HABILITADOS) {
      return jsonErro('O registro de quantidade e venda ainda não foi ativado.', 422, { field: 'produtosInteresse' })
    }


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

    if (validacaoDados.dados.versaoFluxo === 2 && !validacaoDados.dados.tipoAtendimento) {
      return jsonErro('Selecione o tipo de atendimento antes de iniciar o rascunho.', 422, { field: 'tipoAtendimento' })
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
