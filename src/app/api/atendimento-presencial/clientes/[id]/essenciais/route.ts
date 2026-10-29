import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAtendimentoPresencialHistoricoAccess } from '@/lib/atendimento-presencial/api-auth'
import { requireAtendimentoPresencialFichaAccess, isUuid } from '@/lib/atendimento-presencial/rascunhos'
import { ESSENCIAIS_HABILITADOS } from '@/lib/atendimento-presencial/essenciais'

export const runtime = 'nodejs'
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url)
  const rascunho = url.searchParams.get('rascunhoId')
  const auth = rascunho ? await requireAtendimentoPresencialFichaAccess() : await requireAtendimentoPresencialHistoricoAccess()
  if (!auth.ok) return auth.response
  if (!ESSENCIAIS_HABILITADOS) return NextResponse.json({ ok: false, message: 'Produtos essenciais ainda não foram ativados.' }, { status: 409 })
  const { id } = await params
  const pagina = Number(url.searchParams.get('pagina') ?? 0)
  if (!isUuid(id) || (rascunho && !isUuid(rascunho)) || !Number.isSafeInteger(pagina) || pagina < 0 || pagina > 10000) return NextResponse.json({ ok: false, message: 'Consulta inválida.' }, { status: 400 })
  try {
    const { data, error } = await createServiceClient().rpc(rascunho ? 'atendimento_presencial_ler_essenciais' : 'atendimento_presencial_historico_essenciais', {
      p_cliente: id, p_executor: auth.allowedUser.id, ...(rascunho ? { p_rascunho: rascunho } : { p_pagina: pagina }),
    })
    if (error) {
      if (error.code === '42501') return NextResponse.json({ ok: false, message: 'Acesso não autorizado.' }, { status: 403 })
      console.error('[PRANCHETA ESSENCIAIS] Falha na leitura', { code: error.code })
      return NextResponse.json({ ok: false, message: 'Não foi possível carregar os produtos essenciais. Tente novamente.' }, { status: 503 })
    }
    return NextResponse.json({ ok: true, ...data }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[PRANCHETA ESSENCIAIS] Falha inesperada', { causa: error instanceof Error ? error.name : 'unknown' })
    return NextResponse.json({ ok: false, message: 'Não foi possível carregar os produtos essenciais.' }, { status: 503 })
  }
}
