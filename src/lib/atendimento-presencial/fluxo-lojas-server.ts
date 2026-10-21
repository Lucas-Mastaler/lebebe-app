import 'server-only'
import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { createServiceClient } from '@/lib/supabase/service'
import { carregarPerfilAtendimento } from './rascunhos'
import { allowedUnits, compare, daysBetween, readFlowFilters, selectRecords, pageRecords, type FlowRow, type FlowUnit } from './fluxo-lojas'
import { getExternalFlow } from '@/lib/altervision/service'
import { serializarAtendimentoPresencial, type AtendimentoPresencialRow } from './rascunhos'
import { serializarClienteRegistro, type ClienteRegistroRow, type RegistroAtendimentoDetalheDTO } from './registros'

export const FLOW_MODULE = 'atendimento_presencial_fluxo_lojas'
export const FLOW_COLUMNS = 'id,unidade_id,status,versao_fluxo,tipo_atendimento,cliente_id,iniciado_em,concluido_em,consultora_nome,resultado_atendimento,motivo_visita'
export const flowJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
export async function flowContext() {
  const auth = await requireModuleAccess(FLOW_MODULE)
  if (!auth.ok) return { ok: false as const, response: auth.response }
  const window = await checkAccessWindowForUser({ usuarioId: auth.allowedUser.id, role: auth.allowedUser.role as 'user' | 'superadmin' })
  if (!window.ok) return { ok: false as const, response: flowJson({ ok: false, message: 'Fora da janela de acesso.' }, 403) }
  const supabase = createServiceClient()
  const perfil = await carregarPerfilAtendimento(supabase, auth.allowedUser)
  if (!perfil || !['superadmin', 'gestao', 'supervisora_loja'].includes(perfil)) return { ok: false as const, response: flowJson({ ok: false, message: 'Perfil sem acesso ao comparativo.' }, 403) }
  // Vínculos e unidades vêm sempre do servidor; nenhuma permissão de URL é aceita.
  const unitsResult = await supabase.from('app_unidades').select('id,chave,nome').eq('ativo', true).order('nome')
  if (unitsResult.error) throw new Error('flow_units_read')
  let linked: FlowUnit[] = []
  if (perfil === 'supervisora_loja') {
    const links = await supabase.from('app_usuarios_unidades').select('unidade_id').eq('usuario_id', auth.allowedUser.id)
    if (links.error) throw new Error('flow_links_read')
    const ids = new Set((links.data ?? []).map(row => row.unidade_id))
    linked = (unitsResult.data ?? []).filter(unit => ids.has(unit.id))
  }
  return { ok: true as const, supabase, units: allowedUnits(perfil, unitsResult.data ?? [], linked) }
}
export async function loadFlow(request: Request, mode: 'dashboard' | 'table' | 'refresh') {
  try {
    const ctx = await flowContext()
    if (!ctx.ok) return ctx.response
    const params = new URL(request.url).searchParams
    let filters
    try { filters = readFlowFilters(params) } catch (error) { return flowJson({ ok: false, message: error instanceof Error ? error.message : 'Filtros inválidos.' }, 400) }
    if (filters.unidadeId && !ctx.units.some(unit => unit.id === filters.unidadeId)) return flowJson({ ok: false, message: 'Filial não autorizada.' }, 403)
    const units = ctx.units.filter(unit => !filters.unidadeId || filters.unidadeId === unit.id)
    const rows: FlowRow[] = []
    if (units.length) {
      const days = daysBetween(filters.de, filters.ate)
      const end = new Date(`${days[days.length - 1]}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 2)
      // Envelope UTC amplo; a função comum aplica o dia/hora IANA exato antes de contar.
      for (let offset = 0; ; offset += 500) {
        const result = await ctx.supabase.from('atendimento_presencial_atendimentos').select(FLOW_COLUMNS)
          .eq('status', 'concluido').in('unidade_id', units.map(unit => unit.id))
          .gte('iniciado_em', `${filters.de}T00:00:00Z`).lt('iniciado_em', `${end.toISOString().slice(0,10)}T00:00:00Z`)
          .order('iniciado_em', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 499)
        if (result.error) throw new Error('flow_records_read')
        const batch = (result.data ?? []) as FlowRow[]; rows.push(...batch)
        if (batch.length < 500) break
      }
    }
    const { selected, invalid } = selectRecords(rows, units, filters)
    let tabela
    try { tabela = pageRecords(selected, params.get('page')) } catch { return flowJson({ ok: false, message: 'Página inválida.' }, 400) }
    if (mode === 'table') return flowJson({ ok: true, ...tabela, fetchedAt: new Date().toISOString() })
    const external = units.length ? await getExternalFlow(filters.de, filters.ate, mode === 'refresh') : { state: 'not_configured' as const, hourly: [], daily: [], adjusted: [], fetchedAt: null, warnings: [] }
    const dashboard = compare(selected, ctx.units, filters, external)
    const allConsultoras = selectRecords(rows, units, { ...filters, tipo: '', consultora: '', situacao: '' }).selected
    dashboard.consultoras = [...new Set(allConsultoras.map(row => row.consultora).filter(name => name !== 'Não informada'))].sort()
    if (invalid) dashboard.avisos.push(`${invalid} registro(s) com classificação ou início incompatível; revisão necessária.`)
    if (!units.length) dashboard.avisos.push('Nenhuma filial mapeada está autorizada para este usuário.')
    return flowJson({ ok: true, ...dashboard, tabela })
  } catch {
    // Erro interno não inclui linhas, nomes de consultoras, payloads externos ou secrets.
    console.error('[FLUXO LOJAS] Falha na leitura autorizada do comparativo.')
    return flowJson({ ok: false, message: 'Não foi possível consultar as Pranchetas. Tente atualizar novamente.' }, 500)
  }
}
export async function loadOriginalDetails(id: string) {
  try {
    const ctx = await flowContext()
    if (!ctx.ok) return ctx.response
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return flowJson({ ok: false, message: 'ID inválido.' }, 400)
    if (!ctx.units.length) return flowJson({ ok: false, message: 'Atendimento não encontrado.' }, 404)

    const recordResult = await ctx.supabase.from('atendimento_presencial_atendimentos').select('*')
      .eq('id', id).eq('status', 'concluido').in('unidade_id', ctx.units.map(unit => unit.id)).maybeSingle()
    if (recordResult.error) throw new Error('flow_detail_record_read')
    if (!recordResult.data) return flowJson({ ok: false, message: 'Atendimento não encontrado.' }, 404)
    const row = recordResult.data as unknown as AtendimentoPresencialRow
    const registros = selectRecords([row as unknown as FlowRow], ctx.units, { de: '1900-01-01', ate: '9999-12-31', unidadeId: '', horaDe: 0, horaAte: 24, tipo: '', consultora: '', situacao: '' }).selected
    if (!registros.length) return flowJson({ ok: false, message: 'Atendimento não encontrado.' }, 404)

    const [cliente, criancas, departamentos, produtos, motivos, historico] = await Promise.all([
      row.cliente_id ? ctx.supabase.from('atendimento_presencial_clientes').select('id,nome,telefone_informado,telefone_normalizado,telefone_normalizado_ddi,parentesco,parentesco_outro').eq('id', row.cliente_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ctx.supabase.from('atendimento_presencial_criancas').select('*').eq('atendimento_id', id).order('ordem', { ascending: true }),
      ctx.supabase.from('atendimento_presencial_departamentos').select('*').eq('atendimento_id', id).order('ordem', { ascending: true }),
      ctx.supabase.from('atendimento_presencial_produtos_interesse').select('*').eq('atendimento_id', id).order('ordem', { ascending: true }),
      ctx.supabase.from('atendimento_presencial_motivos').select('*').eq('atendimento_id', id).order('ordem', { ascending: true }),
      ctx.supabase.from('atendimento_presencial_historico').select('*').eq('atendimento_id', id).order('created_at', { ascending: false }),
    ])
    if (cliente.error || criancas.error || departamentos.error || produtos.error || motivos.error || historico.error) throw new Error('flow_detail_related_read')

    const detail: RegistroAtendimentoDetalheDTO = {
      atendimento: serializarAtendimentoPresencial(row) as RegistroAtendimentoDetalheDTO['atendimento'],
      cliente: serializarClienteRegistro(cliente.data as ClienteRegistroRow | null),
      criancas: (criancas.data ?? []) as RegistroAtendimentoDetalheDTO['criancas'],
      departamentos: (departamentos.data ?? []) as RegistroAtendimentoDetalheDTO['departamentos'],
      produtosInteresse: (produtos.data ?? []) as RegistroAtendimentoDetalheDTO['produtosInteresse'],
      motivos: (motivos.data ?? []) as RegistroAtendimentoDetalheDTO['motivos'],
      historico: (historico.data ?? []) as RegistroAtendimentoDetalheDTO['historico'],
      podeEditar: false,
      motivoBloqueio: null,
    }
    const unidadeNome = ctx.units.find(unit => unit.id === row.unidade_id)?.nome ?? row.unidade_id
    return flowJson({ ok: true, registro: registros[0], detalhe: detail, unidadeNome })
  } catch {
    console.error('[FLUXO LOJAS] Falha na leitura detalhada do atendimento.')
    return flowJson({ ok: false, message: 'Não foi possível consultar o atendimento.' }, 500)
  }
}
