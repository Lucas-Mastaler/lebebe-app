import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  montarRegistroFechamentoAutomatico,
  buscarConexoesHabilitadas,
  type ConexaoAutomacao,
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
  conexaoConfirmada: boolean;
  tipoChamado: TipoChamadoFechamento;
  ultimaMensagemEm: string | null;
  ultimaMensagemPor: UltimaMensagemPor;
  horasSemInteracao: number;
  previewUltimaMensagem: string | null;
  endpointFechamentoPrevisto: string | null;
}

interface DiagnosticoResponse {
  ok: boolean;
  serviceId: string;
  serviceName: string | null;
  ticketsElegiveis: TicketElegivelDiagnostico[];
  totalElegiveisParaFinalizacao: number;
}

interface ResultadoPorConexao {
  serviceId: string;
  serviceName: string | null;
  totalElegiveisDiagnostico: number;
  totalInseridos: number;
  totalJaExistentes: number;
  totalIgnorados: number;
  totalErros: number;
}

async function processarConexao(
  conexao: ConexaoAutomacao,
  requestOrigin: string,
  cookieHeader: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<ResultadoPorConexao> {
  const diagUrl = new URL(
    '/api/digisac/finalizacoes-automaticas/diagnostico',
    requestOrigin
  );
  diagUrl.searchParams.set('serviceId', conexao.service_id);

  console.log('[REGISTRAR-PENDENTES] Chamando diagnostico para serviceId=' + conexao.service_id.slice(0, 8));

  const diagRes = await fetch(diagUrl.toString(), {
    headers: { cookie: cookieHeader },
  });

  if (!diagRes.ok) {
    console.error('[REGISTRAR-PENDENTES] Erro diagnostico serviceId=' + conexao.service_id.slice(0, 8) + ' status=' + diagRes.status);
    return {
      serviceId: conexao.service_id,
      serviceName: conexao.service_name,
      totalElegiveisDiagnostico: 0,
      totalInseridos: 0,
      totalJaExistentes: 0,
      totalIgnorados: 0,
      totalErros: 1,
    };
  }

  const diagData: DiagnosticoResponse = await diagRes.json();
  const elegiveis = diagData.ticketsElegiveis ?? [];
  const elegiveisConfirmados = elegiveis.filter(t => t.conexaoConfirmada === true);

  if (elegiveisConfirmados.length === 0) {
    return {
      serviceId: conexao.service_id,
      serviceName: conexao.service_name,
      totalElegiveisDiagnostico: elegiveis.length,
      totalInseridos: 0,
      totalJaExistentes: 0,
      totalIgnorados: elegiveis.length,
      totalErros: 0,
    };
  }

  const ticketIds = elegiveisConfirmados.map(t => t.ticketId);
  const { data: existentes, error: errExist } = await supabase
    .from('digisac_fechamentos_automaticos')
    .select('digisac_ticket_id')
    .in('digisac_ticket_id', ticketIds);

  if (errExist) {
    console.error('[REGISTRAR-PENDENTES] Erro ao buscar existentes:', errExist.message);
    return {
      serviceId: conexao.service_id,
      serviceName: conexao.service_name,
      totalElegiveisDiagnostico: elegiveis.length,
      totalInseridos: 0,
      totalJaExistentes: 0,
      totalIgnorados: 0,
      totalErros: elegiveisConfirmados.length,
    };
  }

  const existentesIds = new Set((existentes ?? []).map(r => r.digisac_ticket_id));

  let totalInseridos = 0;
  let totalJaExistentes = 0;
  let totalErros = 0;

  for (const ticket of elegiveisConfirmados) {
    if (existentesIds.has(ticket.ticketId)) {
      totalJaExistentes++;
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
      if (insertError.code === '23505') {
        totalJaExistentes++;
      } else {
        console.error(
          '[REGISTRAR-PENDENTES] Erro ao inserir ticket=' + ticket.ticketId.slice(0, 8),
          insertError.message
        );
        totalErros++;
      }
    } else {
      totalInseridos++;
    }
  }

  return {
    serviceId: conexao.service_id,
    serviceName: conexao.service_name,
    totalElegiveisDiagnostico: elegiveis.length,
    totalInseridos,
    totalJaExistentes,
    totalIgnorados: elegiveis.length - elegiveisConfirmados.length,
    totalErros,
  };
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
    let body: { serviceId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // body vazio — processar todas as conexoes habilitadas
    }

    const supabase = createServiceClient();
    const conexoesHabilitadas = await buscarConexoesHabilitadas(supabase);

    if (conexoesHabilitadas.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Nenhuma conexao habilitada para automacao' },
        { status: 500 }
      );
    }

    let conexoesParaProcessar = conexoesHabilitadas;
    if (body.serviceId) {
      conexoesParaProcessar = conexoesHabilitadas.filter(c => c.service_id === body.serviceId);
      if (conexoesParaProcessar.length === 0) {
        return NextResponse.json(
          { ok: false, error: `serviceId ${body.serviceId} nao esta habilitado para automacao` },
          { status: 403 }
        );
      }
    }

    const cookieHeader = request.headers.get('cookie') ?? '';
    const origin = request.nextUrl.origin;

    const resultadosPorConexao: ResultadoPorConexao[] = [];

    for (const conexao of conexoesParaProcessar) {
      console.log('[REGISTRAR-PENDENTES] Processando conexao=' + conexao.service_id.slice(0, 8));
      const resultado = await processarConexao(conexao, origin, cookieHeader, supabase);
      resultadosPorConexao.push(resultado);
    }

    const totalConexoesProcessadas = resultadosPorConexao.length;
    const totalElegiveis = resultadosPorConexao.reduce((s, r) => s + r.totalElegiveisDiagnostico, 0);
    const totalInseridos = resultadosPorConexao.reduce((s, r) => s + r.totalInseridos, 0);
    const totalJaExistentes = resultadosPorConexao.reduce((s, r) => s + r.totalJaExistentes, 0);
    const totalIgnorados = resultadosPorConexao.reduce((s, r) => s + r.totalIgnorados, 0);
    const totalErros = resultadosPorConexao.reduce((s, r) => s + r.totalErros, 0);

    console.log(
      '[REGISTRAR-PENDENTES] Fim.' +
      ' conexoesProcessadas=' + totalConexoesProcessadas +
      ' totalElegiveis=' + totalElegiveis +
      ' totalInseridos=' + totalInseridos +
      ' totalJaExistentes=' + totalJaExistentes +
      ' totalIgnorados=' + totalIgnorados +
      ' totalErros=' + totalErros
    );

    return NextResponse.json({
      ok: true,
      modo: 'registrar-pendentes',
      totalConexoesProcessadas,
      resultadosPorConexao,
      totalElegiveisDiagnostico: totalElegiveis,
      totalInseridos,
      totalJaExistentes,
      totalIgnorados,
      totalErros,
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
