import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { alterarLimiteDiarioHubVendas, validarLimiteDiario, LIMITE_DIARIO_MAXIMO } from '@/lib/digisac/hub-vendas/gestao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/hub-vendas/limite
// Altera o limite diário por loja/conexão (valor único aplicado a todas as lojas).
// Acesso restrito ao módulo hub_vendas_gestao (somente superadmin).
export async function PATCH(request: Request) {
  try {
    const auth = await requireModuleAccess('hub_vendas_gestao')
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'payload_invalido' }, { status: 400 })
    }

    const { limite, confirmado } = body as { limite?: unknown; confirmado?: unknown }

    if (confirmado !== true) {
      return NextResponse.json({ ok: false, error: 'confirmacao_obrigatoria' }, { status: 400 })
    }

    const validacao = validarLimiteDiario(limite)
    if (!validacao.ok || validacao.valor === null) {
      return NextResponse.json(
        { ok: false, error: 'limite_invalido', message: validacao.erro },
        { status: 400 }
      )
    }

    const resultado = await alterarLimiteDiarioHubVendas(validacao.valor, auth.email)
    return NextResponse.json(resultado, { status: 200 })
  } catch (error: unknown) {
    console.error('[HUB VENDAS GESTAO] Erro ao alterar limite:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ ok: false, error: 'erro_interno', message }, { status: 500 })
  }
}

// GET /api/hub-vendas/limite
// Retorna o máximo seguro permitido para validação do frontend.
export async function GET() {
  try {
    const auth = await requireModuleAccess('hub_vendas_gestao')
    if (!auth.ok) return auth.response

    return NextResponse.json({
      ok: true,
      maximo: LIMITE_DIARIO_MAXIMO,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'erro_interno' }, { status: 500 })
  }
}
