import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import type { SgiCards, SgiVendasResponse } from '@/types/sgi'

export const runtime = 'nodejs'

const PER_PAGE = 25

function sumField(rows: Record<string, unknown>[], field: string): number {
  return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0)
}

function avgField(rows: Record<string, unknown>[], field: string): number {
  const valid = rows.filter(r => r[field] != null)
  if (!valid.length) return 0
  return valid.reduce((acc, r) => acc + (Number(r[field]) || 0), 0) / valid.length
}

export async function POST(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await request.json()
  const {
    dataInicio,
    dataFim,
    cliente,
    telefone,
    filial,
    vendedor,
    operacao,
    status,
    numeroLancamento,
    filiais,
    vendedores,
    operacoes,
    status: statusArray,
    page = 1,
  } = body || {}

  // Backward compatibility: accept old single-value fields
  const filiaisArr = filiais ?? (filial ? [filial] : [])
  const vendedoresArr = vendedores ?? (vendedor ? [vendedor] : [])
  const operacoesArr = operacoes ?? (operacao ? [operacao] : [])
  const statusArr = statusArray ?? (status ? [status] : [])

  console.log('[API][SGI][VENDAS] POST filtros=', {
    dataInicio, dataFim, cliente, telefone: telefone ? '***' : undefined,
    filiais: filiaisArr, vendedores: vendedoresArr, operacoes: operacoesArr,
    status: statusArr, numeroLancamento, page,
  })

  const supabase = await createClient()

  // --- Filtro por telefone via tabela de contatos (deduplicado) ---
  let filteredIds: string[] | null = null
  if (telefone?.trim()) {
    const cleaned = telefone.trim().replace(/\D/g, '')
    if (cleaned.length >= 3) {
      // Try with cleaned phone and also with DDI prefix (55)
      const withDDI = `55${cleaned}`
      const { data: contatosRows, error: contatosError } = await supabase
        .from('sgi_documentos_saida_contatos')
        .select('documento_saida_id')
        .or(`telefone_normalizado.ilike.%${cleaned}%,telefone_normalizado_ddi.ilike.%${cleaned}%,telefone_normalizado.ilike.%${withDDI}%,telefone_normalizado_ddi.ilike.%${withDDI}%`)

      if (contatosError) {
        console.error('[API][SGI][VENDAS] Erro ao buscar contatos:', contatosError)
      }

      // Deduplicar IDs antes de consultar tabela principal
      const ids = [...new Set(contatosRows?.map(c => c.documento_saida_id) ?? [])]
      filteredIds = ids
    }
  }

  // Sem correspondência no filtro de telefone → retornar vazio imediatamente
  if (filteredIds !== null && filteredIds.length === 0) {
    const emptyCards: SgiCards = {
      total_vendas: 0, valor_total: 0, valor_pago_novo: 0,
      valor_credito_troca: 0, valor_pendente_pagamento: 0,
      valor_frete: 0, percentual_desconto_medio: 0,
      ticket_medio: 0, total_finalizadas: 0,
    }
    return NextResponse.json({ vendas: [], total: 0, cards: emptyCards } satisfies SgiVendasResponse)
  }

  const offset = (Math.max(1, page) - 1) * PER_PAGE

  // --- Query paginada (lista) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listQ: any = supabase
    .from('sgi_documentos_saida')
    .select(
      'id, numero_lancamento, numero_documento, cliente, telefone_principal, filial, operacao, data_fechamento, vendedor, status, valor_total, valor_total_texto, valor_pago_novo, valor_credito_troca, valor_pendente_pagamento, percentual_desconto, percentual_desconto_texto, valor_frete, valor_frete_texto',
      { count: 'exact' }
    )
    .order('data_fechamento', { ascending: false, nullsFirst: false })
    .range(offset, offset + PER_PAGE - 1)

  // --- Query de agregação (cards, sem paginação) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cardsQ: any = supabase
    .from('sgi_documentos_saida')
    .select('valor_total, valor_pago_novo, valor_credito_troca, valor_pendente_pagamento, valor_frete, percentual_desconto, status')

  // --- Aplicar filtros em ambas as queries ---
  if (dataInicio) {
    listQ = listQ.gte('data_fechamento', dataInicio)
    cardsQ = cardsQ.gte('data_fechamento', dataInicio)
  }
  if (dataFim) {
    const fim = `${dataFim}T23:59:59`
    listQ = listQ.lte('data_fechamento', fim)
    cardsQ = cardsQ.lte('data_fechamento', fim)
  }
  // Multi-term cliente search: split by spaces and apply AND for each term
  if (cliente?.trim()) {
    const terms = cliente.trim().split(/\s+/).filter((t: string) => t.length > 0)
    if (terms.length > 0) {
      terms.forEach((term: string) => {
        listQ = listQ.ilike('cliente', `%${term}%`)
        cardsQ = cardsQ.ilike('cliente', `%${term}%`)
      })
    }
  }
  // Multi-select filiais
  if (filiaisArr.length > 0) {
    listQ = listQ.in('filial', filiaisArr)
    cardsQ = cardsQ.in('filial', filiaisArr)
  }
  // Multi-select vendedores
  if (vendedoresArr.length > 0) {
    listQ = listQ.in('vendedor', vendedoresArr)
    cardsQ = cardsQ.in('vendedor', vendedoresArr)
  }
  // Multi-select operacoes
  if (operacoesArr.length > 0) {
    listQ = listQ.in('operacao', operacoesArr)
    cardsQ = cardsQ.in('operacao', operacoesArr)
  }
  // Multi-select status
  if (statusArr.length > 0) {
    listQ = listQ.in('status', statusArr)
    cardsQ = cardsQ.in('status', statusArr)
  }
  if (numeroLancamento?.trim()) {
    listQ = listQ.ilike('numero_lancamento', `%${numeroLancamento.trim()}%`)
    cardsQ = cardsQ.ilike('numero_lancamento', `%${numeroLancamento.trim()}%`)
  }
  if (filteredIds !== null) {
    listQ = listQ.in('id', filteredIds)
    cardsQ = cardsQ.in('id', filteredIds)
  }

  // --- Executar queries em paralelo ---
  const [listResult, cardsResult] = await Promise.all([listQ, cardsQ])

  if (listResult.error) {
    console.error('[API][SGI][VENDAS] Erro na listagem:', listResult.error)
    return NextResponse.json({ error: 'Erro ao buscar vendas' }, { status: 500 })
  }

  const allRows: Record<string, unknown>[] = cardsResult.data ?? []

  const cards: SgiCards = {
    total_vendas: allRows.length,
    valor_total: sumField(allRows, 'valor_total'),
    valor_pago_novo: sumField(allRows, 'valor_pago_novo'),
    valor_credito_troca: sumField(allRows, 'valor_credito_troca'),
    valor_pendente_pagamento: sumField(allRows, 'valor_pendente_pagamento'),
    valor_frete: sumField(allRows, 'valor_frete'),
    percentual_desconto_medio: avgField(allRows, 'percentual_desconto'),
    ticket_medio: avgField(allRows, 'valor_total'),
    total_finalizadas: allRows.filter(r => String(r.status ?? '').toLowerCase() === 'finalizado').length,
  }

  console.log('[API][SGI][VENDAS] total=', listResult.count, 'cards.total_vendas=', cards.total_vendas)

  const listData: Record<string, unknown>[] = listResult.data ?? []
  const numeroLancamentos = listData.map((v) => v.numero_lancamento as string).filter(Boolean)

  // --- Enriquecimento Digisac (best-effort, não bloqueia se falhar) ---
  let digisacMap = new Map<string, {
    chamados_ciclo: number
    interacoes_ciclo: number
    chamados_janela_90: number
    interacoes_janela_90: number
    primeiro_contato: string | null
    status_digisac: string | null
    ultima_sync: string | null
  }>()

  if (numeroLancamentos.length > 0) {
    try {
      const [vinculosResult, jobsResult] = await Promise.all([
        supabase
          .from('venda_conversa_vinculos')
          .select('numero_lancamento, digisac_ticket_id, considerada_na_janela_90_dias, considerada_no_ciclo_venda, inicio_chamado, ordem_conversa_para_venda')
          .in('numero_lancamento', numeroLancamentos),
        supabase
          .from('digisac_sync_fila')
          .select('numero_lancamento, status, finalizado_em')
          .in('numero_lancamento', numeroLancamentos)
          .in('status', ['concluido', 'ignorado_cache_valido', 'erro', 'pendente', 'processando'])
          .order('created_at', { ascending: false }),
      ])

      const vinculos = vinculosResult.data ?? []
      const allTicketIds = vinculos.map((v) => v.digisac_ticket_id).filter(Boolean)

      let interacoesMap = new Map<string, number>()
      if (allTicketIds.length > 0) {
        const { data: conversas } = await supabase
          .from('digisac_conversas_resumo')
          .select('digisac_ticket_id, quantidade_interacoes')
          .in('digisac_ticket_id', allTicketIds)
        for (const c of (conversas ?? [])) {
          interacoesMap.set(c.digisac_ticket_id, c.quantidade_interacoes ?? 0)
        }
      }

      // Deduplica jobs (primeiro por numero_lancamento = mais recente)
      const jobsSeenSet = new Set<string>()
      const jobsLatest = new Map<string, { status: string; finalizado_em: string | null }>()
      for (const j of (jobsResult.data ?? [])) {
        if (!jobsSeenSet.has(j.numero_lancamento)) {
          jobsSeenSet.add(j.numero_lancamento)
          jobsLatest.set(j.numero_lancamento, { status: j.status, finalizado_em: j.finalizado_em })
        }
      }

      for (const lancamento of numeroLancamentos) {
        const vinculosVenda = vinculos.filter((v) => v.numero_lancamento === lancamento)
        // Ciclo da venda (métrica principal)
        const vinculosCiclo = vinculosVenda.filter((v) => v.considerada_no_ciclo_venda)
        // Janela 90 dias (compatibilidade)
        const vinculosJanela = vinculosVenda.filter((v) => v.considerada_na_janela_90_dias)

        const chamados_ciclo = vinculosCiclo.length
        const interacoes_ciclo = vinculosCiclo.reduce(
          (sum, v) => sum + (interacoesMap.get(v.digisac_ticket_id) ?? 0), 0
        )
        const chamados_janela_90 = vinculosJanela.length
        const interacoes_janela_90 = vinculosJanela.reduce(
          (sum, v) => sum + (interacoesMap.get(v.digisac_ticket_id) ?? 0), 0
        )

        // Usa ciclo como base para primeiro_contato; fallback para janela
        const vinculosRef = vinculosCiclo.length > 0 ? vinculosCiclo : vinculosJanela
        const primeiroVinculo = [...vinculosRef].sort(
          (a, b) => (a.ordem_conversa_para_venda ?? 999) - (b.ordem_conversa_para_venda ?? 999)
        )[0]
        const primeiro_contato = primeiroVinculo?.inicio_chamado ?? null

        const latestJob = jobsLatest.get(lancamento)
        const status_digisac = latestJob?.status ?? null
        const ultima_sync = latestJob?.finalizado_em ?? null

        digisacMap.set(lancamento, {
          chamados_ciclo,
          interacoes_ciclo,
          chamados_janela_90,
          interacoes_janela_90,
          primeiro_contato,
          status_digisac,
          ultima_sync,
        })
      }
    } catch (enrichErr) {
      console.warn('[API][SGI][VENDAS] Enriquecimento Digisac falhou (não crítico):', enrichErr)
    }
  }

  const vendasEnriquecidas = listData.map((v) => {
    const lancamento = v.numero_lancamento as string
    const d = digisacMap.get(lancamento)
    return {
      ...v,
      digisac_chamados_ciclo: d?.chamados_ciclo ?? null,
      digisac_interacoes_ciclo: d?.interacoes_ciclo ?? null,
      digisac_chamados_janela_90: d?.chamados_janela_90 ?? null,
      digisac_interacoes_janela_90: d?.interacoes_janela_90 ?? null,
      digisac_primeiro_contato: d?.primeiro_contato ?? null,
      digisac_status: d?.status_digisac ?? null,
      digisac_ultima_sync: d?.ultima_sync ?? null,
    }
  })

  return NextResponse.json({
    vendas: vendasEnriquecidas as unknown as import('@/types/sgi').SgiDocumento[],
    total: listResult.count ?? 0,
    cards,
  } satisfies SgiVendasResponse)
}
