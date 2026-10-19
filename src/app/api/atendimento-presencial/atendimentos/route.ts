import { filtrarDadosListagem, lerFiltrosListagem, lerPaginas } from '@/lib/atendimento-presencial/filtros-listagem'
import { normalizarNomeConsultora as nomeConsultoraCanonico } from '@/lib/atendimento-presencial/ficha-schema'
import { NextResponse } from 'next/server'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'
import {
  carregarPerfilAtendimento,
  listarUnidadesDoContexto,
  type AtendimentoPresencialRow,
} from '@/lib/atendimento-presencial/rascunhos'
import { SITUACOES_VENDA, consultoraDeHomologacao, registroNaoCliente, serializarClienteRegistro, type ClienteRegistroRow } from '@/lib/atendimento-presencial/registros'
import { converterViradaCartaoInput, valorOrdenavelViradaCartao } from '@/lib/atendimento-presencial/ficha-schema'
import { escaparTermoIlike, normalizarTermosBuscaNome, normalizarTermoBusca } from '@/lib/atendimento-presencial/clientes'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'

export const runtime = 'nodejs'

// Leitura compativel antes/depois da migration v2; resposta limitada pelos DTOs.
const SELECT_ATENDIMENTO = '*'

function jsonErro(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status })
}

function normalizarFiltroConsultora(valor: string | null) {
  return nomeConsultoraCanonico(valor)
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

export async function GET(request: Request) {
  try {
    const loaded = await carregarContextoRegistros()
    if (!loaded.ok) return loaded.response
    const params = new URL(request.url).searchParams
    let filtrosNovos
    try { filtrosNovos = lerFiltrosListagem(params) } catch (error) { return jsonErro(error instanceof Error ? error.message : 'Filtros inválidos', 400) }
    const viradaCartaoDe = params.get('viradaCartaoDe') ?? params.get('viradaCartao')
    const viradaCartaoAte = params.get('viradaCartaoAte')
    const requestedPage = Number(params.get('page') ?? '1')
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
    const nomeCliente = normalizarTermoBusca(params.get('clienteNome') ?? params.get('nomeCliente'))
    const consultora = normalizarFiltroConsultora(params.get('consultora'))
    const unidadeId = params.get('unidadeId')?.trim() ?? ''
    const situacaoVenda = params.get('situacaoVenda')?.trim() ?? ''
    if (situacaoVenda && !SITUACOES_VENDA.some((item) => item.chave === situacaoVenda)) {
      return jsonErro('Situacao da venda invalida', 400)
    }
    const viradaDe = viradaCartaoDe ? converterViradaCartaoInput(viradaCartaoDe) : null
    const viradaAte = viradaCartaoAte ? converterViradaCartaoInput(viradaCartaoAte) : null
    if (viradaCartaoDe && !viradaDe) return jsonErro('Virada do cartao inicial invalida', 400)
    if (viradaCartaoAte && !viradaAte) return jsonErro('Virada do cartao final invalida', 400)
    if (unidadeId && !loaded.contexto.unidadesPermitidas.some((unidade) => unidade.id === unidadeId)) {
      return jsonErro('Filial invalida para este usuario', 400)
    }

    const consultoras = await carregarConsultorasFinalizados(loaded.supabase, loaded.contexto)
    const unidades = loaded.contexto.unidadesPermitidas.map(({ id, nome }) => ({ id, nome }))
    const clienteIdsFiltrados = nomeCliente
      ? await buscarClienteIdsPorNome(loaded.supabase, nomeCliente)
      : null
    if (clienteIdsFiltrados?.erro) return clienteIdsFiltrados.erro
    if (clienteIdsFiltrados && clienteIdsFiltrados.ids.length === 0) {
      return NextResponse.json({ ok: true, registros: [], consultoras, unidades, page: 1, pageSize: TABLE_PAGE_SIZE, total: 0, clientesUnicos: 0, visitasNaoClientes: 0 })
    }

    let query = loaded.supabase
      .from('atendimento_presencial_atendimentos')
      .select(SELECT_ATENDIMENTO)
      .eq('status', 'concluido')

    if (situacaoVenda) {
      query = query.eq('resultado_atendimento', situacaoVenda)
    }

    if (clienteIdsFiltrados) {
      query = query.in('cliente_id', clienteIdsFiltrados.ids)
    }

    if (consultora) {
      query = query.ilike('consultora_nome', escaparTermoIlike(consultora))
    }

    if (unidadeId) {
      query = query.eq('unidade_id', unidadeId)
    }

    if (loaded.contexto.perfil === 'consultora') {
      query = query.eq('consultora_usuario_id', loaded.contexto.usuarioId)
    } else if (loaded.contexto.perfil !== 'superadmin') {
      if (loaded.contexto.unidadesPermitidas.length === 0) {
        return NextResponse.json({ ok: true, registros: [], consultoras, unidades, page: 1, pageSize: TABLE_PAGE_SIZE, total: 0, clientesUnicos: 0, visitasNaoClientes: 0 })
      }
      query = query.in('unidade_id', loaded.contexto.unidadesPermitidas.map((unidade) => unidade.id))
    }

    // Não limitar filtros/contagens ao teto de uma resposta do PostgREST.
    const loteSize = 500
    let rows: AtendimentoPresencialRow[] = []
    for (let offset = 0; ; offset += loteSize) {
      const { data, error } = await query
        .order('concluido_em', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + loteSize - 1)
      if (error) {
        console.error('[ATENDIMENTO PRESENCIAL REGISTROS] Erro ao listar:', error)
        return jsonErro('Erro ao processar requisicao', 500)
      }
      const lote = (data ?? []) as unknown as AtendimentoPresencialRow[]
      rows.push(...lote)
      if (lote.length < loteSize) break
    }
    // Testes só entram na consulta quando sua consultora é filtrada explicitamente.
    if (!consultoraDeHomologacao(consultora)) {
      rows = rows.filter((row) => !consultoraDeHomologacao(row.consultora_nome))
    }
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

    const clientesBusca = (filtrosNovos.contato || filtrosNovos.telefoneCliente) && rows.some(row => row.cliente_id) ? await lerPaginas((de, ate) => loaded.supabase.from('atendimento_presencial_clientes').select('id, telefone_informado, telefone_normalizado').order('id').range(de, ate)) : []
    const telefones = new Map(clientesBusca.map(c => [c.id, c.telefone_informado || c.telefone_normalizado || null]))
    const [departamentosFiltro, motivosFiltro] = await Promise.all([
      filtrosNovos.departamentos.length ? lerPaginas((de, ate) => loaded.supabase.from('atendimento_presencial_departamentos').select('atendimento_id').in('departamento', filtrosNovos.departamentos).order('id').range(de, ate)) : [],
      filtrosNovos.motivos.length ? lerPaginas((de, ate) => loaded.supabase.from('atendimento_presencial_motivos').select('atendimento_id').in('motivo', filtrosNovos.motivos).order('id').range(de, ate)) : [],
    ])
    const departamentosIds = new Set(departamentosFiltro.map(item => item.atendimento_id))
    const motivosIds = new Set(motivosFiltro.map(item => item.atendimento_id))
    rows = rows.filter(row => filtrarDadosListagem({
      data: row.iniciado_em, tipo: row.tipo_atendimento ?? (row.cliente_id ? 'cliente' : null), clienteId: row.cliente_id,
      telefone: row.cliente_id ? telefones.get(row.cliente_id) ?? null : null,
      numeroLancamento: row.numero_lancamento, motivoVisita: row.motivo_visita,
    }, filtrosNovos) && (!filtrosNovos.departamentos.length || departamentosIds.has(row.id)) && (!filtrosNovos.motivos.length || motivosIds.has(row.id)))
    const clientesUnicos = new Set(rows.map(row => row.cliente_id).filter(Boolean)).size
    const visitasNaoClientes = rows.filter(row => row.tipo_atendimento === 'nao_cliente').length
    const total = rows.length
    const totalPages = Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    rows = rows.slice((currentPage - 1) * TABLE_PAGE_SIZE, currentPage * TABLE_PAGE_SIZE)

    const clienteIds = Array.from(new Set(rows.map((row) => row.cliente_id).filter((id): id is string => Boolean(id))))
    const consultoraIds = Array.from(new Set(rows.map((row) => row.consultora_usuario_id)))
    const unidadeIds = Array.from(new Set(rows.map((row) => row.unidade_id)))

    const [clientesResult, consultorasResult, unidadesResult] = await Promise.all([
      clienteIds.length
        ? loaded.supabase.from('atendimento_presencial_clientes').select('id, nome, telefone_informado, telefone_normalizado, telefone_normalizado_ddi, parentesco, parentesco_outro').in('id', clienteIds)
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
      unidades,
      clientesUnicos, visitasNaoClientes,
      page: currentPage,
      pageSize: TABLE_PAGE_SIZE,
      total,
      registros: rows.map((row) => ({
        id: row.id,
        versaoFluxo: row.versao_fluxo ?? null,
        telefoneRecusaConfirmada: row.telefone_recusa_confirmada ?? null,
        tipoAtendimento: row.tipo_atendimento ?? null,
        motivoVisita: row.motivo_visita ?? null,
        clienteId: row.cliente_id,
        clienteNome: registroNaoCliente({ versaoFluxo: row.versao_fluxo, tipoAtendimento: row.tipo_atendimento }) ? 'Não cliente' : row.cliente_id ? clientesPorId.get(row.cliente_id)?.nome ?? 'Cliente nao localizada' : 'Cliente nao informada',
        clienteTelefone: row.cliente_id ? clientesPorId.get(row.cliente_id)?.telefone ?? null : null,
        consultoraUsuarioId: row.consultora_usuario_id,
        consultoraEmail: consultorasPorId.get(row.consultora_usuario_id)?.email ?? 'Consultora nao localizada',
        consultoraNomeManual: nomeConsultoraCanonico(row.consultora_nome) || null,
        unidadeId: row.unidade_id,
        unidadeNome: unidadesPorId.get(row.unidade_id)?.nome ?? 'Unidade nao localizada',
        resultadoAtendimento: row.resultado_atendimento,
        numeroLancamento: row.numero_lancamento ?? null,
        viradaCartaoDia: row.virada_cartao_dia ?? null,
        viradaCartaoMes: row.virada_cartao_mes ?? null,
        iniciadoEm: row.iniciado_em,
        concluidoEm: row.concluido_em,
      })),
    })
  } catch (error) {
    console.error('[ATENDIMENTO PRESENCIAL REGISTROS] Erro geral:', error)
    return jsonErro('Erro ao processar requisicao', 500)
  }
}
