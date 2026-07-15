import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { createServiceClient } from '@/lib/supabase/service';
import {
  isConexaoHabilitada,
  verificarChamadoFechadoNoDigisac,
} from '@/lib/digisac/finalizacoesAutomaticas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireModuleAccess('digisac_finalizacoes_automaticas');
  if (!auth.ok) return auth.response;

  const { id: registroId } = await params;

  console.log('[VERIFICAR-STATUS] Inicio. registroId=' + registroId);

  try {
    const supabase = createServiceClient();

    const { data: registro, error: errBusca } = await supabase
      .from('digisac_fechamentos_automaticos')
      .select('id, digisac_ticket_id, digisac_contact_id, service_id, status, protocolo, nome_contato, ticket_history_url')
      .eq('id', registroId)
      .single();

    if (errBusca || !registro) {
      return NextResponse.json(
        { ok: false, error: 'Registro nao encontrado' },
        { status: 404 }
      );
    }

    const reg = registro as {
      id: string;
      digisac_ticket_id: string;
      digisac_contact_id: string;
      service_id: string;
      status: string;
      protocolo: string | null;
      nome_contato: string | null;
      ticket_history_url: string | null;
    };

    if (!(await isConexaoHabilitada(supabase, reg.service_id))) {
      return NextResponse.json(
        { ok: false, error: 'Conexao nao habilitada para automacao' },
        { status: 403 }
      );
    }

    if (reg.status !== 'erro' && reg.status !== 'pendente') {
      return NextResponse.json(
        { ok: false, error: `Status atual: ${reg.status}. Apenas erros ou pendentes podem ser verificados.` },
        { status: 409 }
      );
    }

    if (!reg.digisac_ticket_id || reg.digisac_ticket_id.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'ticketId ausente no registro' },
        { status: 400 }
      );
    }

    if (!reg.digisac_contact_id || reg.digisac_contact_id.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'contactId ausente no registro' },
        { status: 400 }
      );
    }

    const verificacao = await verificarChamadoFechadoNoDigisac(
      reg.digisac_ticket_id,
      reg.digisac_contact_id
    );

    if (!verificacao.confirmado) {
      return NextResponse.json({
        ok: false,
        error: verificacao.motivo ?? 'Nao foi possivel confirmar o status do chamado',
        registroId: reg.id,
      });
    }

    if (verificacao.fechado) {
      const agoraIso = new Date().toISOString();
      const { error: errUpdate } = await supabase
        .from('digisac_fechamentos_automaticos')
        .update({
          status: 'finalizado',
          finalizado_em: agoraIso,
          erro: null,
          updated_at: agoraIso,
        })
        .eq('id', reg.id);

      if (errUpdate) {
        console.error('[VERIFICAR-STATUS] Erro ao atualizar banco:', errUpdate.message);
        return NextResponse.json({
          ok: true,
          aviso: 'Chamado confirmado como fechado, mas erro ao atualizar banco',
          registroId: reg.id,
          protocolo: reg.protocolo,
          nome_contato: reg.nome_contato,
        });
      }

      console.log('[VERIFICAR-STATUS] Confirmado fechado. registroId=' + reg.id);
      return NextResponse.json({
        ok: true,
        confirmado: true,
        fechado: true,
        registroId: reg.id,
        protocolo: reg.protocolo,
        nome_contato: reg.nome_contato,
        finalizado_em: agoraIso,
      });
    }

    return NextResponse.json({
      ok: true,
      confirmado: true,
      fechado: false,
      registroId: reg.id,
      protocolo: reg.protocolo,
      nome_contato: reg.nome_contato,
      mensagem: 'Chamado segue aberto no Digisac',
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[VERIFICAR-STATUS] Erro geral:', mensagem);
    return NextResponse.json(
      { ok: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
