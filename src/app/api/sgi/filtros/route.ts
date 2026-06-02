import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const supabase = await createClient()

  const [filiaisResult, operacoesResult, statusResult, vendedoresResult] = await Promise.all([
    supabase
      .from('sgi_documentos_saida')
      .select('filial')
      .not('filial', 'is', null)
      .order('filial', { ascending: true }),
    supabase
      .from('sgi_documentos_saida')
      .select('operacao')
      .not('operacao', 'is', null)
      .order('operacao', { ascending: true }),
    supabase
      .from('sgi_documentos_saida')
      .select('status')
      .not('status', 'is', null)
      .order('status', { ascending: true }),
    supabase
      .from('sgi_documentos_saida')
      .select('vendedor')
      .not('vendedor', 'is', null)
      .order('vendedor', { ascending: true }),
  ])

  const unique = (rows: { [key: string]: string | null }[], field: string): string[] => {
    const set = new Set<string>()
    rows.forEach(r => {
      const val = r[field]
      if (val?.trim()) set.add(val.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  return NextResponse.json({
    filiais: unique(filiaisResult.data ?? [], 'filial'),
    operacoes: unique(operacoesResult.data ?? [], 'operacao'),
    status: unique(statusResult.data ?? [], 'status'),
    vendedores: unique(vendedoresResult.data ?? [], 'vendedor'),
  })
}
