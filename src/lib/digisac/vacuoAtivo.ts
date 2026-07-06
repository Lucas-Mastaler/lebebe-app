import { fetchDigisac } from './clienteDigisac';
import { montarRangeUtcSaoPaulo } from './utilsDatas';
import { buscarMensagensTicketPaginado, type DigisacMensagem } from './sgi-sync';
import type { VacuoAtivoResponse, ChamadoAvaliadoVacuo } from '@/types';

const DIGISAC_WEB_BASE_URL = 'https://lebebe.digisac.me';

function montarUrlHistoricoTicket(ticketId: string): string {
  return `${DIGISAC_WEB_BASE_URL}/ticket-history/${ticketId}`;
}

function extrairTimestampMs(m: DigisacMensagem): number | null {
  const ts = m.timestamp;
  if (ts != null) {
    const n = Number(ts);
    if (!isNaN(n) && n > 0) {
      const d = new Date(n * 1000);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
        return d.getTime();
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

interface FiltrosVacuoAtivo {
  dataInicio: string;
  dataFim: string;
  departmentIds?: string[];
  userIds?: string[];
  serviceIds?: string[];
}

interface TicketVacuo {
  id: string;
  contactId: string;
  departmentId: string;
  userId: string;
  createdAt: string;
  startedAt?: string;
  protocol?: string | number;
  department?: { name?: string };
  user?: { name?: string };
  contact?: { name?: string };
  firstMessage?: { isFromMe?: boolean } | null;
}


const LIMITE_ELEGIVEIS = 200;
const CACHE_TTL_VACUO = 5 * 60 * 1000;
const cacheVacuo = new Map<string, { data: VacuoAtivoResponse; at: number }>();

function chaveCache(f: FiltrosVacuoAtivo): string {
  return JSON.stringify({
    d: f.dataInicio,
    f: f.dataFim,
    deps: f.departmentIds?.slice().sort() ?? [],
    users: f.userIds?.slice().sort() ?? [],
    svc: f.serviceIds?.slice().sort() ?? [],
  });
}

function cacheGet(f: FiltrosVacuoAtivo): VacuoAtivoResponse | undefined {
  const key = chaveCache(f);
  const entry = cacheVacuo.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > CACHE_TTL_VACUO) {
    cacheVacuo.delete(key);
    return undefined;
  }
  return entry.data;
}

function cacheSet(f: FiltrosVacuoAtivo, data: VacuoAtivoResponse) {
  const key = chaveCache(f);
  cacheVacuo.set(key, { data, at: Date.now() });
}

async function processarEmLotes<T, R>(itens: T[], fn: (x: T) => Promise<R>, concorrencia = 12): Promise<R[]> {
  const res: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(concorrencia, Math.max(1, itens.length)) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= itens.length) break;
      const r = await fn(itens[idx]);
      res[idx] = r;
    }
  });
  await Promise.all(workers);
  return res;
}

async function buscarTicketsPeriodoVacuo(filtros: FiltrosVacuoAtivo): Promise<TicketVacuo[]> {
  const { inicioUtc, fimUtc } = montarRangeUtcSaoPaulo(filtros.dataInicio, filtros.dataFim);

  const params = new URLSearchParams();
  params.append('where[createdAt][$between][0]', inicioUtc);
  params.append('where[createdAt][$between][1]', fimUtc);
  params.append('include[0][model]', 'contact');
  params.append('include[0][required]', 'true');
  params.append('include[0][where][visible]', 'true');
  if (Array.isArray(filtros.serviceIds) && filtros.serviceIds.length === 1) {
    params.append('include[0][where][serviceId]', filtros.serviceIds[0]);
  }
  params.append('include[1][model]', 'department');
  params.append('include[2][model]', 'user');
  params.append('include[3][model]', 'firstMessage');
  params.append('order[0][0]', 'createdAt');
  params.append('order[0][1]', 'ASC');

  if (Array.isArray(filtros.departmentIds) && filtros.departmentIds.length === 1) {
    params.append('where[departmentId]', filtros.departmentIds[0]);
  }
  if (Array.isArray(filtros.userIds) && filtros.userIds.length === 1) {
    params.append('where[userId]', filtros.userIds[0]);
  }

  let page = 1;
  const perPage = 200;
  let lastPage = 1;
  const todos: TicketVacuo[] = [];

  do {
    const p = new URLSearchParams(params);
    p.append('page', String(page));
    p.append('perPage', String(perPage));
    const url = `/tickets?${p.toString()}`;
    const res = await fetchDigisac(url);
    const rows: unknown[] = Array.isArray(res) ? res : ((res as { rows?: unknown[] })?.rows || (res as { data?: unknown[] })?.data || []);
    const total = Number((res as { count?: number; total?: number })?.count || (res as { count?: number; total?: number })?.total || rows.length || 0);
    lastPage = Number(res?.lastPage || Math.ceil(total / perPage) || 1);

    for (const r of rows) {
      const t = r as TicketVacuo;
      todos.push({
        id: t.id,
        contactId: t.contactId,
        departmentId: t.departmentId,
        userId: t.userId,
        createdAt: t.createdAt,
        startedAt: t.startedAt,
        protocol: t.protocol,
        department: t.department,
        user: t.user,
        contact: t.contact,
        firstMessage: t.firstMessage ?? null,
      });
    }

    page++;
  } while (page <= lastPage);

  const filtrarDep = Array.isArray(filtros.departmentIds) && filtros.departmentIds.length > 0;
  const filtrarUser = Array.isArray(filtros.userIds) && filtros.userIds.length > 0;
  const filtrarService = Array.isArray(filtros.serviceIds) && filtros.serviceIds.length > 1;

  return todos.filter((t) => {
    const depOk = filtrarDep ? filtros.departmentIds!.includes(t.departmentId) : true;
    const userOk = filtrarUser ? filtros.userIds!.includes(t.userId) : true;
    const svcOk = filtrarService ? filtros.serviceIds!.includes((t as TicketVacuo & { contact?: { serviceId?: string } }).contact?.serviceId || '') : true;
    return depOk && userOk && svcOk;
  });
}

async function buscarRespostaClienteTicket(
  ticket: TicketVacuo,
  aberturaMs: number,
  limiteMs: number
): Promise<{ ts: number | null; totalMensagens: number; comTimestamp: number; mensagensClienteEm24h: number; campoData: string }> {
  const { mensagens } = await buscarMensagensTicketPaginado(ticket.id);

  let comTimestamp = 0;
  let mensagensClienteEm24h = 0;
  let primeiraTs: number | null = null;
  let campoDataUsado = 'nenhum';

  if (mensagens.length > 0) {
    const primeira = mensagens[0] as unknown as Record<string, unknown>;
    const keys = Object.keys(primeira);
    const tipos: Record<string, string> = {};
    for (const k of ['timestamp', 'createdAt', 'date', 'sentAt', 'data', 'isFromMe', 'text']) {
      tipos[k] = typeof primeira[k];
    }
    console.log(
      '[VACUO_ATIVO][COMPARE][VACUO] ticket=' + ticket.id.slice(0, 8) +
      ' total=' + mensagens.length +
      ' keys=' + JSON.stringify(keys) +
      ' tipos=' + JSON.stringify(tipos)
    );
  }

  for (const m of mensagens) {
    const tsMs = extrairTimestampMs(m);
    if (tsMs !== null) {
      comTimestamp++;
      campoDataUsado = m.timestamp != null ? 'timestamp' : 'createdAt';
    }

    if (
      m.isFromMe === false &&
      tsMs !== null &&
      tsMs > aberturaMs &&
      tsMs <= limiteMs
    ) {
      mensagensClienteEm24h++;
      if (primeiraTs === null) {
        primeiraTs = tsMs;
      }
    }
  }

  return { ts: primeiraTs, totalMensagens: mensagens.length, comTimestamp, mensagensClienteEm24h, campoData: campoDataUsado };
}

export async function calcularVacuoAtivoDashboard(filtros: FiltrosVacuoAtivo): Promise<VacuoAtivoResponse> {
  const cached = cacheGet(filtros);
  if (cached) {
    console.log('[VACUO_ATIVO] cache hit');
    return cached;
  }

  const start = Date.now();
  const tickets = await buscarTicketsPeriodoVacuo(filtros);

  const ativos = tickets.filter(
    (t) => t.firstMessage && t.firstMessage.isFromMe === true
  );

  const agora = Date.now();
  const VINTA_QUATRO_MS = 24 * 60 * 60 * 1000;

  const elegiveis = ativos.filter((t) => {
    const dataAbertura = t.startedAt ? new Date(t.startedAt).getTime() : new Date(t.createdAt).getTime();
    return dataAbertura + VINTA_QUATRO_MS <= agora;
  });

  console.log('[VACUO_ATIVO] tickets=', tickets.length, 'ativos=', ativos.length, 'elegiveis=', elegiveis.length, 'tempoBuscaTickets=', Date.now() - start, 'ms');

  if (elegiveis.length > LIMITE_ELEGIVEIS) {
    const resultado: VacuoAtivoResponse = {
      taxaVacuoAtivo: null,
      chamadosAtivosTotal: ativos.length,
      chamadosAtivosElegiveis: elegiveis.length,
      chamadosEmVacuo: null,
      chamadosRespondidosEm24h: null,
      calculado: false,
      limiteExcedido: true,
      mensagem: 'Período possui muitos chamados ativos elegíveis para cálculo em tempo real. Reduza o período.',
    };
    cacheSet(filtros, resultado);
    return resultado;
  }

  if (elegiveis.length === 0) {
    const resultado: VacuoAtivoResponse = {
      taxaVacuoAtivo: null,
      chamadosAtivosTotal: ativos.length,
      chamadosAtivosElegiveis: 0,
      chamadosEmVacuo: null,
      chamadosRespondidosEm24h: null,
      calculado: false,
      limiteExcedido: false,
      mensagem: null,
    };
    cacheSet(filtros, resultado);
    return resultado;
  }

  const primeiraRespostaPorTicket = new Map<string, number>();
  const detalhesPorTicket = new Map<string, { totalMensagens: number; mensagensClienteEm24h: number }>();

  const respostas = await processarEmLotes(
    elegiveis,
    async (ticket) => {
      const abertura = ticket.startedAt ? new Date(ticket.startedAt).getTime() : new Date(ticket.createdAt).getTime();
      const limite = abertura + VINTA_QUATRO_MS;

      try {
        const resultado = await buscarRespostaClienteTicket(ticket, abertura, limite);
        console.log(
          '[VACUO_ATIVO][SGI-SYNC] ticket=' + ticket.id.slice(0, 8) +
          ' helper=sgi-sync' +
          ' totalMensagens=' + resultado.totalMensagens +
          ' comTimestamp=' + resultado.comTimestamp +
          ' mensagensClienteEm24h=' + resultado.mensagensClienteEm24h +
          ' campoData=' + resultado.campoData +
          ' respondeuEm24h=' + (resultado.ts !== null)
        );
        return {
          ticketId: ticket.id,
          ts: resultado.ts,
          totalMensagens: resultado.totalMensagens,
          mensagensClienteEm24h: resultado.mensagensClienteEm24h,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[VACUO_ATIVO][SGI-SYNC] erro ticket=' + ticket.id.slice(0, 8), msg);
        return { ticketId: ticket.id, ts: null, totalMensagens: 0, mensagensClienteEm24h: 0 };
      }
    },
    12
  );

  for (const r of respostas) {
    if (r.ts !== null) {
      primeiraRespostaPorTicket.set(r.ticketId, r.ts);
    }
    detalhesPorTicket.set(r.ticketId, {
      totalMensagens: r.totalMensagens,
      mensagensClienteEm24h: r.mensagensClienteEm24h,
    });
  }

  let chamadosEmVacuo = 0;
  let chamadosRespondidosEm24h = 0;

  const chamadosAvaliados: ChamadoAvaliadoVacuo[] = [];

  for (const t of elegiveis) {
    const abertura = t.startedAt ? new Date(t.startedAt).getTime() : new Date(t.createdAt).getTime();
    const limite = abertura + VINTA_QUATRO_MS;
    const primeiraResposta = primeiraRespostaPorTicket.get(t.id);
    const detalhes = detalhesPorTicket.get(t.id);

    const respondido = primeiraResposta !== undefined && primeiraResposta > abertura && primeiraResposta <= limite;

    if (respondido) {
      chamadosRespondidosEm24h++;
    } else {
      chamadosEmVacuo++;
    }

    chamadosAvaliados.push({
      protocol: t.protocol != null ? String(t.protocol) : null,
      ticketId: t.id.slice(0, 8),
      ticketHistoryUrl: montarUrlHistoricoTicket(t.id),
      statusVacuo: respondido ? 'respondido_em_24h' : 'vacuo',
      temRespostaClienteEm24h: respondido,
      totalMensagens: detalhes?.totalMensagens ?? 0,
      mensagensClienteEm24h: detalhes?.mensagensClienteEm24h ?? 0,
    });
  }

  console.log(
    '[VACUO_ATIVO][AVALIADOS] total=' + chamadosAvaliados.length +
    ' itens=' + JSON.stringify(chamadosAvaliados.map(c => ({
      protocol: c.protocol,
      ticket: c.ticketId,
      statusVacuo: c.statusVacuo,
      temRespostaClienteEm24h: c.temRespostaClienteEm24h,
      totalMensagens: c.totalMensagens,
      mensagensClienteEm24h: c.mensagensClienteEm24h,
    })))
  );

  const taxa = elegiveis.length > 0
    ? Number(((chamadosEmVacuo / elegiveis.length) * 100).toFixed(1))
    : null;

  const resultado: VacuoAtivoResponse = {
    taxaVacuoAtivo: taxa,
    chamadosAtivosTotal: ativos.length,
    chamadosAtivosElegiveis: elegiveis.length,
    chamadosEmVacuo,
    chamadosRespondidosEm24h,
    calculado: true,
    limiteExcedido: false,
    mensagem: null,
    chamadosAvaliados,
  };

  cacheSet(filtros, resultado);

  const end = Date.now();
  console.log('[VACUO_ATIVO] resultado=', {
    taxaVacuoAtivo: taxa,
    chamadosEmVacuo,
    chamadosRespondidosEm24h,
    chamadosAtivosElegiveis: elegiveis.length,
    tempoTotal: end - start,
  });

  return resultado;
}
