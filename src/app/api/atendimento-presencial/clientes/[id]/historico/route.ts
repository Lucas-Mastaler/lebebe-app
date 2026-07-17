import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  carregarPerfilAtendimento,
  isUuid,
  listarUnidadesDoContexto,
  requireAtendimentoPresencialFichaAccess,
  usuarioPodeAcessarRascunho,
  type AtendimentoPresencialRow,
} from '@/lib/atendimento-presencial/rascunhos'
import {
  buscarVendasSgiPorTelefone,
  serializarHistoricoAtendimento,
} from '@/lib/atendimento-presencial/historico-cliente'

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
].join(', ')

type ClienteHistoricoRow = {
  id: string
  telefone_normalizado: string | null
  telefone_normalizado_ddi: string | null
}

function jsonErro(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!isUuid(id)) return jsonErro('ID da cliente invalido', 400)

    const auth = await requireAtendimentoPresencialFichaAccess()
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()
    const perfil = await carregarPerfilAtendimento(supabase, auth.allowedUser)
    if (!perfil) return jsonErro('Perfil nao encontrado', 403)
    const unidadesPermitidas = await listarUnidadesDoContexto(supabase, auth.allowedUser, perfil)

    const { data: clienteData, error: clienteError } = await supabase
      .from('atendimento_presencial_clientes')
      .select('id, telefone_normalizado, telefone_normalizado_ddi')
      .eq('id', id)
      .maybeSingle()

    if (clienteError) {
      console.error('[ATENDIMENTO PRESENCIAL HISTORICO CLIENTE] Erro ao carregar cliente:', clienteError)
      return jsonErro('Erro ao processar requisicao', 500)
    }
    if (!clienteData) return jsonErro('Cliente nao encontrada', 404)

    const cliente = clienteData as ClienteHistoricoRow
    const atendimentoAtualId = new URL(request.url).searchParams.get('atendimentoAtualId')

    let query = supabase
      .from('atendimento_presencial_atendimentos')
      .select(SELECT_ATENDIMENTO)
      .eq('cliente_id', id)
      .eq('status', 'concluido')

    if (atendimentoAtualId && isUuid(atendimentoAtualId)) {
      query = query.neq('id', atendimentoAtualId)
    }
    if (perfil === 'consultora') {
      query = query.eq('consultora_usuario_id', auth.allowedUser.id)
    } else if (perfil !== 'superadmin') {
      if (unidadesPermitidas.length === 0) {
        return NextResponse.json({
          ok: true,
          telefoneDisponivel: Boolean(cliente.telefone_normalizado || cliente.telefone_normalizado_ddi),
          atendimentos: [],
          vendas: [],
          fontesConsultadas: ['atendimento_presencial', 'sgi_documentos_saida'],
        })
      }
      query = query.in('unidade_id', unidadesPermitidas.map((unidade) => unidade.id))
    }

    const { data: atendimentoData, error: atendimentoError } = await query
      .order('concluido_em', { ascending: false })
      .limit(10)

    if (atendimentoError) {
      console.error('[ATENDIMENTO PRESENCIAL HISTORICO CLIENTE] Erro ao carregar atendimentos:', atendimentoError)
      return jsonErro('Erro ao processar requisicao', 500)
    }

    const rows = ((atendimentoData ?? []) as unknown as AtendimentoPresencialRow[]).filter((row) => usuarioPodeAcessarRascunho({
      row,
      authUserId: auth.allowedUser.id,
      perfil,
      unidadesPermitidas,
    }))

    const atendimentoIds = rows.map((row) => row.id)
    const unidadeIds = Array.from(new Set(rows.map((row) => row.unidade_id)))
    const consultoraIds = Array.from(new Set(rows.map((row) => row.consultora_usuario_id)))

    const [departamentosResult, produtosResult, unidadesResult, consultorasResult, vendasResult] = await Promise.all([
      atendimentoIds.length
        ? supabase.from('atendimento_presencial_departamentos').select('atendimento_id, departamento').in('atendimento_id', atendimentoIds).order('ordem', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      atendimentoIds.length
        ? supabase.from('atendimento_presencial_produtos_interesse').select('atendimento_id, descricao').in('atendimento_id', atendimentoIds).order('ordem', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      unidadeIds.length
        ? supabase.from('app_unidades').select('id, nome').in('id', unidadeIds)
        : Promise.resolve({ data: [], error: null }),
      consultoraIds.length
        ? supabase.from('usuarios_permitidos').select('id, email').in('id', consultoraIds)
        : Promise.resolve({ data: [], error: null }),
      buscarVendasSgiPorTelefone(supabase, {
        telefoneNormalizado: cliente.telefone_normalizado,
        telefoneNormalizadoDdi: cliente.telefone_normalizado_ddi,
        limit: 10,
      }),
    ])

    if (departamentosResult.error || produtosResult.error || unidadesResult.error || consultorasResult.error) {
      console.error('[ATENDIMENTO PRESENCIAL HISTORICO CLIENTE] Erro ao carregar relacionados:', {
        departamentos: departamentosResult.error,
        produtos: produtosResult.error,
        unidades: unidadesResult.error,
        consultoras: consultorasResult.error,
      })
      return jsonErro('Erro ao processar requisicao', 500)
    }

    const departamentosPorAtendimento = new Map<string, string[]>()
    for (const row of (departamentosResult.data ?? []) as Array<{ atendimento_id: string; departamento: string }>) {
      departamentosPorAtendimento.set(row.atendimento_id, [...(departamentosPorAtendimento.get(row.atendimento_id) ?? []), row.departamento])
    }

    const produtosPorAtendimento = new Map<string, string[]>()
    for (const row of (produtosResult.data ?? []) as Array<{ atendimento_id: string; descricao: string }>) {
      produtosPorAtendimento.set(row.atendimento_id, [...(produtosPorAtendimento.get(row.atendimento_id) ?? []), row.descricao])
    }

    const unidadesPorId = new Map((unidadesResult.data ?? []).map((unidade) => [unidade.id, unidade.nome]))
    const consultorasPorId = new Map((consultorasResult.data ?? []).map((consultora) => [consultora.id, consultora.email]))

    return NextResponse.json({
      ok: true,
      telefoneDisponivel: vendasResult.telefoneDisponivel,
      atendimentos: rows.map((row) => serializarHistoricoAtendimento({
        row,
        unidadeNome: unidadesPorId.get(row.unidade_id) ?? null,
        consultoraEmail: consultorasPorId.get(row.consultora_usuario_id) ?? null,
        departamentos: departamentosPorAtendimento.get(row.id) ?? [],
        produtosInteresse: produtosPorAtendimento.get(row.id) ?? [],
      })),
      vendas: vendasResult.vendas,
      fontesConsultadas: ['atendimento_presencial', 'sgi_documentos_saida'],
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL HISTORICO CLIENTE] Erro geral:', error)
    return jsonErro('Erro ao processar requisicao', 500)
  }
}
