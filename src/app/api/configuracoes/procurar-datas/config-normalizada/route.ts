import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { buscarConfiguracoesProcurarDatas } from '@/lib/procurar-datas/config-service'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/configuracoes/procurar-datas/config-normalizada
//
// API de diagnóstico da Fase 4.
//
// Lê as configurações do banco (procurar_datas_config WHERE ativo = true),
// normaliza os tipos e retorna o objeto pronto para consumo futuro pelo motor.
//
// Fallback automático para planilha se banco estiver vazio ou incompleto.
//
// ACESSO: somente superadmin.
// ESCRITA: nenhuma — somente leitura.
// MOTOR: não é chamado por nenhum fluxo de /procurar-datas.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
      requiredRole: 'superadmin',
    })

    if (!auth.ok) {
      return auth.response
    }

    // 1. Buscar e normalizar configurações
    const resultado = await buscarConfiguracoesProcurarDatas()

    if (!resultado.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: resultado.erro,
          origemErro: resultado.origemErro,
        },
        { status: 503 }
      )
    }

    return NextResponse.json(resultado, { status: 200 })
  } catch (error: unknown) {
    console.error('[CONFIG-NORMALIZADA] Erro crítico:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: 'Erro interno', message }, { status: 500 })
  }
}
