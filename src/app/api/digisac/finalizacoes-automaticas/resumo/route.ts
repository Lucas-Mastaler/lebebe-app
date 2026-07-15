import { NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireModuleAccess('digisac_finalizacoes_automaticas');
  if (!auth.ok) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data: statusRows } = await supabase
      .from('digisac_fechamentos_automaticos')
      .select('status');

    if (!statusRows) {
      return NextResponse.json({ resumo: null });
    }

    const counts = { pendente: 0, finalizado: 0, erro: 0, ignorado: 0 };
    for (const row of statusRows) {
      const s = row.status as keyof typeof counts;
      if (s in counts) counts[s]++;
    }

    const resumo = {
      total: statusRows.length,
      pendentes: counts.pendente,
      finalizados: counts.finalizado,
      erros: counts.erro,
      ignorados: counts.ignorado,
    };

    return NextResponse.json({ resumo });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[API][FINALIZACOES-AUTO][RESUMO] Erro geral:', mensagem);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
