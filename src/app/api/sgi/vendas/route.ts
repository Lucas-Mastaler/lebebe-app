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
    page = 1,
  } = body || {}

  console.log('[API][SGI][VENDAS] POST filtros=', {
    dataInicio, dataFim, cliente, telefone: telefone ? '***' : undefined,
    filial, vendedor, operacao, status, numeroLancamento, page,
  })

  const supabase = await createClient()

  // --- Filtro por telefone via tabela de contatos (deduplicado) ---
  let filteredIds: string[] | null = null
  if (telefone?.trim()) {
    const cleaned = telefone.trim().replace(/\D/g, '')
    if (cleaned.length >= 3) {
      const { data: contatosRows, error: contatosError } = await supabase
        .from('sgi_documentos_saida_contatos')
        .select('documento_saida_id')
        .or(`telefone_normalizado.ilike.%${cleaned}%,telefone_normalizado_ddi.ilike.%${cleaned}%`)

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
  if (cliente?.trim()) {
    listQ = listQ.ilike('cliente', `%${cliente.trim()}%`)
    cardsQ = cardsQ.ilike('cliente', `%${cliente.trim()}%`)
  }
  if (filial?.trim()) {
    listQ = listQ.ilike('filial', `%${filial.trim()}%`)
    cardsQ = cardsQ.ilike('filial', `%${filial.trim()}%`)
  }
  if (vendedor?.trim()) {
    listQ = listQ.ilike('vendedor', `%${vendedor.trim()}%`)
    cardsQ = cardsQ.ilike('vendedor', `%${vendedor.trim()}%`)
  }
  if (operacao?.trim()) {
    listQ = listQ.ilike('operacao', `%${operacao.trim()}%`)
    cardsQ = cardsQ.ilike('operacao', `%${operacao.trim()}%`)
  }
  if (status?.trim()) {
    listQ = listQ.eq('status', status.trim())
    cardsQ = cardsQ.eq('status', status.trim())
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

  return NextResponse.json({
    vendas: listResult.data ?? [],
    total: listResult.count ?? 0,
    cards,
  } satisfies SgiVendasResponse)
}
