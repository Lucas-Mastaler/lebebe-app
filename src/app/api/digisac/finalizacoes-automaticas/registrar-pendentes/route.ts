import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  montarRegistroFechamentoAutomatico,
  type TipoChamadoFechamento,
  type UltimaMensagemPor,
} from '@/lib/digisac/finalizacoesAutomaticas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TicketElegivelDiagnostico {
  ticketId: string;
  protocolo: string | null;
  ticketHistoryUrl: string;
  contactId: string | null;
  nomeContato: string | null;
  telefoneContato: string | null;
  serviceIdContato: string | null;
  serviceNameContato: string | null;
  conexaoConfirmadaBigorrilho: boolean;
  tipoChamado: TipoChamadoFechamento;
  ultimaMensagemEm: string | null;
  ultimaMensagemPor: UltimaMensagemPor;
  horasSemInteracao: number;
  previewUltimaMensagem: string | null;
  endpointFechamentoPrevisto: string | null;
}

interface DiagnosticoResponse {
  ok: boolean;
  ticketsElegiveis: TicketElegivelDiagnostico[];
  totalElegiveisParaFinalizacao: number;
}

interface ItemResumo {
  digisac_ticket_id: string;
  protocolo: string | null;
  nome_contato: string | null;
  status: string;
  ticket_history_url: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
    requiredRole: 'superadmin',
  });
  if (!auth.ok) return auth.response;

  console.log('[REGISTRAR-PENDENTES] Inicio do registro de pendentes.');

  try {
    // 1. Reutilizar o diagnostico via chamada interna
    const diagUrl = new URL(
      '/api/digisac/finalizacoes-automaticas/diagnostico',
      request.nextUrl.origin
    );

    const diagRes = await fetch(diagUrl.toString(), {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
    });

    if (!diagRes.ok) {
      console.error('[REGISTRAR-PENDENTES] Erro ao chamar diagnostico: status=' + diagRes.status);
      return NextResponse.json(
        { ok: false, error: `Erro ao executar diagnostico (status ${diagRes.status})` },
        { status: 500 }
      );
    }

    const diagData: DiagnosticoResponse = await diagRes.json();
    const elegiveis = diagData.ticketsElegiveis ?? [];

    console.log('[REGISTRAR-PENDENTES] Total elegivel do diagnostico:', elegiveis.length);

    // 2. Filtrar apenas Bigorrilho confirmado
    const elegiveisBigorrilho = elegiveis.filter(t => t.conexaoConfirmadaBigorrilho === true);
    const ignorados = elegiveis
      .filter(t => t.conexaoConfirmadaBigorrilho !== true)
      .map(t => ({
        digisac_ticket_id: t.ticketId,
        protocolo: t.protocolo,
        nome_contato: t.nomeContato,
        status: 'ignorado',
        ticket_history_url: t.ticketHistoryUrl,
      }));

    console.log(
      '[REGISTRAR-PENDENTES] Bigorrilho confirmado=' + elegiveisBigorrilho.length +
      ' ignorados=' + ignorados.length
    );

    if (elegiveisBigorrilho.length === 0) {
      console.log('[REGISTRAR-PENDENTES] Fim. Nenhum elegivel Bigorrilho para registrar.');
      return NextResponse.json({
        ok: true,
        modo: 'registrar-pendentes',
        totalElegiveisDiagnostico: elegiveis.length,
        totalInseridos: 0,
        totalJaExistentes: 0,
        totalIgnorados: ignorados.length,
        totalErros: 0,
        inseridos: [],
        jaExistentes: [],
        ignorados,
        erros: [],
      });
    }

    // 3. Buscar tickets ja existentes na tabela
    const supabase = createServiceClient();
    const ticketIds = elegiveisBigorrilho.map(t => t.ticketId);

    const { data: existentes, error: errExist } = await supabase
      .from('digisac_fechamentos_automaticos')
      .select('digisac_ticket_id')
      .in('digisac_ticket_id', ticketIds);

    if (errExist) {
      console.error('[REGISTRAR-PENDENTES] Erro ao buscar existentes:', errExist.message);
      return NextResponse.json(
        { ok: false, error: 'Erro ao verificar registros existentes' },
        { status: 500 }
      );
    }

    const existentesIds = new Set((existentes ?? []).map(r => r.digisac_ticket_id));

    // 4. Inserir apenas os novos (idempotencia via pre-check + unique constraint)
    const inseridos: ItemResumo[] = [];
    const jaExistentes: ItemResumo[] = [];
    const erros: Array<{ digisac_ticket_id: string; erro: string }> = [];

    for (const ticket of elegiveisBigorrilho) {
      if (existentesIds.has(ticket.ticketId)) {
        jaExistentes.push({
          digisac_ticket_id: ticket.ticketId,
          protocolo: ticket.protocolo,
          nome_contato: ticket.nomeContato,
          status: 'pendente',
          ticket_history_url: ticket.ticketHistoryUrl,
        });
        continue;
      }

      const registro = montarRegistroFechamentoAutomatico({
        ticketId: ticket.ticketId,
        protocolo: ticket.protocolo,
        ticketHistoryUrl: ticket.ticketHistoryUrl,
        contactId: ticket.contactId,
        nomeContato: ticket.nomeContato,
        telefoneContato: ticket.telefoneContato,
        serviceIdContato: ticket.serviceIdContato,
        serviceNameContato: ticket.serviceNameContato,
        tipoChamado: ticket.tipoChamado,
        ultimaMensagemEm: ticket.ultimaMensagemEm,
        ultimaMensagemPor: ticket.ultimaMensagemPor,
        horasSemInteracao: ticket.horasSemInteracao,
        previewUltimaMensagem: ticket.previewUltimaMensagem,
        endpointFechamentoPrevisto: ticket.endpointFechamentoPrevisto,
      });

      const { error: insertError } = await supabase
        .from('digisac_fechamentos_automaticos')
        .insert(registro);

      if (insertError) {
        // 23505 = unique_violation (race condition — ja existe)
        if (insertError.code === '23505') {
          jaExistentes.push({
            digisac_ticket_id: ticket.ticketId,
            protocolo: ticket.protocolo,
            nome_contato: ticket.nomeContato,
            status: 'pendente',
            ticket_history_url: ticket.ticketHistoryUrl,
          });
        } else {
          console.error(
            '[REGISTRAR-PENDENTES] Erro ao inserir ticket=' + ticket.ticketId.slice(0, 8),
            insertError.message
          );
          erros.push({
            digisac_ticket_id: ticket.ticketId,
            erro: insertError.message,
          });
        }
      } else {
        inseridos.push({
          digisac_ticket_id: ticket.ticketId,
          protocolo: ticket.protocolo,
          nome_contato: ticket.nomeContato,
          status: 'pendente',
          ticket_history_url: ticket.ticketHistoryUrl,
        });
      }
    }

    console.log(
      '[REGISTRAR-PENDENTES] Fim.' +
      ' totalElegiveis=' + elegiveis.length +
      ' totalInseridos=' + inseridos.length +
      ' totalJaExistentes=' + jaExistentes.length +
      ' totalIgnorados=' + ignorados.length +
      ' totalErros=' + erros.length
    );

    return NextResponse.json({
      ok: true,
      modo: 'registrar-pendentes',
      totalElegiveisDiagnostico: elegiveis.length,
      totalInseridos: inseridos.length,
      totalJaExistentes: jaExistentes.length,
      totalIgnorados: ignorados.length,
      totalErros: erros.length,
      inseridos,
      jaExistentes,
      ignorados,
      erros,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[REGISTRAR-PENDENTES] Erro geral:', mensagem);
    return NextResponse.json(
      { ok: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
