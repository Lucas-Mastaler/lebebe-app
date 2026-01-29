import { fetchDigisac } from './clienteDigisac';
import { montarRangeUtcSaoPaulo } from './utilsDatas';
import { buscarAgendamentosFormatados } from './agendamentos';
import { DashboardClienteDetalhe, DashboardLinha, DashboardLinhaConsultora, DashboardResponse } from '@/types';

interface FiltrosDashboardService {
  dataInicio: string;
  dataFim: string;
  departmentIds?: string[];
  userIds?: string[];
}

interface Ticket {
  id: string;
  contactId: string;
  departmentId: string;
  userId: string;
  createdAt: string;
  department?: { name?: string };
  user?: { name?: string };
  contact?: { name?: string };
  firstMessage?: { isFromMe?: boolean } | null;
}

// Cache em memória dos totais históricos por contato (TTL 6h)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
type CacheEntry = { total: number; at: number };
const historicoCache = new Map<string, CacheEntry>();
let cacheHits = 0;
let cacheMisses = 0;

function cacheGet(contactId: string): number | undefined {
  const e = historicoCache.get(contactId);
  if (!e) return undefined;
  if (Date.now() - e.at > CACHE_TTL_MS) {
    historicoCache.delete(contactId);
    return undefined;
  }
  cacheHits++;
  return e.total;
}

function cacheSet(contactId: string, total: number) {
  historicoCache.set(contactId, { total, at: Date.now() });
}

async function buscarTotalHistoricoPorContato(contactId: string): Promise<number> {
  const fromCache = cacheGet(contactId);
  if (typeof fromCache === 'number') return fromCache;
  cacheMisses++;
  try {
    const p = new URLSearchParams();
    p.append('where[contactId]', contactId);
    p.append('limit', '1');
    p.append('skip', '0');
    const url = `/tickets?${p.toString()}`;
    const res: any = await fetchDigisac(url);
    const total = Number(res?.total ?? res?.count ?? 0);
    cacheSet(contactId, total);
    return total;
  } catch (err) {
    console.error('[DASHBOARD] Erro ao buscar histórico de contato', contactId, err);
    return 0;
  }
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

function agruparTicketsPorFilial(tickets: Ticket[]) {
  const grupos = new Map<string, { nome: string; tickets: Ticket[] }>();
  for (const t of tickets) {
    const depId = t.departmentId || 'sem-departamento';
    const nome = t.department?.name || 'Sem departamento';
    const g = grupos.get(depId) || { nome, tickets: [] };
    g.tickets.push(t);
    if (!grupos.has(depId)) grupos.set(depId, g);
  }
  return grupos;
}

function agruparTicketsPorConsultora(tickets: Ticket[]) {
  const grupos = new Map<string, { nome: string; tickets: Ticket[] }>();
  for (const t of tickets) {
    const uid = t.userId || 'sem-user';
    const nome = t.user?.name || 'Sem consultora';
    const g = grupos.get(uid) || { nome, tickets: [] };
    g.tickets.push(t);
    if (!grupos.has(uid)) grupos.set(uid, g);
  }
  return grupos;
}

function calcularAtivoReceptivoPrimeiroTicketPorContato(tickets: Ticket[]) {
  const porContato = new Map<string, Ticket[]>();
  for (const t of tickets) {
    if (!t.contactId) continue;
    const arr = porContato.get(t.contactId) || [];
    arr.push(t);
    porContato.set(t.contactId, arr);
  }

  let totalClientesUnicosAtivo = 0;
  let totalClientesUnicosReceptivo = 0;

  porContato.forEach((arr) => {
    arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const first = arr.find((x) => x.firstMessage != null);
    if (!first || !first.firstMessage || typeof first.firstMessage.isFromMe !== 'boolean') {
      console.warn('[DASHBOARD] Ticket sem firstMessage detectado; ignorando contato no cálculo. ticketId=', first?.id);
      return;
    }
    if (first.firstMessage.isFromMe === true) totalClientesUnicosAtivo++;
    else totalClientesUnicosReceptivo++;
  });

  return { totalClientesUnicosAtivo, totalClientesUnicosReceptivo };
}

async function buscarTicketsPeriodo(filtros: FiltrosDashboardService): Promise<Ticket[]> {
  const { inicioUtc, fimUtc } = montarRangeUtcSaoPaulo(filtros.dataInicio, filtros.dataFim);

  const params = new URLSearchParams();
  params.append('where[createdAt][$between][0]', inicioUtc);
  params.append('where[createdAt][$between][1]', fimUtc);
  params.append('include[0][model]', 'contact');
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
  let total = 0;
  let lastPage = 1;
  const todos: Ticket[] = [];

  do {
    const p = new URLSearchParams(params);
    p.append('page', String(page));
    p.append('perPage', String(perPage));
    const url = `/tickets?${p.toString()}`;
    const res = await fetchDigisac(url);
    const rows: any[] = Array.isArray(res) ? res : (res.rows || res.data || []);
    total = Number(res?.count || res?.total || rows.length || 0);
    lastPage = Number(res?.lastPage || Math.ceil(total / perPage) || 1);

    for (const r of rows) {
      const t: Ticket = {
        id: r.id,
        contactId: r.contactId,
        departmentId: r.departmentId,
        userId: r.userId,
        createdAt: r.createdAt,
        department: r.department,
        user: r.user,
        contact: r.contact,
        firstMessage: r.firstMessage ?? null,
      };
      todos.push(t);
    }

    page++;
  } while (page <= lastPage);

  // Filtros locais multi-seleção (quando >1 selecionado)
  const filtrarDep = Array.isArray(filtros.departmentIds) && filtros.departmentIds.length > 0;
  const filtrarUser = Array.isArray(filtros.userIds) && filtros.userIds.length > 0;

  const filtrados = todos.filter((t) => {
    const depOk = filtrarDep ? filtros.departmentIds!.includes(t.departmentId) : true;
    const userOk = filtrarUser ? filtros.userIds!.includes(t.userId) : true;
    return depOk && userOk;
  });

  console.log('[DASHBOARD] filtros=', {
    inicioUtc,
    fimUtc,
    departmentsCount: Array.isArray(filtros.departmentIds) ? filtros.departmentIds.length : 0,
    usersCount: Array.isArray(filtros.userIds) ? filtros.userIds.length : 0,
  });
  console.log('[DASHBOARD] ticketsTotal=', filtrados.length, 'exemplo=', filtrados[0] ? {
    id: filtrados[0].id,
    createdAt: filtrados[0].createdAt,
    departmentId: filtrados[0].departmentId,
    userId: filtrados[0].userId,
    hasFirstMessage: !!filtrados[0].firstMessage,
    firstIsFromMe: filtrados[0].firstMessage?.isFromMe,
  } : null);

  return filtrados;
}

async function contarAgendamentosCriadosNoPeriodoPorFilial(
  departmentId: string,
  filtros: FiltrosDashboardService
): Promise<number> {
  // Reutiliza a mesma lógica/fonte do módulo de Agendamentos
  // Utiliza data de CRIAÇÃO no período
  let total = 0;
  if (Array.isArray(filtros.userIds) && filtros.userIds.length > 0) {
    for (const uid of filtros.userIds) {
      const res = await buscarAgendamentosFormatados({
        dataCriacaoInicio: filtros.dataInicio,
        dataCriacaoFim: filtros.dataFim,
        departmentId,
        userId: uid,
        page: 1,
        perPage: 1,
      } as any);
      total += Number(res?.meta?.total || 0);
    }
  } else {
    const res = await buscarAgendamentosFormatados({
      dataCriacaoInicio: filtros.dataInicio,
      dataCriacaoFim: filtros.dataFim,
      departmentId,
      page: 1,
      perPage: 1,
    } as any);
    total = Number(res?.meta?.total || 0);
  }
  return total;
}

async function contarAgendamentosCriadosNoPeriodoPorConsultora(
  userId: string,
  filtros: FiltrosDashboardService
): Promise<number> {
  // Se não houver userId válido, não consultar API (evita erro de UUID inválido)
  if (!userId || userId === 'sem-user') return 0;
  let total = 0;
  if (Array.isArray(filtros.departmentIds) && filtros.departmentIds.length > 0) {
    for (const depId of filtros.departmentIds) {
      const res = await buscarAgendamentosFormatados({
        dataCriacaoInicio: filtros.dataInicio,
        dataCriacaoFim: filtros.dataFim,
        departmentId: depId,
        userId,
        page: 1,
        perPage: 1,
      } as any);
      total += Number(res?.meta?.total || 0);
    }
  } else {
    const res = await buscarAgendamentosFormatados({
      dataCriacaoInicio: filtros.dataInicio,
      dataCriacaoFim: filtros.dataFim,
      userId,
      page: 1,
      perPage: 1,
    } as any);
    total = Number(res?.meta?.total || 0);
  }
  return total;
}

export async function pesquisarDashboard(filtros: FiltrosDashboardService): Promise<DashboardResponse> {
  const start = Date.now();
  const tickets = await buscarTicketsPeriodo(filtros);

  // Agrupar por filial
  const grupos = agruparTicketsPorFilial(tickets);

  // Preparar estruturas para histórico por contato
  const contatoNomePorId = new Map<string, string>();
  const contatoFilialCounts = new Map<string, Map<string, number>>(); // contactId -> (departmentId -> count no período)
  const contatosPorFilial = new Map<string, Set<string>>(); // departmentId -> set(contactId)
  for (const t of tickets) {
    if (!t.contactId) continue;
    if (t.contact?.name && !contatoNomePorId.has(t.contactId)) {
      contatoNomePorId.set(t.contactId, t.contact.name);
    }
    const byFilial = contatoFilialCounts.get(t.contactId) || new Map<string, number>();
    byFilial.set(t.departmentId, (byFilial.get(t.departmentId) || 0) + 1);
    contatoFilialCounts.set(t.contactId, byFilial);

    const set = contatosPorFilial.get(t.departmentId) || new Set<string>();
    set.add(t.contactId);
    contatosPorFilial.set(t.departmentId, set);
  }

  const contatosUnicosPeriodo = Array.from(contatoFilialCounts.keys());
  const inicioHist = Date.now();
  console.log('[DASHBOARD][HIST] iniciando busca histórico - contatos únicos:', contatosUnicosPeriodo.length);
  const totaisHistorico = await processarEmLotes(
    contatosUnicosPeriodo,
    (cid) => buscarTotalHistoricoPorContato(cid),
    12
  );
  const fimHist = Date.now();
  console.log('[DASHBOARD][HIST] concluído em ms=', fimHist - inicioHist, 'cacheHits=', cacheHits, 'cacheMisses=', cacheMisses);
  const mapaHistorico = new Map<string, number>();
  contatosUnicosPeriodo.forEach((cid, idx) => mapaHistorico.set(cid, totaisHistorico[idx] || 0));

  const linhas: DashboardLinha[] = [];
  let totalChamadosHistoricoSomado = 0;
  // Agregado por filial
  const totalHistoricoPorFilial = new Map<string, number>();
  for (const cid of contatosUnicosPeriodo) {
    const total = mapaHistorico.get(cid) || 0;
    totalChamadosHistoricoSomado += total;
    const depCounts = contatoFilialCounts.get(cid);
    if (depCounts) {
      for (const depId of depCounts.keys()) {
        totalHistoricoPorFilial.set(depId, (totalHistoricoPorFilial.get(depId) || 0) + total);
      }
    }
  }

  for (const [departmentId, info] of grupos.entries()) {
    const ts = info.tickets;
    const contatoIds = new Set(ts.map((t) => t.contactId).filter(Boolean));
    const totalClientesUnicos = contatoIds.size;

    let totalChamadosAtivosNoPeriodo = 0;
    let totalChamadosReceptivosNoPeriodo = 0;
    for (const t of ts) {
      if (!t.firstMessage) {
        console.warn('[DASHBOARD] Ignorando ticket sem firstMessage id=', t.id);
        continue;
      }
      if (t.firstMessage.isFromMe === true) totalChamadosAtivosNoPeriodo++;
      else if (t.firstMessage.isFromMe === false) totalChamadosReceptivosNoPeriodo++;
    }

    const { totalClientesUnicosAtivo, totalClientesUnicosReceptivo } =
      calcularAtivoReceptivoPrimeiroTicketPorContato(ts);

    const agendamentosCriadosNoPeriodo = await contarAgendamentosCriadosNoPeriodoPorFilial(
      departmentId,
      filtros
    );

    const ratioAgendamentosPorCliente = totalClientesUnicos > 0
      ? Number((agendamentosCriadosNoPeriodo / totalClientesUnicos).toFixed(2))
      : 0;

    // Montar detalhes de clientes desta filial
    const clientesDetalhe: DashboardClienteDetalhe[] = [];
    const setFilial = contatosPorFilial.get(departmentId) || new Set<string>();
    setFilial.forEach((cid) => {
      const nome = contatoNomePorId.get(cid) || '-';
      const totalHistorico = mapaHistorico.get(cid) || 0;
      const chamadosNoPeriodo = contatoFilialCounts.get(cid)?.get(departmentId) || 0;
      clientesDetalhe.push({ contactId: cid, nome, filial: info.nome, totalChamadosHistorico: totalHistorico, chamadosNoPeriodo });
    });

    linhas.push({
      departmentId,
      filial: info.nome,
      totalClientesUnicos,
      agendamentosCriadosNoPeriodo,
      ratioAgendamentosPorCliente,
      totalChamadosAtivosNoPeriodo,
      totalChamadosReceptivosNoPeriodo,
      totalClientesUnicosAtivo,
      totalClientesUnicosReceptivo,
      totalChamadosHistoricoSomadoFilial: totalHistoricoPorFilial.get(departmentId) || 0,
      clientesDetalhe,
    });
  }

  // Agrupar por consultoras
  const gruposConsultoras = agruparTicketsPorConsultora(tickets);
  const linhasConsultoras: DashboardLinhaConsultora[] = [];
  for (const [userId, info] of gruposConsultoras.entries()) {
    const ts = info.tickets;
    const contatoIds = new Set(ts.map((t) => t.contactId).filter(Boolean));
    const totalClientesUnicos = contatoIds.size;

    let totalChamadosAtivosNoPeriodo = 0;
    let totalChamadosReceptivosNoPeriodo = 0;
    for (const t of ts) {
      if (!t.firstMessage) continue;
      if (t.firstMessage.isFromMe === true) totalChamadosAtivosNoPeriodo++;
      else if (t.firstMessage.isFromMe === false) totalChamadosReceptivosNoPeriodo++;
    }

    const { totalClientesUnicosAtivo, totalClientesUnicosReceptivo } =
      calcularAtivoReceptivoPrimeiroTicketPorContato(ts);

    const agendamentosCriadosNoPeriodo = await contarAgendamentosCriadosNoPeriodoPorConsultora(
      userId,
      filtros
    );

    const ratioAgendamentosPorCliente = totalClientesUnicos > 0
      ? Number((agendamentosCriadosNoPeriodo / totalClientesUnicos).toFixed(2))
      : 0;

    const ratioChamadosAtivosPorUnicoAtivo = totalClientesUnicosAtivo > 0
      ? Number((totalChamadosAtivosNoPeriodo / totalClientesUnicosAtivo).toFixed(2))
      : 0;
    const ratioChamadosReceptivosPorUnicoReceptivo = totalClientesUnicosReceptivo > 0
      ? Number((totalChamadosReceptivosNoPeriodo / totalClientesUnicosReceptivo).toFixed(2))
      : 0;

    // Soma dos chamados históricos dos clientes únicos atendidos por esta consultora no período
    let totalChamadosHistoricoSomadoConsultora = 0;
    contatoIds.forEach((cid) => {
      totalChamadosHistoricoSomadoConsultora += mapaHistorico.get(cid) || 0;
    });

    linhasConsultoras.push({
      userId,
      consultora: info.nome,
      totalClientesUnicos,
      agendamentosCriadosNoPeriodo,
      ratioAgendamentosPorCliente,
      totalChamadosAtivosNoPeriodo,
      totalChamadosReceptivosNoPeriodo,
      totalClientesUnicosAtivo,
      totalClientesUnicosReceptivo,
      ratioChamadosAtivosPorUnicoAtivo,
      ratioChamadosReceptivosPorUnicoReceptivo,
      totalChamadosHistoricoSomadoConsultora,
    });
  }

  // Construir Top 50 por histórico (escolhendo filial com mais chamados no período)
  const clientesHistoricoTop: DashboardClienteDetalhe[] = [];
  for (const cid of contatosUnicosPeriodo) {
    const nome = contatoNomePorId.get(cid) || '-';
    const totalHistorico = mapaHistorico.get(cid) || 0;
    const depCounts = contatoFilialCounts.get(cid) || new Map<string, number>();
    let melhorDep = '';
    let melhorCount = -1;
    depCounts.forEach((c, depId) => {
      if (c > melhorCount) {
        melhorCount = c;
        melhorDep = depId;
      }
    });
    // Obter nome da filial
    const nomeFilial = grupos.get(melhorDep)?.nome || '-';
    const chamadosNoPeriodo = Array.from(depCounts.values()).reduce((a, b) => a + b, 0);
    clientesHistoricoTop.push({ contactId: cid, nome, filial: nomeFilial, totalChamadosHistorico: totalHistorico, chamadosNoPeriodo });
  }
  clientesHistoricoTop.sort((a, b) => b.totalChamadosHistorico - a.totalChamadosHistorico);
  const clientesHistoricoTop50 = clientesHistoricoTop.slice(0, 50);

  const { inicioUtc, fimUtc } = montarRangeUtcSaoPaulo(filtros.dataInicio, filtros.dataFim);
  const end = Date.now();
  console.log('[DASHBOARD] linhasFiliais=', linhas.length, 'linhasConsultoras=', linhasConsultoras.length, 'timeMs=', end - start, 'totalHistoricoSomado=', totalChamadosHistoricoSomado);

  return {
    periodo: { inicio: inicioUtc, fim: fimUtc },
    linhas,
    linhasConsultoras,
    totalChamadosHistoricoSomado,
    clientesHistoricoTop: clientesHistoricoTop50,
  };
}
