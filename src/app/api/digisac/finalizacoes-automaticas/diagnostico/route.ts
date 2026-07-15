import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';
import { buscarMensagensTicketPaginado } from '@/lib/digisac/sgi-sync';
import type { DigisacMensagem } from '@/lib/digisac/sgi-sync';
import { createServiceClient } from '@/lib/supabase/service';
import { buscarConexoesHabilitadas } from '@/lib/digisac/finalizacoesAutomaticas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Constantes ──────────────────────────────────────────────────────────────

const DIGISAC_WEB_BASE_URL = 'https://lebebe.digisac.me';
const JANELA_HORAS = 24;
const JANELA_MS = JANELA_HORAS * 60 * 60 * 1000;
// ID definitivo do tópico "FECHAMENTO AUTOMATICO AUTOMACAO" no Digisac
const DIGISAC_TICKET_TOPIC_ID_FECHAMENTO_AUTOMATICO = '422e6abf-66ad-45fd-a0ee-217648398d3e';
// PENDENTE: validar byUserId correto para fechamento (DIGISAC_BOT_USER_ID ou outro) antes da Fase 2
const CONCORRENCIA_LOTES = 5;
const PER_PAGE_TICKETS = 200;
const LIMITE_PAGINAS_TICKETS = 20;

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface TicketAberto {
  id: string;
  protocol?: string | number;
  contactId?: string;
  contact?: {
    id?: string;
    serviceId?: string;
    name?: string;
    data?: { number?: string };
    service?: { id?: string; name?: string };
  };
  department?: { id?: string; name?: string };
  user?: { id?: string; name?: string };
  firstMessage?: {
    id?: string;
    type?: string;
    isFromMe?: boolean;
    visible?: boolean;
    isComment?: boolean;
    timestamp?: number;
  } | null;
  startedAt?: string;
  createdAt?: string;
}

interface TicketElegivel {
  ticketId: string;
  protocolo: string | null;
  ticketHistoryUrl: string;
  contactId: string | null;
  nomeContato: string | null;
  telefoneContato: string | null;
  serviceIdContato: string | null;
  serviceNameContato: string | null;
  conexaoConfirmada: boolean;
  tipoChamado: 'ativo' | 'receptivo' | 'indefinido';
  ultimaMensagemEm: string | null;
  ultimaMensagemPor: 'cliente' | 'nos' | 'desconhecido';
  horasSemInteracao: number;
  previewUltimaMensagem: string | null;
  motivoElegibilidade: string;
  endpointFechamentoPrevisto: string | null;
  ticketTopicIdFechamentoPrevisto: string;
}

interface TicketIgnoradoRecente {
  ticketId: string;
  protocolo: string | null;
  horasSemInteracao: number;
  serviceIdContato: string | null;
  serviceNameContato: string | null;
  conexaoConfirmada: boolean;
}

interface TicketIgnoradoOutraConexao {
  ticketId: string;
  protocolo: string | null;
  contactId: string | null;
  serviceIdContato: string | null;
  serviceNameContato: string | null;
  motivo: string;
}

interface ErroTicket {
  ticketId: string;
  mensagem: string;
}

type ResultadoAnalise =
  | { tipo: 'elegivel'; dados: TicketElegivel }
  | { tipo: 'recente'; dados: TicketIgnoradoRecente }
  | { tipo: 'sem_mensagens' }
  | { tipo: 'erro'; dados: ErroTicket };

// ─── Helpers locais ───────────────────────────────────────────────────────────

interface DadosConexao {
  serviceIdContato: string | null;
  serviceNameContato: string | null;
  conexaoConfirmada: boolean;
  campoUsado: string;
}

/**
 * Extrai dados da conexão do payload do ticket.
 * Tenta: contact.service.id → contact.serviceId → null.
 * Nunca inventa campo — registra qual campo foi usado.
 * serviceIdAlvo é o serviceId que estamos buscando nesta execução.
 */
function extrairDadosConexao(ticket: TicketAberto, serviceIdAlvo: string): DadosConexao {
  const serviceIdViaServiceObj = ticket.contact?.service?.id ?? null;
  const serviceIdViaDireto = ticket.contact?.serviceId ?? null;
  const serviceId = serviceIdViaServiceObj ?? serviceIdViaDireto;
  const serviceName = ticket.contact?.service?.name ?? null;
  const campoUsado = serviceIdViaServiceObj != null
    ? 'contact.service.id'
    : serviceIdViaDireto != null
    ? 'contact.serviceId'
    : 'nao_encontrado';
  return {
    serviceIdContato: serviceId,
    serviceNameContato: serviceName,
    conexaoConfirmada: serviceId === serviceIdAlvo,
    campoUsado,
  };
}

function montarUrlHistoricoTicket(ticketId: string): string {
  return `${DIGISAC_WEB_BASE_URL}/ticket-history/${ticketId}`;
}

/**
 * Extrai o timestamp em ms de uma DigisacMensagem.
 * Replicado de vacuoAtivo.ts (não exportado lá).
 * Tenta: timestamp em segundos → timestamp em ms → createdAt ISO.
 */
function extrairTimestampMs(m: DigisacMensagem): number | null {
  const ts = m.timestamp;
  if (ts != null) {
    const n = Number(ts);
    if (!isNaN(n) && n > 0) {
      const dSeg = new Date(n * 1000);
      if (!isNaN(dSeg.getTime()) && dSeg.getFullYear() > 2000 && dSeg.getFullYear() < 2100) {
        return dSeg.getTime();
      }
      const dMs = new Date(n);
      if (!isNaN(dMs.getTime()) && dMs.getFullYear() > 2000 && dMs.getFullYear() < 2100) {
        return dMs.getTime();
      }
    }
  }
  const created = (m as unknown as Record<string, unknown>).createdAt;
  if (typeof created === 'string' && created.length > 0) {
    const d = new Date(created);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
      return d.getTime();
    }
  }
  return null;
}

/**
 * Processa itens em lotes com concorrência controlada.
 * Replicado de vacuoAtivo.ts (não exportado lá).
 */
async function processarEmLotes<T, R>(
  itens: T[],
  fn: (x: T) => Promise<R>,
  concorrencia: number
): Promise<R[]> {
  const res: R[] = [];
  let i = 0;
  const workers = Array.from(
    { length: Math.min(concorrencia, Math.max(1, itens.length)) },
    async () => {
      while (true) {
        const idx = i++;
        if (idx >= itens.length) break;
        res[idx] = await fn(itens[idx]);
      }
    }
  );
  await Promise.all(workers);
  return res;
}

// ─── Busca de tickets abertos do Bigorrilho ──────────────────────────────────

async function buscarTicketsAbertos(serviceIdAlvo: string): Promise<{
  tickets: TicketAberto[];
  paginacaoIncompleta: boolean;
}> {
  const baseParams = new URLSearchParams();
  baseParams.append('where[isOpen]', 'true');
  baseParams.append('include[0][model]', 'contact');
  baseParams.append('include[0][required]', 'true');
  baseParams.append('include[0][where][visible]', 'true');
  baseParams.append('include[0][where][serviceId]', serviceIdAlvo);
  baseParams.append('include[1][model]', 'department');
  baseParams.append('include[2][model]', 'user');
  baseParams.append('include[3][model]', 'firstMessage');
  baseParams.append('order[0][0]', 'createdAt');
  baseParams.append('order[0][1]', 'ASC');
  baseParams.append('perPage', String(PER_PAGE_TICKETS));

  const todos: TicketAberto[] = [];
  let page = 1;
  let lastPage = 1;
  let paginacaoIncompleta = false;

  do {
    if (page > LIMITE_PAGINAS_TICKETS) {
      paginacaoIncompleta = true;
      console.warn(
        '[DIAGNOSTICO-FINALIZACAO] Limite de paginas atingido (' + LIMITE_PAGINAS_TICKETS + '). Resultado truncado.'
      );
      break;
    }

    const p = new URLSearchParams(baseParams);
    p.append('page', String(page));

    const res = await fetchDigisac(`/tickets?${p.toString()}`);

    const rows: unknown[] = Array.isArray(res)
      ? res
      : ((res as { data?: unknown[] })?.data ??
        (res as { rows?: unknown[] })?.rows ??
        []);

    const total = Number(
      (res as { count?: number })?.count ??
      (res as { total?: number })?.total ??
      rows.length
    );
    lastPage = Number(
      (res as { lastPage?: number })?.lastPage ??
      Math.ceil(total / PER_PAGE_TICKETS) ??
      1
    );

    for (const r of rows) {
      todos.push(r as TicketAberto);
    }

    page++;
  } while (page <= lastPage);

  return { tickets: todos, paginacaoIncompleta };
}

// ─── Análise de um ticket ────────────────────────────────────────────────────

async function analisarTicket(
  ticket: TicketAberto,
  agora: number,
  avisos: string[],
  dadosConexao: DadosConexao
): Promise<ResultadoAnalise> {
  const ticketId = ticket.id;
  const contactId = ticket.contact?.id ?? ticket.contactId ?? null;

  try {
    const { mensagens, incompleto } = await buscarMensagensTicketPaginado(ticketId);

    if (incompleto) {
      avisos.push(
        `Ticket ${ticketId.slice(0, 8)}: mensagens incompletas (limite de paginas atingido). Analise pode estar incorreta.`
      );
    }

    const validas = mensagens.filter(
      (m) => m.type === 'chat' && m.visible !== false && m.isComment !== true
    );

    if (validas.length === 0) {
      return { tipo: 'sem_mensagens' };
    }

    // Última mensagem real: busca a de maior timestamp entre as válidas
    let ultimaMensagem: DigisacMensagem = validas[0];
    let ultimaTsMs = extrairTimestampMs(validas[0]) ?? 0;

    for (const m of validas) {
      const ts = extrairTimestampMs(m) ?? 0;
      if (ts > ultimaTsMs) {
        ultimaTsMs = ts;
        ultimaMensagem = m;
      }
    }

    // Se nenhum timestamp válido encontrado, usa a última da lista como fallback
    if (ultimaTsMs === 0) {
      ultimaMensagem = validas[validas.length - 1];
    }

    const ultimaTsReal = ultimaTsMs > 0 ? ultimaTsMs : null;
    const msSemInteracao = ultimaTsReal != null ? agora - ultimaTsReal : null;
    const horasSemInteracao = msSemInteracao != null
      ? Math.floor(msSemInteracao / (60 * 60 * 1000))
      : -1;

    // Ticket com interação recente (< 24h) → ignorar
    if (ultimaTsReal != null && msSemInteracao != null && msSemInteracao < JANELA_MS) {
      return {
        tipo: 'recente',
        dados: {
          ticketId,
          protocolo: ticket.protocol != null ? String(ticket.protocol) : null,
          horasSemInteracao,
          serviceIdContato: dadosConexao.serviceIdContato,
          serviceNameContato: dadosConexao.serviceNameContato,
          conexaoConfirmada: dadosConexao.conexaoConfirmada,
        },
      };
    }

    // ── Classificação ativo/receptivo via firstMessage.isFromMe ──
    // Reutiliza a mesma regra de calcularInicioChamado (sgi-sync.ts) e vacuoAtivo.ts
    const fm = ticket.firstMessage;
    let tipoChamado: 'ativo' | 'receptivo' | 'indefinido' = 'indefinido';
    if (
      fm &&
      fm.type !== undefined &&
      fm.isFromMe !== undefined &&
      fm.visible !== false &&
      fm.isComment !== true
    ) {
      tipoChamado = fm.isFromMe ? 'ativo' : 'receptivo';
    }

    // ── Quem enviou a última mensagem ──
    let ultimaMensagemPor: 'cliente' | 'nos' | 'desconhecido' = 'desconhecido';
    if (ultimaMensagem.isFromMe === true) ultimaMensagemPor = 'nos';
    else if (ultimaMensagem.isFromMe === false) ultimaMensagemPor = 'cliente';

    // Preview seguro da última mensagem (sem dados sensíveis, máximo 80 chars)
    const preview =
      typeof ultimaMensagem.text === 'string' && ultimaMensagem.text.trim().length > 0
        ? ultimaMensagem.text.trim().slice(0, 80)
        : null;

    const motivoElegibilidade = ultimaTsReal != null
      ? `Sem interacao ha ${horasSemInteracao}h (limite: ${JANELA_HORAS}h)`
      : `Timestamp da ultima mensagem nao identificado — elegivel por precaucao (sem dados para confirmar atividade recente)`;

    // Endpoint de fechamento previsto — montado sem chamar, apenas para referência da Fase 2
    const endpointFechamentoPrevisto = contactId != null
      ? `/api/v1/contacts/${contactId}/ticket/close`
      : null;

    return {
      tipo: 'elegivel',
      dados: {
        ticketId,
        protocolo: ticket.protocol != null ? String(ticket.protocol) : null,
        ticketHistoryUrl: montarUrlHistoricoTicket(ticketId),
        contactId,
        nomeContato: ticket.contact?.name ?? null,
        telefoneContato: ticket.contact?.data?.number ?? null,
        serviceIdContato: dadosConexao.serviceIdContato,
        serviceNameContato: dadosConexao.serviceNameContato,
        conexaoConfirmada: dadosConexao.conexaoConfirmada,
        tipoChamado,
        ultimaMensagemEm: ultimaTsReal != null ? new Date(ultimaTsReal).toISOString() : null,
        ultimaMensagemPor,
        horasSemInteracao,
        previewUltimaMensagem: preview,
        motivoElegibilidade,
        endpointFechamentoPrevisto,
        ticketTopicIdFechamentoPrevisto: DIGISAC_TICKET_TOPIC_ID_FECHAMENTO_AUTOMATICO,
      },
    };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[DIAGNOSTICO-FINALIZACAO] Erro ao analisar ticket=' + ticketId.slice(0, 8), mensagem);
    return { tipo: 'erro', dados: { ticketId, mensagem } };
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  const isCronInternal = cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  if (!isCronInternal) {
    const auth = await requireModuleAccess('digisac_finalizacoes_automaticas');
    if (!auth.ok) return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const serviceIdParam = searchParams.get('serviceId');

  const supabase = createServiceClient();

  const conexoesHabilitadas = await buscarConexoesHabilitadas(supabase);
  if (conexoesHabilitadas.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Nenhuma conexao habilitada para automacao. Configure a tabela digisac_conexoes_automacao.' },
      { status: 500 }
    );
  }

  const serviceIdAlvo = serviceIdParam ?? conexoesHabilitadas[0].service_id;

  const habilitada = conexoesHabilitadas.some(c => c.service_id === serviceIdAlvo);
  if (!habilitada) {
    return NextResponse.json(
      { ok: false, error: `serviceId ${serviceIdAlvo} nao esta habilitado para automacao` },
      { status: 403 }
    );
  }

  const serviceNameAlvo = conexoesHabilitadas.find(c => c.service_id === serviceIdAlvo)?.service_name ?? null;

  const inicio = Date.now();
  const avisos: string[] = [];

  console.log(
    '[DIAGNOSTICO-FINALIZACAO] Iniciando diagnostico dry-run.' +
    ' serviceId=' + serviceIdAlvo +
    ' janelaHoras=' + JANELA_HORAS
  );

  try {
    const { tickets, paginacaoIncompleta } = await buscarTicketsAbertos(serviceIdAlvo);

    console.log('[DIAGNOSTICO-FINALIZACAO] Tickets abertos encontrados:', tickets.length);

    if (paginacaoIncompleta) {
      avisos.push(
        `Paginacao truncada em ${LIMITE_PAGINAS_TICKETS} paginas (max ${LIMITE_PAGINAS_TICKETS * PER_PAGE_TICKETS} tickets). Resultado pode estar incompleto.`
      );
    }

    const agora = Date.now();

    // ── Filtro defensivo pós-query ──────────────────────────────────────────
    // Não confia apenas no filtro da API. Valida campo de conexão no payload.
    const ticketsIgnoradosOutraConexao: TicketIgnoradoOutraConexao[] = [];
    const ticketsAlvo: Array<{ ticket: TicketAberto; dadosConexao: DadosConexao }> = [];
    let campoNaoEncontradoCount = 0;

    for (const ticket of tickets) {
      const dadosConexao = extrairDadosConexao(ticket, serviceIdAlvo);

      if (dadosConexao.campoUsado === 'nao_encontrado') {
        campoNaoEncontradoCount++;
        ticketsAlvo.push({ ticket, dadosConexao });
        continue;
      }

      if (!dadosConexao.conexaoConfirmada) {
        ticketsIgnoradosOutraConexao.push({
          ticketId: ticket.id,
          protocolo: ticket.protocol != null ? String(ticket.protocol) : null,
          contactId: ticket.contact?.id ?? ticket.contactId ?? null,
          serviceIdContato: dadosConexao.serviceIdContato,
          serviceNameContato: dadosConexao.serviceNameContato,
          motivo: `serviceId do contato (${dadosConexao.serviceIdContato}) difere do alvo (${serviceIdAlvo})`,
        });
        continue;
      }

      ticketsAlvo.push({ ticket, dadosConexao });
    }

    if (campoNaoEncontradoCount > 0) {
      avisos.push(
        `${campoNaoEncontradoCount} ticket(s) sem campo de serviceId no payload (contact.service.id / contact.serviceId ausente). ` +
        `Esses tickets foram mantidos na analise pois a query ja filtrou por serviceId, mas a confirmacao dupla nao foi possivel.`
      );
    }

    if (ticketsIgnoradosOutraConexao.length > 0) {
      avisos.push(
        `${ticketsIgnoradosOutraConexao.length} ticket(s) ignorados por serviceId diferente do alvo (filtro defensivo pos-query).`
      );
    }

    console.log(
      '[DIAGNOSTICO-FINALIZACAO] Filtro defensivo:' +
      ' total=' + tickets.length +
      ' alvo=' + ticketsAlvo.length +
      ' outraConexao=' + ticketsIgnoradosOutraConexao.length +
      ' semCampoServiceId=' + campoNaoEncontradoCount
    );
    // ────────────────────────────────────────────────────────────────────────

    const resultados = await processarEmLotes(
      ticketsAlvo,
      ({ ticket, dadosConexao }) => analisarTicket(ticket, agora, avisos, dadosConexao),
      CONCORRENCIA_LOTES
    );

    console.log('[DIAGNOSTICO-FINALIZACAO] Analise concluida. Classificando resultados...');

    const ticketsElegiveis: TicketElegivel[] = [];
    const ticketsIgnoradosRecentes: TicketIgnoradoRecente[] = [];
    const erros: ErroTicket[] = [];
    let totalSemMensagensValidas = 0;

    for (const r of resultados) {
      if (r.tipo === 'elegivel') ticketsElegiveis.push(r.dados);
      else if (r.tipo === 'recente') ticketsIgnoradosRecentes.push(r.dados);
      else if (r.tipo === 'sem_mensagens') totalSemMensagensValidas++;
      else if (r.tipo === 'erro') erros.push(r.dados);
    }

    const tempoTotalMs = Date.now() - inicio;

    console.log(
      '[DIAGNOSTICO-FINALIZACAO] Fim.' +
      ' totalBruto=' + tickets.length +
      ' alvoAnalisados=' + ticketsAlvo.length +
      ' outraConexao=' + ticketsIgnoradosOutraConexao.length +
      ' elegiveis=' + ticketsElegiveis.length +
      ' recentes=' + ticketsIgnoradosRecentes.length +
      ' semMensagens=' + totalSemMensagensValidas +
      ' erros=' + erros.length +
      ' tempoMs=' + tempoTotalMs
    );

    if (tempoTotalMs > 50_000) {
      avisos.push(`Tempo de execucao elevado (${tempoTotalMs}ms). Em producao, pode haver risco de timeout.`);
    }

    return NextResponse.json({
      ok: true,
      modo: 'dry-run',
      serviceId: serviceIdAlvo,
      serviceName: serviceNameAlvo,
      janelaHoras: JANELA_HORAS,
      totalTicketsBrutosRecebidos: tickets.length,
      totalIgnoradosOutraConexao: ticketsIgnoradosOutraConexao.length,
      totalTicketsAbertosAnalisados: ticketsAlvo.length,
      totalElegiveisParaFinalizacao: ticketsElegiveis.length,
      totalIgnoradosRecentes: ticketsIgnoradosRecentes.length,
      totalSemMensagensValidas,
      totalErros: erros.length,
      ticketsElegiveis,
      ticketsIgnoradosRecentes: ticketsIgnoradosRecentes.slice(0, 5),
      ticketsIgnoradosOutraConexao: ticketsIgnoradosOutraConexao.slice(0, 5),
      erros,
      ...(avisos.length > 0 ? { avisos } : {}),
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[DIAGNOSTICO-FINALIZACAO] Erro geral:', mensagem);
    return NextResponse.json(
      { ok: false, error: 'Erro interno no diagnostico', details: mensagem },
      { status: 500 }
    );
  }
}
