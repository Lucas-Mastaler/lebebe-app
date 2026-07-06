import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { listarServicosDigisac } from '@/lib/digisac/estatisticas';
import { buscarConexoesHabilitadas, type ConexaoAutomacao } from '@/lib/digisac/finalizacoesAutomaticas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConexaoDisponivel {
  serviceId: string;
  serviceName: string;
  type: string;
  habilitada: boolean;
  configuracao?: ConexaoAutomacao | null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
    requiredRole: 'superadmin',
  });
  if (!auth.ok) return auth.response;

  console.log('[CONEXOES-AUTOMACAO] POST recebido.');

  try {
    const body = await request.json().catch(() => null);
    const serviceId: unknown = body?.serviceId;
    const ativo: unknown = body?.ativo;

    if (!serviceId || typeof serviceId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'serviceId e obrigatorio' },
        { status: 400 }
      );
    }
    if (typeof ativo !== 'boolean') {
      return NextResponse.json(
        { ok: false, error: 'ativo deve ser boolean' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    if (ativo) {
      const { data: existente } = await supabase
        .from('digisac_conexoes_automacao')
        .select('service_id')
        .eq('service_id', serviceId)
        .maybeSingle();

      if (existente) {
        const { error: errUpdate } = await supabase
          .from('digisac_conexoes_automacao')
          .update({ ativo: true, updated_at: new Date().toISOString() })
          .eq('service_id', serviceId);

        if (errUpdate) {
          console.error('[CONEXOES-AUTOMACAO] Erro ao ativar:', errUpdate.message);
          return NextResponse.json(
            { ok: false, error: 'Erro ao ativar conexao' },
            { status: 500 }
          );
        }
      } else {
        const { data: servicos } = await supabase
          .from('digisac_conexoes_automacao')
          .select('service_name')
          .eq('service_id', serviceId)
          .maybeSingle();

        const { error: errInsert } = await supabase
          .from('digisac_conexoes_automacao')
          .insert({
            service_id: serviceId,
            service_name: servicos?.service_name ?? null,
            ativo: true,
          });

        if (errInsert) {
          console.error('[CONEXOES-AUTOMACAO] Erro ao inserir conexao:', errInsert.message);
          return NextResponse.json(
            { ok: false, error: 'Erro ao ativar conexao' },
            { status: 500 }
          );
        }
      }
    } else {
      const { error: errUpdate } = await supabase
        .from('digisac_conexoes_automacao')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('service_id', serviceId);

      if (errUpdate) {
        console.error('[CONEXOES-AUTOMACAO] Erro ao desativar:', errUpdate.message);
        return NextResponse.json(
          { ok: false, error: 'Erro ao desativar conexao' },
          { status: 500 }
        );
      }
    }

    console.log('[CONEXOES-AUTOMACAO] Conexao ' + serviceId.slice(0, 8) + ' atualizada: ativo=' + ativo);

    return NextResponse.json({
      ok: true,
      serviceId,
      ativo,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[CONEXOES-AUTOMACAO] Erro POST:', mensagem);
    return NextResponse.json(
      { ok: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const auth = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
    requiredRole: 'superadmin',
  });
  if (!auth.ok) return auth.response;

  console.log('[CONEXOES-AUTOMACAO] Buscando conexoes disponiveis e habilitadas.');

  try {
    const supabase = createServiceClient();

    const [servicosDigisac, conexoesHabilitadas] = await Promise.all([
      listarServicosDigisac(),
      buscarConexoesHabilitadas(supabase),
    ]);

    const habilitadasMap = new Map<string, ConexaoAutomacao>();
    for (const c of conexoesHabilitadas) {
      habilitadasMap.set(c.service_id, c);
    }

    const conexoes: ConexaoDisponivel[] = servicosDigisac.map(s => {
      const config = habilitadasMap.get(s.id) ?? null;
      return {
        serviceId: s.id,
        serviceName: s.name,
        type: s.type,
        habilitada: !!config,
        configuracao: config,
      };
    });

    const habilitadasSemServicoDigisac = conexoesHabilitadas
      .filter(c => !servicosDigisac.some(s => s.id === c.service_id))
      .map(c => ({
        serviceId: c.service_id,
        serviceName: c.service_name ?? c.service_id.slice(0, 8),
        type: 'whatsapp',
        habilitada: true,
        configuracao: c,
      }));

    const todasConexoes = [...conexoes, ...habilitadasSemServicoDigisac];

    console.log(
      '[CONEXOES-AUTOMACAO] Disponiveis=' + servicosDigisac.length +
      ' habilitadas=' + conexoesHabilitadas.length +
      ' totalCombinado=' + todasConexoes.length
    );

    return NextResponse.json({
      ok: true,
      conexoes: todasConexoes,
      totalDisponiveis: servicosDigisac.length,
      totalHabilitadas: conexoesHabilitadas.length,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[CONEXOES-AUTOMACAO] Erro:', mensagem);
    return NextResponse.json(
      { ok: false, error: 'Erro ao buscar conexoes' },
      { status: 500 }
    );
  }
}
