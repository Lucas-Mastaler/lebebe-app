import { NextResponse } from 'next/server'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'
import {
  carregarPerfilAtendimento,
  listarUnidadesDoContexto,
  type AtendimentoPresencialRow,
} from '@/lib/atendimento-presencial/rascunhos'
import { serializarClienteRegistro, type ClienteRegistroRow } from '@/lib/atendimento-presencial/registros'
import { converterViradaCartaoInput, valorOrdenavelViradaCartao } from '@/lib/atendimento-presencial/ficha-schema'
import { escaparTermoIlike, normalizarTermosBuscaNome, normalizarTermoBusca } from '@/lib/atendimento-presencial/clientes'

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

function jsonErro(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status })
}

function normalizarFiltroConsultora(valor: string | null) {
  return normalizarTermoBusca(valor) || ''
}

async function carregarConsultorasFinalizados(
  supabase: ReturnType<typeof createServiceClient>,
  contexto: {
    perfil: string
    usuarioId: string
    unidadesPermitidas: Array<{ id: string }>
  }
) {
  let query = supabase
    .from('atendimento_presencial_atendimentos')
    .select('consultora_nome')
    .eq('status', 'concluido')
    .not('consultora_nome', 'is', null)

  if (contexto.perfil === 'consultora') {
    query = query.eq('consultora_usuario_id', contexto.usuarioId)
  } else if (contexto.perfil !== 'superadmin') {
    if (contexto.unidadesPermitidas.length === 0) return []
    query = query.in('unidade_id', contexto.unidadesPermitidas.map((unidade) => unidade.id))
  }

  const { data, error } = await query
    .order('consultora_nome', { ascending: true })

  if (error) throw error
  const nomes = new Set<string>()
  for (const row of (data ?? []) as Array<{ consultora_nome: string | null }>) {
    const nome = normalizarFiltroConsultora(row.consultora_nome)
    if (nome) nomes.add(nome)
  }
  return Array.from(nomes).map((nome) => ({ nome }))
}

async function buscarClienteIdsPorNome(
  supabase: ReturnType<typeof createServiceClient>,
  nomeCliente: string
) {
  const termos = normalizarTermosBuscaNome(nomeCliente)
  if (termos.length === 0) return null
  if (termos.some((termo) => termo.length < 2)) {
    return { erro: jsonErro('Busca por nome deve ter ao menos 2 caracteres', 422) }
  }

  let query = supabase
    .from('atendimento_presencial_clientes')
    .select('id')

  for (const termo of termos) {
    query = query.ilike('nome', `%${escaparTermoIlike(termo)}%`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[ATENDIMENTO PRESENCIAL REGISTROS] Erro ao filtrar clientes por nome:', error)
    return { erro: jsonErro('Erro ao processar requisicao', 500) }
  }

  return { ids: (data ?? []).map((row) => row.id as string) }
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

export async function GET(request = new Request('http://localhost/api/atendimento-presencial/atendimentos')) {
  try {
    const loaded = await carregarContextoRegistros()
    if (!loaded.ok) return loaded.response
    const params = new URL(request.url).searchParams
    const viradaCartaoDe = params.get('viradaCartaoDe') ?? params.get('viradaCartao')
    const viradaCartaoAte = params.get('viradaCartaoAte')
    const nomeCliente = normalizarTermoBusca(params.get('clienteNome') ?? params.get('nomeCliente'))
    const consultora = normalizarFiltroConsultora(params.get('consultora'))
    const viradaDe = viradaCartaoDe ? converterViradaCartaoInput(viradaCartaoDe) : null
    const viradaAte = viradaCartaoAte ? converterViradaCartaoInput(viradaCartaoAte) : null
    if (viradaCartaoDe && !viradaDe) return jsonErro('Virada do cartao inicial invalida', 400)
    if (viradaCartaoAte && !viradaAte) return jsonErro('Virada do cartao final invalida', 400)

    const consultoras = await carregarConsultorasFinalizados(loaded.supabase, loaded.contexto)
    const clienteIdsFiltrados = nomeCliente
      ? await buscarClienteIdsPorNome(loaded.supabase, nomeCliente)
      : null
    if (clienteIdsFiltrados?.erro) return clienteIdsFiltrados.erro
    if (clienteIdsFiltrados && clienteIdsFiltrados.ids.length === 0) {
      return NextResponse.json({ ok: true, registros: [], consultoras })
    }

    let query = loaded.supabase
      .from('atendimento_presencial_atendimentos')
      .select(SELECT_ATENDIMENTO)
      .eq('status', 'concluido')

    if (clienteIdsFiltrados) {
      query = query.in('cliente_id', clienteIdsFiltrados.ids)
    }

    if (consultora) {
      query = query.ilike('consultora_nome', escaparTermoIlike(consultora))
    }

    if (loaded.contexto.perfil === 'consultora') {
      query = query.eq('consultora_usuario_id', loaded.contexto.usuarioId)
    } else if (loaded.contexto.perfil !== 'superadmin') {
      if (loaded.contexto.unidadesPermitidas.length === 0) {
        return NextResponse.json({ ok: true, registros: [] })
      }
      query = query.in('unidade_id', loaded.contexto.unidadesPermitidas.map((unidade) => unidade.id))
    }

    const { data, error } = await query
      .order('concluido_em', { ascending: false })
      .limit(viradaDe || viradaAte ? 200 : 50)

    if (error) {
      console.error('[ATENDIMENTO PRESENCIAL REGISTROS] Erro ao listar:', error)
      return jsonErro('Erro ao processar requisicao', 500)
    }

    let rows = (data ?? []) as unknown as AtendimentoPresencialRow[]
    if (viradaDe || viradaAte) {
      const valorDe = viradaDe ? valorOrdenavelViradaCartao(viradaDe.dia, viradaDe.mes) : null
      const valorAte = viradaAte ? valorOrdenavelViradaCartao(viradaAte.dia, viradaAte.mes) : null
      rows = rows.filter((row) => {
        if (!row.virada_cartao_dia || !row.virada_cartao_mes) return false
        const valor = valorOrdenavelViradaCartao(row.virada_cartao_dia, row.virada_cartao_mes)
        if (!valor) return false
        if (valorDe && valorAte && valorDe > valorAte) return valor >= valorDe || valor <= valorAte
        if (valorDe && valor < valorDe) return false
        if (valorAte && valor > valorAte) return false
        return true
      })
    }
    const clienteIds = Array.from(new Set(rows.map((row) => row.cliente_id).filter((id): id is string => Boolean(id))))
    const consultoraIds = Array.from(new Set(rows.map((row) => row.consultora_usuario_id)))
    const unidadeIds = Array.from(new Set(rows.map((row) => row.unidade_id)))

    const [clientesResult, consultorasResult, unidadesResult] = await Promise.all([
      clienteIds.length
        ? loaded.supabase.from('atendimento_presencial_clientes').select('id, nome, telefone_informado, parentesco, parentesco_outro').in('id', clienteIds)
        : Promise.resolve({ data: [], error: null }),
      consultoraIds.length
        ? loaded.supabase.from('usuarios_permitidos').select('id, email').in('id', consultoraIds)
        : Promise.resolve({ data: [], error: null }),
      unidadeIds.length
        ? loaded.supabase.from('app_unidades').select('id, nome').in('id', unidadeIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (clientesResult.error || consultorasResult.error || unidadesResult.error) {
      console.error('[ATENDIMENTO PRESENCIAL REGISTROS] Erro ao carregar dados relacionados:', {
        clientes: clientesResult.error,
        consultoras: consultorasResult.error,
        unidades: unidadesResult.error,
      })
      return jsonErro('Erro ao processar requisicao', 500)
    }

    const clientesPorId = new Map((clientesResult.data ?? []).map((cliente) => [cliente.id, serializarClienteRegistro(cliente as ClienteRegistroRow)]))
    const consultorasPorId = new Map((consultorasResult.data ?? []).map((consultora) => [consultora.id, consultora]))
    const unidadesPorId = new Map((unidadesResult.data ?? []).map((unidade) => [unidade.id, unidade]))

    return NextResponse.json({
      ok: true,
      consultoras,
      registros: rows.map((row) => ({
        id: row.id,
        clienteId: row.cliente_id,
        clienteNome: row.cliente_id ? clientesPorId.get(row.cliente_id)?.nome ?? 'Cliente nao localizada' : 'Cliente nao informada',
        clienteTelefone: row.cliente_id ? clientesPorId.get(row.cliente_id)?.telefone ?? null : null,
        consultoraUsuarioId: row.consultora_usuario_id,
        consultoraEmail: consultorasPorId.get(row.consultora_usuario_id)?.email ?? 'Consultora nao localizada',
        consultoraNomeManual: row.consultora_nome ?? null,
        unidadeId: row.unidade_id,
        unidadeNome: unidadesPorId.get(row.unidade_id)?.nome ?? 'Unidade nao localizada',
        resultadoAtendimento: row.resultado_atendimento,
        numeroLancamento: row.numero_lancamento ?? null,
        viradaCartaoDia: row.virada_cartao_dia ?? null,
        viradaCartaoMes: row.virada_cartao_mes ?? null,
        concluidoEm: row.concluido_em,
      })),
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL REGISTROS] Erro geral:', error)
    return jsonErro('Erro ao processar requisicao', 500)
  }
}
