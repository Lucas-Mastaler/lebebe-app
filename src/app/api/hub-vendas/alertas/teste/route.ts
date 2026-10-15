import { NextResponse } from 'next/server'
import { requireHubVendasManageAccess } from '@/lib/auth/module-access'
import { alertarTesteManual } from '@/lib/digisac/hub-vendas/alertas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/hub-vendas/alertas/teste
// Envia um alerta de teste APENAS para o contato técnico configurado.
// - Exige autenticação e a permissão Hub Vendas — Gerenciamento. Superadmin segue com acesso total.
// - Não aceita contactId/serviceId/userId/texto do frontend.
// - Usa configurações do servidor (env vars).
// - Não cria fila, não altera lead, não altera limite, não pausa automação.
// - Registra em hub_vendas_alertas com tipo='teste_manual'.
export async function POST() {
  try {
    const auth = await requireHubVendasManageAccess()
    if (!auth.ok) return auth.response

    const resultado = await alertarTesteManual()

    if (!resultado.ok) {
      return NextResponse.json(
        { ok: false, error: 'falha_envio_teste' },
        { status: 502 }
      )
    }

    // Não retornar IDs técnicos (contactId, serviceId, userId)
    return NextResponse.json({
      ok: true,
      deduplicado: resultado.deduplicado,
      enviadoEm: new Date().toISOString(),
    })
  } catch (error: unknown) {
    console.error('[HUB VENDAS GESTAO] Erro ao enviar alerta de teste:', error)
    return NextResponse.json(
      { ok: false, error: 'erro_interno' },
      { status: 500 }
    )
  }
}
