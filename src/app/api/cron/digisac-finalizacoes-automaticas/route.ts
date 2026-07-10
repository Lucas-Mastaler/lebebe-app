import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  buscarConexoesHabilitadas,
  montarRegistroFechamentoAutomatico,
  executarFinalizacoesAutomaticas,
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
  ticketsElegiveis: TicketElegivelDiagnostico[];
  totalElegiveisParaFinalizacao: number;
}

/**
 * Rota chamada pelo Vercel Cron (GET).
 * Vercel Cron envia GET + Authorization: Bearer <CRON_SECRET> automaticamente
 * quando CRON_SECRET esta configurado nas variaveis de ambiente da Vercel.
 * Horario: 0 21 * * * (UTC) = 18h BRT (Brasilia UTC-3).
 */
export async function GET(request: NextRequest) {
  const horarioInicioUTC = new Date().toISOString();
  const horarioInicioBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const tsInicio = Date.now();

  console.log('[CRON-DIGISAC] ========================================');
  console.log(`[CRON-DIGISAC] Inicio (GET). origem=cron horario_brt=${horarioInicioBRT} utc=${horarioInicioUTC}`);
  console.log(`[CRON-DIGISAC] CRON_SECRET configurado: ${!!process.env.CRON_SECRET}`);

  // 1. Validar autorizacao (Vercel Cron envia Authorization: Bearer <CRON_SECRET>)
  const authHeader = request.headers.get('authorization');

  if (!process.env.CRON_SECRET) {
    console.error('[CRON-DIGISAC] CRON_SECRET nao configurado no ambiente');
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET nao configurado' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[CRON-DIGISAC] Unauthorized: header=' + (authHeader ? '[presente mas incorreto]' : '[ausente]'));
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 2. Criar registro de execucao imediatamente apos validar auth
  const supabase = createServiceClient();
  const requestId = `cron-${horarioInicioUTC}`;

  let execucaoId: string | null = null;
  const { data: execInsert, error: execInsertErr } = await supabase
    .from('digisac_finalizacoes_execucoes')
    .insert({
      origem: 'cron',
      status: 'em_andamento',
      iniciado_em: horarioInicioUTC,
      request_id: requestId,
      total_encontrados: 0,
      total_elegiveis: 0,
      total_finalizados: 0,
      total_ignorados: 0,
      total_erros: 0,
    })
    .select('id')
    .single();

  if (execInsertErr || !execInsert) {
    console.error('[CRON-DIGISAC] ERRO CRITICO: Falha ao criar registro de execucao inicial. Nao haverá rastreabilidade persistida. Detalhe:', execInsertErr?.message ?? 'sem data');
  } else {
    execucaoId = execInsert.id;
    console.log(`[CRON-DIGISAC] Registro de execucao criado cedo. id=${execucaoId}`);
  }

  // Helper para finalizar execucao com erro
  const finalizarComErro = async (etapa: string, mensagemErro: string) => {
    if (!execucaoId) return;
    const finalizado_em = new Date().toISOString();
    const duracao_ms = Date.now() - tsInicio;
    console.error(`[CRON-DIGISAC] Finalizando execucao com erro. etapa=${etapa} duracao=${duracao_ms}ms`);
    const { error: updErr } = await supabase
      .from('digisac_finalizacoes_execucoes')
      .update({
        status: 'erro',
        finalizado_em,
        duracao_ms,
        mensagem: `Erro na etapa: ${etapa}`,
        erro: mensagemErro.substring(0, 500),
        detalhes: { etapa, horarioInicioBRT },
      })
      .eq('id', execucaoId);
    if (updErr) {
      console.error('[CRON-DIGISAC] ERRO CRITICO: Falha ao atualizar execucao com erro:', updErr.message);
    }
  };

  try {
    // 3. Buscar conexoes habilitadas
    const conexoesHabilitadas = await buscarConexoesHabilitadas(supabase);
    if (conexoesHabilitadas.length === 0) {
      console.warn('[CRON-DIGISAC] Nenhuma conexao habilitada para automacao');
      if (execucaoId) {
        await supabase
          .from('digisac_finalizacoes_execucoes')
          .update({
            status: 'sem_itens',
            finalizado_em: new Date().toISOString(),
            duracao_ms: Date.now() - tsInicio,
            mensagem: 'Nenhuma conexao habilitada',
          })
          .eq('id', execucaoId);
      }
      return NextResponse.json({
        ok: true,
        modo: 'cron-finalizacoes-automaticas',
        execucaoId,
        mensagem: 'Nenhuma conexao habilitada',
      });
    }

    console.log('[CRON-DIGISAC] Conexoes habilitadas:', conexoesHabilitadas.length);

    // 4. Para cada conexao: rodar diagnostico + registrar novos pendentes
    let totalInseridos = 0;
    let totalJaExistentes = 0;
    let totalIgnoradosDiag = 0;
    let totalErrosRegistro = 0;
    let totalElegiveisGlobal = 0;

    for (const conexao of conexoesHabilitadas) {
      console.log('[CRON-DIGISAC] Diagnostico conexao=' + conexao.service_id.slice(0, 8));

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

    // 5. Executar fechamento central (passa execucaoId existente)
    console.log('[CRON-DIGISAC] Etapa 2: executando fechamentos...');

    const resultado = await executarFinalizacoesAutomaticas(supabase, 'cron', requestId, execucaoId ?? undefined);

    // Atualizar totais de diagnostico no registro de execucao
    if (execucaoId) {
      await supabase
        .from('digisac_finalizacoes_execucoes')
        .update({
          total_elegiveis: totalElegiveisGlobal,
        })
        .eq('id', execucaoId);
    }

    const horarioFimBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    console.log(
      '[CRON-DIGISAC] Fim.' +
      ' execucaoId=' + (resultado.execucaoId ?? 'n/a') +
      ' status=' + resultado.status +
      ' finalizados=' + resultado.totalFinalizados +
      ' erros=' + resultado.totalErros +
      ' ignorados=' + resultado.totalIgnorados +
      ' duracao=' + resultado.duracaoMs + 'ms' +
      ' horarioFim=' + horarioFimBRT
    );

    return NextResponse.json({
      ok: resultado.ok,
      modo: 'cron-finalizacoes-automaticas',
      execucaoId: resultado.execucaoId,
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
        status: resultado.status,
        mensagem: resultado.mensagem,
        totalEncontradosParaFechar: resultado.totalEncontradosParaFechar,
        totalFinalizados: resultado.totalFinalizados,
        totalErros: resultado.totalErros,
        totalIgnorados: resultado.totalIgnorados,
        duracaoMs: resultado.duracaoMs,
      },
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[CRON-DIGISAC] Erro geral:', mensagem);
    await finalizarComErro('geral', mensagem);
    return NextResponse.json(
      { ok: false, error: 'Erro interno', execucaoId },
      { status: 500 }
    );
  }
}
