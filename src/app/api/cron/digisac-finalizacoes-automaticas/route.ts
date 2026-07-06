import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  buscarConexoesHabilitadas,
  fecharRegistroAutomaticoDigisac,
  montarRegistroFechamentoAutomatico,
  type RegistroParaFechar,
  type TipoChamadoFechamento,
  type UltimaMensagemPor,
} from '@/lib/digisac/finalizacoesAutomaticas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMITE_FECHAMENTO = 100;

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
  ticketsElegiveis: TicketElegivelDiagnostico[];
  totalElegiveisParaFinalizacao: number;
}

export async function POST(request: NextRequest) {
  const horarioInicioUTC = new Date().toISOString();
  const horarioInicioBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  console.log('[CRON-DIGISAC] ========================================');
  console.log(`[CRON-DIGISAC] Inicio em ${horarioInicioBRT} (UTC: ${horarioInicioUTC})`);
  console.log(`[CRON-DIGISAC] CRON_SECRET configurado: ${!!process.env.CRON_SECRET}`);

  try {
    // 1. Validar autorizacao
    const authHeader = request.headers.get('authorization');

    if (!process.env.CRON_SECRET) {
      console.error('[CRON-DIGISAC] CRON_SECRET nao configurado no ambiente');
      return NextResponse.json(
        { ok: false, error: 'CRON_SECRET nao configurado' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[CRON-DIGISAC] Unauthorized: CRON_SECRET nao confere');
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // 2. Buscar conexoes habilitadas
    const conexoesHabilitadas = await buscarConexoesHabilitadas(supabase);
    if (conexoesHabilitadas.length === 0) {
      console.error('[CRON-DIGISAC] Nenhuma conexao habilitada para automacao');
      return NextResponse.json({
        ok: false,
        error: 'Nenhuma conexao habilitada para automacao',
      });
    }

    console.log('[CRON-DIGISAC] Conexoes habilitadas:', conexoesHabilitadas.length);

    // 3. Para cada conexao: rodar diagnostico + registrar pendentes
    let totalInseridos = 0;
    let totalJaExistentes = 0;
    let totalIgnoradosDiag = 0;
    let totalErrosRegistro = 0;
    let totalElegiveisGlobal = 0;

    for (const conexao of conexoesHabilitadas) {
      console.log('[CRON-DIGISAC] Processando conexao=' + conexao.service_id.slice(0, 8));

      const diagUrl = new URL(
        '/api/digisac/finalizacoes-automaticas/diagnostico',
        request.nextUrl.origin
      );
      diagUrl.searchParams.set('serviceId', conexao.service_id);

      const diagRes = await fetch(diagUrl.toString(), {
        headers: {
          'x-cron-secret': process.env.CRON_SECRET,
        },
      });

      if (!diagRes.ok) {
        console.error('[CRON-DIGISAC] Erro diagnostico conexao=' + conexao.service_id.slice(0, 8) + ' status=' + diagRes.status);
        totalErrosRegistro++;
        continue;
      }

      const diagData: DiagnosticoResponse = await diagRes.json();
      const elegiveis = diagData.ticketsElegiveis ?? [];
      const elegiveisConfirmados = elegiveis.filter(t => t.conexaoConfirmada === true);
      totalElegiveisGlobal += elegiveis.length;

      console.log(
        '[CRON-DIGISAC] Diagnostico conexao=' + conexao.service_id.slice(0, 8) +
        ' totalElegiveis=' + elegiveis.length +
        ' confirmados=' + elegiveisConfirmados.length
      );

      if (elegiveisConfirmados.length > 0) {
        const ticketIds = elegiveisConfirmados.map(t => t.ticketId);
        const { data: existentes, error: errExist } = await supabase
          .from('digisac_fechamentos_automaticos')
          .select('digisac_ticket_id')
          .in('digisac_ticket_id', ticketIds);

        if (errExist) {
          console.error('[CRON-DIGISAC] Erro ao buscar existentes:', errExist.message);
          totalErrosRegistro += elegiveisConfirmados.length;
        } else {
          const existentesIds = new Set((existentes ?? []).map(r => r.digisac_ticket_id));

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
                console.error('[CRON-DIGISAC] Erro ao inserir ticket=' + ticket.ticketId.slice(0, 8), insertError.message);
                totalErrosRegistro++;
              }
            } else {
              totalInseridos++;
            }
          }
        }
      }

      totalIgnoradosDiag += elegiveis.length - elegiveisConfirmados.length;
    }

    console.log(
      '[CRON-DIGISAC] Registro de pendentes concluido.' +
      ' inseridos=' + totalInseridos +
      ' jaExistentes=' + totalJaExistentes +
      ' ignorados=' + totalIgnoradosDiag +
      ' erros=' + totalErrosRegistro
    );

    // 4. Buscar pendentes para fechamento (status=pendente, conexoes habilitadas, limite global 100)
    console.log('[CRON-DIGISAC] Etapa 2: buscando pendentes para fechamento...');

    const serviceIdsHabilitados = conexoesHabilitadas.map(c => c.service_id);

    const { data: pendentes, error: errPendentes } = await supabase
      .from('digisac_fechamentos_automaticos')
      .select('id, digisac_ticket_id, digisac_contact_id, service_id, status, protocolo, nome_contato, ticket_history_url')
      .eq('status', 'pendente')
      .in('service_id', serviceIdsHabilitados)
      .order('created_at', { ascending: true })
      .limit(LIMITE_FECHAMENTO);

    if (errPendentes) {
      console.error('[CRON-DIGISAC] Erro ao buscar pendentes:', errPendentes.message);
      return NextResponse.json({
        ok: true,
        modo: 'cron-finalizacoes-automaticas',
        registrarPendentes: {
          totalElegiveisDiagnostico: totalElegiveisGlobal,
          totalInseridos,
          totalJaExistentes,
          totalIgnorados: totalIgnoradosDiag,
          totalErros: totalErrosRegistro,
        },
        fechamento: {
          limiteExecucao: LIMITE_FECHAMENTO,
          totalEncontradosParaFechar: 0,
          totalProcessados: 0,
          totalFinalizados: 0,
          totalErros: 0,
          totalIgnorados: 0,
          finalizados: [],
          erros: [],
          ignorados: [],
          erroBusca: errPendentes.message,
        },
      });
    }

    const pendentesLista = (pendentes ?? []) as RegistroParaFechar[];

    console.log('[CRON-DIGISAC] Pendentes encontrados para fechar:', pendentesLista.length);

    // 5. Fechar sequencialmente
    const finalizados: Array<{ id: string; digisac_ticket_id: string; protocolo: string | null; nome_contato: string | null }> = [];
    const erros: Array<{ id: string; digisac_ticket_id: string; protocolo: string | null; nome_contato: string | null; erro: string }> = [];
    const ignorados: Array<{ id: string; protocolo: string | null; motivo: string }> = [];

    for (const reg of pendentesLista) {
      if (!reg.digisac_contact_id || reg.digisac_contact_id.trim() === '') {
        ignorados.push({ id: reg.id, protocolo: reg.protocolo, motivo: 'contactId ausente' });
        continue;
      }

      if (!reg.digisac_ticket_id || reg.digisac_ticket_id.trim() === '') {
        ignorados.push({ id: reg.id, protocolo: reg.protocolo, motivo: 'ticketId ausente' });
        continue;
      }

      const resultado = await fecharRegistroAutomaticoDigisac(reg, supabase);

      if (resultado.ok) {
        finalizados.push({
          id: resultado.id,
          digisac_ticket_id: resultado.digisac_ticket_id,
          protocolo: resultado.protocolo,
          nome_contato: resultado.nome_contato,
        });
      } else {
        erros.push({
          id: resultado.id,
          digisac_ticket_id: resultado.digisac_ticket_id,
          protocolo: resultado.protocolo,
          nome_contato: resultado.nome_contato,
          erro: resultado.erro ?? 'Erro desconhecido',
        });
      }
    }

    const totalProcessados = finalizados.length + erros.length;

    const horarioFimBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    console.log(
      '[CRON-DIGISAC] Fim.' +
      ' pendentesEncontrados=' + pendentesLista.length +
      ' totalProcessados=' + totalProcessados +
      ' totalFinalizados=' + finalizados.length +
      ' totalErros=' + erros.length +
      ' totalIgnorados=' + ignorados.length +
      ' horarioFim=' + horarioFimBRT
    );

    return NextResponse.json({
      ok: true,
      modo: 'cron-finalizacoes-automaticas',
      horarioInicioUTC,
      horarioFimBRT,
      registrarPendentes: {
        totalElegiveisDiagnostico: totalElegiveisGlobal,
        totalInseridos,
        totalJaExistentes,
        totalIgnorados: totalIgnoradosDiag,
        totalErros: totalErrosRegistro,
      },
      fechamento: {
        limiteExecucao: LIMITE_FECHAMENTO,
        totalEncontradosParaFechar: pendentesLista.length,
        totalProcessados,
        totalFinalizados: finalizados.length,
        totalErros: erros.length,
        totalIgnorados: ignorados.length,
        finalizados,
        erros,
        ignorados,
      },
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[CRON-DIGISAC] Erro geral:', mensagem);
    return NextResponse.json(
      { ok: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
