import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireModuleAccess } from '@/lib/auth/module-access'

export const runtime = 'nodejs'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

type JsonValue = unknown

type PesquisaRow = {
  id: string
  created_at: string
  usuario_id: string | null
  usuario_email: string
  client_token: string | null
  run_id: string | null
  motor_versao: string
  origem: string
  cep: string | null
  numero_residencia: string | null
  logradouro: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  endereco_completo: string | null
  latitude: number | string | null
  longitude: number | string | null
  parametros_json?: JsonValue
  resultados_json?: JsonValue
  status: string
  erro_mensagem: string | null
  duracao_ms: number | null
  started_at: string | null
  finished_at: string | null
}

type PreAgendamentoRow = {
  id: string
  created_at: string
  pesquisa_auditoria_id: string | null
  usuario_id: string | null
  usuario_email: string
  client_token: string | null
  run_id: string | null
  data_pre_agendada: string | null
  tipo_resultado: string | null
  resultado_escolhido_json?: JsonValue
  payload_pre_agendamento_json?: JsonValue
  status: string
  erro_mensagem: string | null
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item))
    : []
}

function resumirResultado(row: PesquisaRow) {
  const resultados = asArray(row.resultados_json)
  const fretes = resultados.map((item) => getString(item.frete)).filter(Boolean)
  const parametros = asRecord(row.parametros_json)

  return {
    id: row.id,
    createdAt: row.created_at,
    usuarioEmail: row.usuario_email,
    cep: row.cep,
    numeroResidencia: row.numero_residencia,
    bairro: row.bairro,
    cidade: row.cidade,
    uf: row.uf,
    tempoNecessario: getString(parametros.tempoNecessario),
    valorInicialMinimo: typeof parametros.valorInicialMinimo === 'number' ? parametros.valorInicialMinimo : null,
    fretesResultados: fretes,
    resultadosQuantidade: resultados.length,
    status: row.status,
    duracaoMs: row.duracao_ms,
  }
}

function resumirPreAgendamento(row: PreAgendamentoRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    dataPreAgendada: row.data_pre_agendada,
    tipoResultado: row.tipo_resultado,
    status: row.status,
    erroMensagem: row.erro_mensagem,
  }
}

function formatarListaIn(ids: string[]) {
  return `(${ids.map((id) => `"${id}"`).join(',')})`
}

async function buscarIdsComPreAgendamento(params: URLSearchParams) {
  const supabase = createServiceClient()
  const dataPreAgendada = params.get('dataPreAgendada')?.trim()

  let query = supabase
    .from('procurar_datas_pre_agendamentos_auditoria')
    .select('pesquisa_auditoria_id, client_token, run_id')
    .limit(5000)

  if (dataPreAgendada) query = query.eq('data_pre_agendada', dataPreAgendada)

  const { data, error } = await query
  if (error) throw error

  const preRows = data ?? []
  const idsComVinculoDireto = preRows
    .map((row) => row.pesquisa_auditoria_id)
    .filter(Boolean) as string[]

  // Buscar pesquisas correspondentes para pré-agendamentos sem vínculo direto
  const preSemVinculo = preRows.filter((row) => !row.pesquisa_auditoria_id)
  const idsPorFallback: string[] = []

  if (preSemVinculo.length > 0) {
    const clientTokens = preSemVinculo.map((row) => row.client_token).filter(Boolean)
    const runIds = preSemVinculo.map((row) => row.run_id).filter(Boolean)

    if (clientTokens.length > 0 || runIds.length > 0) {
      let pesquisaQuery = supabase
        .from('procurar_datas_pesquisas_auditoria')
        .select('id')

      if (clientTokens.length > 0) {
        pesquisaQuery = pesquisaQuery.in('client_token', clientTokens)
      }
      if (runIds.length > 0) {
        pesquisaQuery = pesquisaQuery.or(runIds.map((id) => `run_id.eq.${id}`).join(','))
      }

      const { data: pesquisas, error: pesquisaError } = await pesquisaQuery.limit(5000)
      if (!pesquisaError && pesquisas) {
        idsPorFallback.push(...pesquisas.map((p) => p.id))
      }
    }
  }

  return Array.from(new Set([...idsComVinculoDireto, ...idsPorFallback]))
}

export async function GET(request: NextRequest) {
  const access = await requireModuleAccess('procurar_datas_auditoria')
  if (!access.ok) {
    console.warn('[PROCURAR_DATAS][auditoria] acesso negado na API')
    return access.response
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')?.trim()

  try {
    if (id) return await buscarDetalhe(id)
    return await buscarListagem(searchParams)
  } catch (error) {
    console.error('[PROCURAR_DATAS][auditoria] erro na consulta', {
      error: error instanceof Error ? error.message : 'erro desconhecido',
    })
    return NextResponse.json({ ok: false, message: 'Erro ao consultar auditoria' }, { status: 500 })
  }
}

async function buscarListagem(params: URLSearchParams) {
  const supabase = createServiceClient()
  const page = parsePositiveInt(params.get('page'), 1, 100000)
  const limit = parsePositiveInt(params.get('limit'), DEFAULT_LIMIT, MAX_LIMIT)
  const from = (page - 1) * limit
  const to = from + limit - 1

  const dataInicial = params.get('dataInicial')?.trim()
  const dataFinal = params.get('dataFinal')?.trim()
  const email = params.get('email')?.trim()
  const cep = params.get('cep')?.trim()
  const cidade = params.get('cidade')?.trim()
  const uf = params.get('uf')?.trim().toUpperCase()
  const status = params.get('status')?.trim()
  const tevePreAgendamento = params.get('tevePreAgendamento')?.trim()
  const dataPreAgendada = params.get('dataPreAgendada')?.trim()

  console.info('[PROCURAR_DATAS][auditoria] consulta listagem', {
    page,
    limit,
    filtros: {
      dataInicial: dataInicial || null,
      dataFinal: dataFinal || null,
      email: email || null,
      cep: cep || null,
      cidade: cidade || null,
      uf: uf || null,
      status: status || null,
      tevePreAgendamento: tevePreAgendamento || null,
      dataPreAgendada: dataPreAgendada || null,
    },
  })

  let idsComPreAgendamento: string[] | null = null
  if (tevePreAgendamento === 'sim' || tevePreAgendamento === 'nao' || dataPreAgendada) {
    idsComPreAgendamento = await buscarIdsComPreAgendamento(params)
    if ((tevePreAgendamento === 'sim' || dataPreAgendada) && idsComPreAgendamento.length === 0) {
      return NextResponse.json({ ok: true, items: [], total: 0, page, limit })
    }
  }

  let query = supabase
    .from('procurar_datas_pesquisas_auditoria')
    .select(
      'id, created_at, usuario_id, usuario_email, client_token, run_id, motor_versao, origem, cep, numero_residencia, logradouro, bairro, cidade, uf, endereco_completo, latitude, longitude, parametros_json, resultados_json, status, erro_mensagem, duracao_ms, started_at, finished_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (dataInicial) query = query.gte('created_at', `${dataInicial}T00:00:00.000Z`)
  if (dataFinal) query = query.lte('created_at', `${dataFinal}T23:59:59.999Z`)
  if (email) query = query.ilike('usuario_email', `%${email}%`)
  if (cep) query = query.ilike('cep', `%${cep.replace(/\D/g, '') || cep}%`)
  if (cidade) query = query.ilike('cidade', `%${cidade}%`)
  if (uf) query = query.eq('uf', uf)
  if (status) query = query.eq('status', status)
  if (tevePreAgendamento === 'sim' || dataPreAgendada) {
    query = query.in('id', idsComPreAgendamento ?? [])
  } else if (tevePreAgendamento === 'nao' && idsComPreAgendamento && idsComPreAgendamento.length > 0) {
    query = query.not('id', 'in', formatarListaIn(idsComPreAgendamento))
  }

  const { data, error, count } = await query
  if (error) throw error

  const pesquisas = (data ?? []) as PesquisaRow[]
  const ids = pesquisas.map((row) => row.id)

  const prePorPesquisa = new Map<string, PreAgendamentoRow[]>()
  if (ids.length > 0) {
    // Buscar pré-agendamentos com vínculo direto
    const { data: preRowsVinculo, error: preErrorVinculo } = await supabase
      .from('procurar_datas_pre_agendamentos_auditoria')
      .select('id, created_at, pesquisa_auditoria_id, usuario_id, usuario_email, client_token, run_id, data_pre_agendada, tipo_resultado, status, erro_mensagem')
      .in('pesquisa_auditoria_id', ids)
      .order('created_at', { ascending: false })

    if (preErrorVinculo) throw preErrorVinculo

    for (const pre of (preRowsVinculo ?? []) as PreAgendamentoRow[]) {
      if (!pre.pesquisa_auditoria_id) continue
      const atual = prePorPesquisa.get(pre.pesquisa_auditoria_id) ?? []
      atual.push(pre)
      prePorPesquisa.set(pre.pesquisa_auditoria_id, atual)
    }

    // Buscar pré-agendamentos sem vínculo que correspondam por client_token/run_id
    const { data: pesquisasParaFallback, error: pesquisasError } = await supabase
      .from('procurar_datas_pesquisas_auditoria')
      .select('id, client_token, run_id')
      .in('id', ids)

    if (!pesquisasError && pesquisasParaFallback) {
      const clientTokensMap = new Map<string, string>()
      const runIdsMap = new Map<string, string>()

      for (const p of pesquisasParaFallback) {
        if (p.client_token) clientTokensMap.set(p.client_token, p.id)
        if (p.run_id) runIdsMap.set(p.run_id, p.id)
      }

      const clientTokens = Array.from(clientTokensMap.keys())
      const runIds = Array.from(runIdsMap.keys())

      if (clientTokens.length > 0 || runIds.length > 0) {
        let preQuery = supabase
          .from('procurar_datas_pre_agendamentos_auditoria')
          .select('id, created_at, pesquisa_auditoria_id, usuario_id, usuario_email, client_token, run_id, data_pre_agendada, tipo_resultado, status, erro_mensagem')
          .is('pesquisa_auditoria_id', null)
          .order('created_at', { ascending: false })

        if (clientTokens.length > 0) {
          preQuery = preQuery.in('client_token', clientTokens)
        }
        if (runIds.length > 0) {
          preQuery = preQuery.or(runIds.map((id) => `run_id.eq.${id}`).join(','))
        }

        const { data: preRowsFallback, error: preErrorFallback } = await preQuery.limit(5000)

        if (!preErrorFallback && preRowsFallback) {
          for (const pre of (preRowsFallback ?? []) as PreAgendamentoRow[]) {
            const pesquisaId = pre.client_token ? clientTokensMap.get(pre.client_token) : pre.run_id ? runIdsMap.get(pre.run_id) : null
            if (pesquisaId) {
              const atual = prePorPesquisa.get(pesquisaId) ?? []
              atual.push(pre)
              prePorPesquisa.set(pesquisaId, atual)
            }
          }
        }
      }
    }
  }

  const items = pesquisas.map((row) => {
    const preAgendamentos = prePorPesquisa.get(row.id) ?? []
    return {
      ...resumirResultado(row),
      preAgendamento: preAgendamentos[0] ? resumirPreAgendamento(preAgendamentos[0]) : null,
      preAgendamentosQuantidade: preAgendamentos.length,
    }
  })

  return NextResponse.json({ ok: true, items, total: count ?? 0, page, limit })
}

async function buscarDetalhe(id: string) {
  const supabase = createServiceClient()

  const { data: pesquisa, error } = await supabase
    .from('procurar_datas_pesquisas_auditoria')
    .select('id, created_at, usuario_id, usuario_email, client_token, run_id, motor_versao, origem, cep, numero_residencia, logradouro, bairro, cidade, uf, endereco_completo, latitude, longitude, parametros_json, resultados_json, status, erro_mensagem, duracao_ms, started_at, finished_at')
    .eq('id', id)
    .single()

  if (error) throw error

  const { data: preAgendamentos, error: preError } = await supabase
    .from('procurar_datas_pre_agendamentos_auditoria')
    .select('id, created_at, pesquisa_auditoria_id, usuario_id, usuario_email, client_token, run_id, data_pre_agendada, tipo_resultado, resultado_escolhido_json, payload_pre_agendamento_json, status, erro_mensagem')
    .eq('pesquisa_auditoria_id', id)
    .order('created_at', { ascending: false })

  if (preError) throw preError

  return NextResponse.json({
    ok: true,
    pesquisa: pesquisa as PesquisaRow,
    preAgendamentos: (preAgendamentos ?? []) as PreAgendamentoRow[],
  })
}
