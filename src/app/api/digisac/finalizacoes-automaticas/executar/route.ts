import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
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
 * Execucao manual das finalizacoes automaticas.
 * Mesma logica do cron, origem = 'manual'.
 * Protegida por autenticacao de superadmin.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
    requiredRole: 'superadmin',
  });
  if (!auth.ok) return auth.response;

  const horarioInicioUTC = new Date().toISOString();
  const horarioInicioBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const tsInicio = Date.now();
  const requestId = `manual-${horarioInicioUTC}`;

  console.log('[EXECUTAR-MANUAL] ========================================');
  console.log(`[EXECUTAR-MANUAL] Inicio. origem=manual horario_brt=${horarioInicioBRT}`);

  const supabase = createServiceClient();

  // Criar registro de execucao imediatamente apos auth
  let execucaoId: string | null = null;
  const { data: execInsert, error: execInsertErr } = await supabase
    .from('digisac_finalizacoes_execucoes')
    .insert({
      origem: 'manual',
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
    console.error('[EXECUTAR-MANUAL] ERRO CRITICO: Falha ao criar registro de execucao inicial. Nao haverá rastreabilidade persistida. Detalhe:', execInsertErr?.message ?? 'sem data');
  } else {
    execucaoId = execInsert.id;
    console.log(`[EXECUTAR-MANUAL] Registro de execucao criado cedo. id=${execucaoId}`);
  }

  const finalizarComErro = async (etapa: string, mensagemErro: string) => {
    if (!execucaoId) return;
    const finalizado_em = new Date().toISOString();
    const duracao_ms = Date.now() - tsInicio;
    console.error(`[EXECUTAR-MANUAL] Finalizando execucao com erro. etapa=${etapa} duracao=${duracao_ms}ms`);
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
      console.error('[EXECUTAR-MANUAL] ERRO CRITICO: Falha ao atualizar execucao com erro:', updErr.message);
    }
  };

  try {
    // 1. Buscar conexoes habilitadas
    const conexoesHabilitadas = await buscarConexoesHabilitadas(supabase);
    if (conexoesHabilitadas.length === 0) {
      console.warn('[EXECUTAR-MANUAL] Nenhuma conexao habilitada');
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
        modo: 'manual',
        execucaoId,
        mensagem: 'Nenhuma conexao habilitada para automacao',
      });
    }

    console.log('[EXECUTAR-MANUAL] Conexoes habilitadas:', conexoesHabilitadas.length);

    // 2. Para cada conexao: rodar diagnostico + registrar novos pendentes
    let totalInseridos = 0;
    let totalJaExistentes = 0;
    let totalIgnoradosDiag = 0;
    let totalErrosRegistro = 0;
    let totalElegiveisGlobal = 0;

    for (const conexao of conexoesHabilitadas) {
      console.log('[EXECUTAR-MANUAL] Diagnostico conexao=' + conexao.service_id.slice(0, 8));

      const baseUrl = process.env.APP_URL ?? 'https://lebebe.cloud';
      const diagUrl = new URL(
        '/api/digisac/finalizacoes-automaticas/diagnostico',
        baseUrl
      );
      diagUrl.searchParams.set('serviceId', conexao.service_id);

      const diagRes = await fetch(diagUrl.toString(), {
        headers: {
          cookie: request.headers.get('cookie') ?? '',
        },
      });

      if (!diagRes.ok) {
        const contentType = diagRes.headers.get('content-type') ?? '';
        const bodyPreview = await diagRes.text().catch(() => '').then(t => t.substring(0, 200));
        const erroMsg = `Diagnostico falhou: status=${diagRes.status} content-type=${contentType} url=${diagUrl.pathname} body=${bodyPreview}`;
        console.error('[EXECUTAR-MANUAL] ' + erroMsg);
        throw new Error(erroMsg);
      }

      const contentType = diagRes.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        const bodyPreview = await diagRes.text().catch(() => '').then(t => t.substring(0, 200));
        const erroMsg = `Diagnostico retornou nao-JSON: status=${diagRes.status} content-type=${contentType} url=${diagUrl.pathname} body=${bodyPreview}`;
        console.error('[EXECUTAR-MANUAL] ' + erroMsg);
        throw new Error(erroMsg);
      }

      const diagData: DiagnosticoResponse = await diagRes.json();
      const elegiveis = diagData.ticketsElegiveis ?? [];
      const elegiveisConfirmados = elegiveis.filter(t => t.conexaoConfirmada === true);
      totalElegiveisGlobal += elegiveis.length;

      console.log(
        '[EXECUTAR-MANUAL] Diagnostico conexao=' + conexao.service_id.slice(0, 8) +
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
          console.error('[EXECUTAR-MANUAL] Erro ao buscar existentes:', errExist.message);
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
                console.error('[EXECUTAR-MANUAL] Erro ao inserir ticket=' + ticket.ticketId.slice(0, 8), insertError.message);
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
      '[EXECUTAR-MANUAL] Registro de pendentes concluido.' +
      ' inseridos=' + totalInseridos +
      ' jaExistentes=' + totalJaExistentes +
      ' ignorados=' + totalIgnoradosDiag +
      ' erros=' + totalErrosRegistro
    );

    // 3. Executar fechamento central (passa execucaoId existente)
    const resultado = await executarFinalizacoesAutomaticas(supabase, 'manual', requestId, execucaoId ?? undefined);

    // Atualizar total de elegiveis no registro de execucao
    if (execucaoId) {
      await supabase
        .from('digisac_finalizacoes_execucoes')
        .update({ total_elegiveis: totalElegiveisGlobal })
        .eq('id', execucaoId);
    }

    const horarioFimBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    console.log(
      '[EXECUTAR-MANUAL] Fim.' +
      ' execucaoId=' + (resultado.execucaoId ?? 'n/a') +
      ' status=' + resultado.status +
      ' finalizados=' + resultado.totalFinalizados +
      ' erros=' + resultado.totalErros +
      ' ignorados=' + resultado.totalIgnorados +
      ' duracao=' + resultado.duracaoMs + 'ms'
    );

    return NextResponse.json({
      ok: resultado.ok,
      modo: 'manual',
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
    console.error('[EXECUTAR-MANUAL] Erro geral:', mensagem);
    await finalizarComErro('geral', mensagem);
    return NextResponse.json(
      { ok: false, error: 'Erro interno', execucaoId },
      { status: 500 }
    );
  }
}
