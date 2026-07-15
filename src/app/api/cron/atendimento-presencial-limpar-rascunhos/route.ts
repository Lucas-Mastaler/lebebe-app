import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const inicio = new Date()
  console.log(`[CRON-ATENDIMENTO-PRESENCIAL] inicio=${inicio.toISOString()}`)

  if (!process.env.CRON_SECRET) {
    console.error('[CRON-ATENDIMENTO-PRESENCIAL] CRON_SECRET nao configurado')
    return NextResponse.json({ ok: false, error: 'CRON_SECRET nao configurado' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[CRON-ATENDIMENTO-PRESENCIAL] Unauthorized')
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const agora = new Date().toISOString()

    const { data, error } = await supabase
      .from('atendimento_presencial_atendimentos')
      .delete()
      .eq('status', 'rascunho')
      .lt('expira_em', agora)
      .select('id')

    if (error) {
      console.error('[CRON-ATENDIMENTO-PRESENCIAL] erro ao excluir vencidos:', error.message)
      return NextResponse.json({ ok: false, error: 'Erro ao limpar rascunhos' }, { status: 500 })
    }

    const totalExcluidos = data?.length ?? 0
    console.log(`[CRON-ATENDIMENTO-PRESENCIAL] total_excluidos=${totalExcluidos}`)

    return NextResponse.json({
      ok: true,
      totalExcluidos,
      executadoEm: agora,
    })
  } catch (error) {
    console.error('[CRON-ATENDIMENTO-PRESENCIAL] erro geral:', error)
    return NextResponse.json({ ok: false, error: 'Erro interno' }, { status: 500 })
  }
}
