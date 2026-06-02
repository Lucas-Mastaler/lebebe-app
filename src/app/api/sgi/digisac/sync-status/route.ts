import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const jobId = searchParams.get('jobId')
  const numeroLancamento = searchParams.get('numeroLancamento')

  if (!jobId && !numeroLancamento) {
    return NextResponse.json(
      { error: 'Informe jobId ou numeroLancamento' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  let query = supabase
    .from('digisac_sync_fila')
    .select('id, numero_lancamento, status, tipo_sincronizacao, resultado_json, erro_mensagem, solicitado_por, solicitado_em, iniciado_em, finalizado_em, created_at')
    .order('created_at', { ascending: false })
    .limit(1)

  if (jobId) {
    query = query.eq('id', jobId)
  } else if (numeroLancamento) {
    query = query.eq('numero_lancamento', numeroLancamento)
  }

  const { data: job, error } = await query.maybeSingle()

  if (error) {
    console.error('[sync-status] erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar status' }, { status: 500 })
  }

  if (!job) {
    return NextResponse.json({
      jobId: null,
      numeroLancamento: numeroLancamento ?? null,
      status: 'nao_encontrado',
      mensagem: 'Nenhuma sincronização encontrada para esta venda.',
    })
  }

  return NextResponse.json({
    jobId: job.id,
    numeroLancamento: job.numero_lancamento,
    status: job.status,
    tipoSincronizacao: job.tipo_sincronizacao,
    resultadoJson: job.resultado_json,
    erroMensagem: job.erro_mensagem,
    solicitadoPor: job.solicitado_por,
    solicitadoEm: job.solicitado_em,
    iniciadoEm: job.iniciado_em,
    finalizadoEm: job.finalizado_em,
  })
}
