/**
 * GET /api/procurar-datas/v2/progresso-compat?clientToken=...
 *
 * Rota paralela v2 de consulta de progresso do polling compatível SIMULADO.
 *
 * Fluxo:
 * 1. Valida acesso (validarAcessoProcurarDatas).
 * 2. Lê clientToken do query param.
 * 3. Busca estado no Redis.
 * 4. Se não existir, retorna { ok: true, progress: { status: 'waiting', normais: [], extras: [] } }.
 * 5. Se existir, retorna { ok: true, progress }.
 * 6. Não chama orquestrador — apenas leitura do Redis.
 *
 * IMPORTANTE: polling compatível SIMULADO — o estado já estará "done" ou "error"
 * quando o GET for chamado após o POST concluir. Não há candidatos parciais.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import {
  buscarProgressoCompat,
  progressoWaiting,
} from '@/lib/procurar-datas/v2/progresso-compat-store'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const { searchParams } = new URL(request.url)
    const clientToken = searchParams.get('clientToken')

    if (!clientToken || clientToken.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'clientToken ausente ou inválido.' },
        { status: 400 }
      )
    }

    const progresso = await buscarProgressoCompat(clientToken.trim())

    if (!progresso) {
      return NextResponse.json(
        {
          ok: true,
          progress: progressoWaiting(),
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        progress: progresso,
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
    console.error('[PROCURAR_DATAS][v2/progresso-compat] erro', error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
