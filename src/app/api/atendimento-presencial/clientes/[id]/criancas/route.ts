import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAtendimentoPresencialFichaAccess } from '@/lib/atendimento-presencial/rascunhos'

export const runtime = 'nodejs'
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
type Context = { params: Promise<{ id: string }> }

async function executar(request: Request, context: Context, confirmar: boolean) {
  const auth = await requireAtendimentoPresencialFichaAccess()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  let body: Record<string, unknown> = {}
  if (confirmar) {
    try { body = await request.json() } catch { return NextResponse.json({ ok: false, message: 'Payload inválido' }, { status: 400 }) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ ok: false, message: 'Payload inválido' }, { status: 400 })
  }
  const rascunhoId = confirmar ? body.rascunhoId : new URL(request.url).searchParams.get('rascunhoId')
  if (!uuid(id) || !uuid(rascunhoId) || (confirmar && (!uuid(body.origemId) || (body.associarId != null && !uuid(body.associarId))))) {
    return NextResponse.json({ ok: false, message: 'Identificação inválida' }, { status: 400 })
  }
  if (confirmar && (typeof body.parentesco !== 'string' || body.parentesco.trim().length < 2 || body.parentesco.trim().length > 60)) {
    return NextResponse.json({ ok: false, message: 'Confirme o parentesco', field: 'parentesco' }, { status: 422 })
  }
  const supabase = createServiceClient()
  const args = { p_rascunho: rascunhoId, p_cliente: id, p_executor: auth.allowedUser.id }
  let confirmadoId: string | undefined
  if (confirmar) {
    const { data: confirmado, error } = await supabase.rpc('atendimento_presencial_confirmar_crianca', { ...args,
      p_origem: body.origemId, p_parentesco: body.parentesco, p_dados: body.dados, p_associar: body.associarId ?? null,
    })
    if (error) return falha(error)
    confirmadoId = confirmado
  }
  const { data, error } = await supabase.rpc('atendimento_presencial_listar_criancas', args)
  if (error) return falha(error)
  return NextResponse.json({ ok: true, ...data, ...(confirmadoId ? { confirmadoId } : {}) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

function falha(error: { code?: string; message?: string }) {
  if (error.code === '42501') return NextResponse.json({ ok: false, message: 'Acesso ao vínculo não autorizado' }, { status: 403 })
  if (error.message === 'criancas_nao_homologadas' || error.code === 'PGRST202') return NextResponse.json({ ok: false, message: 'Cadastro de crianças aguarda homologação integrada.' }, { status: 409 })
  if (error.code === '23514' || error.code === '22P02') return NextResponse.json({ ok: false, message: 'Revise os dados da criança.' }, { status: 422 })
  console.error('[PRANCHETA CRIANCAS] Falha na operação', { code: error.code })
  return NextResponse.json({ ok: false, message: 'Não foi possível consultar ou confirmar a criança. Tente novamente.' }, { status: 500 })
}

export async function GET(request: Request, context: Context) {
  try { return await executar(request, context, false) } catch { return falha({ code: 'UNEXPECTED' }) }
}
export async function POST(request: Request, context: Context) {
  try { return await executar(request, context, true) } catch { return falha({ code: 'UNEXPECTED' }) }
}
