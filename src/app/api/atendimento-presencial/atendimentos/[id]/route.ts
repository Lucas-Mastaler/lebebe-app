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
].join(', ')

function jsonErro(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status })
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
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL REGISTRO] Erro geral:', error)
    return jsonErro('Erro ao processar requisicao', 500)
  }
}
