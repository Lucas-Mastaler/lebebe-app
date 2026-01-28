import { fetchDigisac } from './clienteDigisac';
import { montarRangeUtcSaoPaulo } from './utilsDatas';
import { buscarAgendamentosFormatados } from './agendamentos';
import { DashboardLinha, DashboardResponse } from '@/types';

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
  firstMessage?: { isFromMe?: boolean } | null;
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

export async function pesquisarDashboard(filtros: FiltrosDashboardService): Promise<DashboardResponse> {
  const start = Date.now();
  const tickets = await buscarTicketsPeriodo(filtros);

  // Agrupar por filial
  const grupos = agruparTicketsPorFilial(tickets);

  const linhas: DashboardLinha[] = [];

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
    });
  }

  const { inicioUtc, fimUtc } = montarRangeUtcSaoPaulo(filtros.dataInicio, filtros.dataFim);
  const end = Date.now();
  console.log('[DASHBOARD] linhas=', linhas.length, 'timeMs=', end - start);

  return {
    periodo: { inicio: inicioUtc, fim: fimUtc },
    linhas,
  };
}
