import { NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { createServiceClient } from '@/lib/supabase/service';
import type { RegistroExecucao } from '@/lib/digisac/finalizacoesAutomaticas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/digisac/finalizacoes-automaticas/execucoes
 * Retorna as ultimas execucoes (cron e manual) para exibicao na tela.
 * Nao retorna dados sensiveis.
 */
export async function GET() {
  const auth = await requireModuleAccess('digisac_finalizacoes_automaticas');
  if (!auth.ok) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('digisac_finalizacoes_execucoes')
      .select('id, created_at, origem, status, iniciado_em, finalizado_em, duracao_ms, total_encontrados, total_elegiveis, total_finalizados, total_ignorados, total_erros, mensagem, erro, request_id')
      .order('iniciado_em', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[API][EXECUCOES] Erro Supabase:', error.message);
      return NextResponse.json({ error: 'Erro ao buscar execucoes' }, { status: 500 });
    }

    const execucoes = (data ?? []) as Omit<RegistroExecucao, 'detalhes'>[];

    const ultimaCron = execucoes.find(e => e.origem === 'cron' && e.status !== 'em_andamento') ?? null;
    const ultimaManual = execucoes.find(e => e.origem === 'manual' && e.status !== 'em_andamento') ?? null;

    return NextResponse.json({
      ok: true,
      ultimaCron,
      ultimaManual,
      execucoes,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[API][EXECUCOES] Erro geral:', mensagem);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
