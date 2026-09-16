import { NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import { FILIAIS_VENDAS_SGI } from '@/lib/sgi/filiais-vendas-sgi'

export const runtime = 'nodejs'

const PAGE_SIZE = 1000

/**
 * PostgREST limita cada select a 1000 linhas por padrão. Um `.select(coluna)`
 * sem paginação, ordenado alfabeticamente, corta a página antes de alcançar
 * valores que só aparecem no fim do alfabeto. Usado só para operação/status/
 * vendedor — que continuam sem cadastro mestre e por isso precisam ser
 * derivados dos documentos reais. Filial NÃO usa mais esta função (ver
 * `FILIAIS_VENDAS_SGI`): o mesmo truncamento fazia "LEBEBE PORTÃO"
 * desaparecer do filtro mesmo tendo mais linhas que outras filiais visíveis,
 * e mesmo corrigido, tratar filial como valor emergente dos documentos
 * esconde uma unidade sem movimento no período em vez de mostrá-la vazia.
 * Pagina com `.range()` até esgotar as linhas para montar a lista distinta real.
 */
async function fetchDistinct(supabase: SupabaseClient, column: string): Promise<string[]> {
  const set = new Set<string>()
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('sgi_documentos_saida')
      .select(column)
      .not(column, 'is', null)
      .order(column, { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as unknown as Record<string, string | null>[]
    rows.forEach(row => {
      const val = row[column]
      if (val?.trim()) set.add(val.trim())
    })
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export async function GET() {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const supabase = await createClient()

  const [operacoes, status, vendedores] = await Promise.all([
    fetchDistinct(supabase, 'operacao'),
    fetchDistinct(supabase, 'status'),
    fetchDistinct(supabase, 'vendedor'),
  ])

  return NextResponse.json({ filiais: [...FILIAIS_VENDAS_SGI], operacoes, status, vendedores })
}
