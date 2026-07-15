import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { buscarUltimoSnapshot } from '@/lib/procurar-datas/config-db'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────
// GET /api/configuracoes/procurar-datas/snapshot
//
// Retorna o último snapshot de importação salvo no Supabase.
// Se não houver nenhum, retorna { banco_vazio: true }.
//
// Acesso restrito ao modulo configuracoes_procurar_datas.
// ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const auth = await requireModuleAccess('configuracoes_procurar_datas')

    if (!auth.ok) {
      return auth.response
    }

    // 1. Buscar último snapshot
    const snapshot = await buscarUltimoSnapshot()

    if (!snapshot) {
      return NextResponse.json({ ok: true, banco_vazio: true, snapshot: null })
    }

    return NextResponse.json({ ok: true, banco_vazio: false, snapshot })
  } catch (error: unknown) {
    console.error('[SNAPSHOT] Erro crítico:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: 'Erro interno', message }, { status: 500 })
  }
}
