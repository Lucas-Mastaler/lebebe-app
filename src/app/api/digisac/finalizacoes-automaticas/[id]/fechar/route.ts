import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  BIGORRILHO_SERVICE_ID,
  fecharRegistroAutomaticoDigisac,
  type RegistroParaFechar,
} from '@/lib/digisac/finalizacoesAutomaticas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
    requiredRole: 'superadmin',
  });
  if (!auth.ok) return auth.response;

  const { id: registroId } = await params;

  console.log('[FECHAR-CHAMADO] Inicio. registroId=' + registroId);

  try {
    const supabase = createServiceClient();

    // 1. Buscar registro pelo id
    const { data: registro, error: errBusca } = await supabase
      .from('digisac_fechamentos_automaticos')
      .select('id, digisac_ticket_id, digisac_contact_id, service_id, status, protocolo, nome_contato, ticket_history_url')
      .eq('id', registroId)
      .single();

    if (errBusca || !registro) {
      console.error('[FECHAR-CHAMADO] Registro nao encontrado:', registroId);
      return NextResponse.json(
        { ok: false, error: 'Registro nao encontrado' },
        { status: 404 }
      );
    }

    const reg = registro as RegistroParaFechar;

    // 2. Validacoes
    if (reg.status === 'finalizado') {
      return NextResponse.json(
        { ok: false, error: 'Chamado ja finalizado' },
        { status: 409 }
      );
    }

    if (reg.status !== 'pendente' && reg.status !== 'erro') {
      return NextResponse.json(
        { ok: false, error: `Status atual: ${reg.status}. Apenas pendentes ou erros podem ser fechados.` },
        { status: 409 }
      );
    }

    if (reg.service_id !== BIGORRILHO_SERVICE_ID) {
      console.error('[FECHAR-CHAMADO] service_id diferente do Bigorrilho:', reg.service_id);
      return NextResponse.json(
        { ok: false, error: 'Registro nao pertence a conexao Bigorrilho' },
        { status: 403 }
      );
    }

    if (!reg.digisac_contact_id || reg.digisac_contact_id.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'contactId ausente no registro' },
        { status: 400 }
      );
    }

    if (!reg.digisac_ticket_id || reg.digisac_ticket_id.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'ticketId ausente no registro' },
        { status: 400 }
      );
    }

    // 3. Fechar usando funcao reutilizavel
    const resultado = await fecharRegistroAutomaticoDigisac(reg, supabase);

    if (resultado.ok) {
      return NextResponse.json({
        ok: true,
        registroId: resultado.id,
        digisac_ticket_id: resultado.digisac_ticket_id,
        protocolo: resultado.protocolo,
        nome_contato: resultado.nome_contato,
        ticket_history_url: resultado.ticket_history_url,
        finalizado_em: resultado.finalizado_em,
        ...(resultado.erro ? { aviso: resultado.erro } : {}),
      });
    } else {
      return NextResponse.json(
        { ok: false, error: resultado.erro, registroId: resultado.id },
        { status: 502 }
      );
    }
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[FECHAR-CHAMADO] Erro geral:', mensagem);
    return NextResponse.json(
      { ok: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
