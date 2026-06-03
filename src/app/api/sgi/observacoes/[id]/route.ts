import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'

// PUT /api/sgi/observacoes/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateComercialUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { observacao } = body

  if (!observacao?.trim()) return NextResponse.json({ error: 'observacao é obrigatória' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('inteligencia_comercial_observacoes')
    .update({ observacao: observacao.trim(), atualizado_por: auth.email, updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, observacao, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ observacao: data })
}

// DELETE /api/sgi/observacoes/[id] — soft delete
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateComercialUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('inteligencia_comercial_observacoes')
    .update({ deleted_at: new Date().toISOString(), atualizado_por: auth.email })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
