import { fetchDigisac } from './clienteDigisac';
import { montarRangeUtcSaoPaulo } from './utilsDatas';
import type { EstatisticasDigisacResponse, ServicoDigisacDashboard } from '@/types';

interface BuscarEstatisticasParams {
  dataInicio: string;
  dataFim: string;
  serviceIds?: string[];
}

interface DigisacByPeriodTotals {
  sentMessagesCount?: number;
  receivedMessagesCount?: number;
  totalMessagesCount?: number;
  openedTicketsCount?: number;
  closedTicketsCount?: number;
  totalTicketsCount?: number;
  waitingTime?: number;
  waitingTimeAfterBot?: number;
  waitingTimeAvg?: number;
  ticketTime?: number;
  contactsCount?: number;
}

interface DigisacByPeriodItem {
  name?: string;
  sentMessagesCount?: number;
  receivedMessagesCount?: number;
  totalMessagesCount?: number;
}

interface DigisacByPeriodResponse {
  totals?: DigisacByPeriodTotals;
  items?: DigisacByPeriodItem[];
}

// Cache em memoria de 5 minutos por combinacao de filtros
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: EstatisticasDigisacResponse; timestamp: number }>();

function montarChaveCache(params: BuscarEstatisticasParams): string {
  return `${params.dataInicio}|${params.dataFim}|${(params.serviceIds ?? []).slice().sort().join(',') || 'all'}`;
}

function normalizarRespostaDigisac(resp: DigisacByPeriodResponse): EstatisticasDigisacResponse {
  const t = resp.totals ?? {};

  const enviadas = Number(t.sentMessagesCount) || 0;
  const recebidas = Number(t.receivedMessagesCount) || 0;

  const relacao = recebidas > 0 ? enviadas / recebidas : null;

  const diario = Array.isArray(resp.items)
    ? resp.items.map((item) => ({
        data: item.name ?? '',
        mensagensEnviadas: Number(item.sentMessagesCount) || 0,
        mensagensRecebidas: Number(item.receivedMessagesCount) || 0,
        totalMensagens: Number(item.totalMessagesCount) || 0,
      }))
    : [];

  return {
    totais: {
      mensagensEnviadas: enviadas,
      mensagensRecebidas: recebidas,
      totalMensagens: Number(t.totalMessagesCount) || 0,
      relacaoEnvioRecebimento: relacao,
      tempoMedioChamadoSegundos: Number(t.ticketTime) || 0,
      mediaPrimeiroTempoEsperaSegundos: Number(t.waitingTime) || 0,
      mediaPrimeiroTempoEsperaAposBotSegundos: Number(t.waitingTimeAfterBot) || 0,
      tempoMedioEsperaSegundos: Number(t.waitingTimeAvg) || 0,
      contatosAtendidos: Number(t.contactsCount) || 0,
      chamadosAbertos: Number(t.openedTicketsCount) || 0,
      chamadosFechados: Number(t.closedTicketsCount) || 0,
      totalChamados: Number(t.totalTicketsCount) || 0,
    },
    diario,
  };
}

export async function buscarEstatisticasDigisac(
  params: BuscarEstatisticasParams
): Promise<EstatisticasDigisacResponse> {
  const { dataInicio, dataFim, serviceIds } = params;

  const chave = montarChaveCache(params);
  const cached = cache.get(chave);
  const agora = Date.now();

  if (cached && agora - cached.timestamp < CACHE_TTL) {
    console.log(`[DIGISAC][ESTATISTICAS] Cache hit para chave=${chave}`);
    return cached.data;
  }

  const serviceIdsList = Array.isArray(serviceIds) && serviceIds.length > 0 ? serviceIds : [undefined];

  const resultados = await Promise.all(
    serviceIdsList.map((sid) => buscarEstatisticasDigisacSingle(dataInicio, dataFim, sid))
  );

  const normalizado = resultados.length === 1
    ? resultados[0]
    : mergeEstatisticas(resultados);

  cache.set(chave, { data: normalizado, timestamp: agora });

  console.log(`[DIGISAC][ESTATISTICAS] Resposta normalizada. diarioItems=${normalizado.diario.length}`);

  return normalizado;
}

async function buscarEstatisticasDigisacSingle(
  dataInicio: string,
  dataFim: string,
  serviceId?: string
): Promise<EstatisticasDigisacResponse> {
  const { inicioUtc, fimUtc } = montarRangeUtcSaoPaulo(dataInicio, dataFim);

  const searchParams = new URLSearchParams();
  searchParams.set('startPeriod', inicioUtc);
  searchParams.set('endPeriod', fimUtc);
  searchParams.set('grouping', '');
  searchParams.set('departmentId', 'all');
  searchParams.set('departmentParticipation', 'last');
  searchParams.set('userId', 'all');
  searchParams.set('periodType', 'openDate');
  searchParams.set('userParticipation', 'last');
  searchParams.set('status', 'all');
  searchParams.set('userStatus', 'all');
  searchParams.set('withTotals', 'true');

  if (serviceId) {
    searchParams.set('serviceId', serviceId);
  }

  const endpoint = `/dashboard/by-period?${searchParams.toString()}`;

  console.log(`[DIGISAC][ESTATISTICAS] Buscando endpoint=${endpoint}`);

  const resp: DigisacByPeriodResponse = await fetchDigisac(endpoint);

  return normalizarRespostaDigisac(resp);
}

function mergeEstatisticas(resultados: EstatisticasDigisacResponse[]): EstatisticasDigisacResponse {
  const totais = resultados.reduce((acc, r) => {
    const t = r.totais;
    return {
      mensagensEnviadas: acc.mensagensEnviadas + (t?.mensagensEnviadas ?? 0),
      mensagensRecebidas: acc.mensagensRecebidas + (t?.mensagensRecebidas ?? 0),
      totalMensagens: acc.totalMensagens + (t?.totalMensagens ?? 0),
      relacaoEnvioRecebimento: null,
      tempoMedioChamadoSegundos: acc.tempoMedioChamadoSegundos + (t?.tempoMedioChamadoSegundos ?? 0),
      mediaPrimeiroTempoEsperaSegundos: acc.mediaPrimeiroTempoEsperaSegundos + (t?.mediaPrimeiroTempoEsperaSegundos ?? 0),
      mediaPrimeiroTempoEsperaAposBotSegundos: acc.mediaPrimeiroTempoEsperaAposBotSegundos + (t?.mediaPrimeiroTempoEsperaAposBotSegundos ?? 0),
      tempoMedioEsperaSegundos: acc.tempoMedioEsperaSegundos + (t?.tempoMedioEsperaSegundos ?? 0),
      contatosAtendidos: acc.contatosAtendidos + (t?.contatosAtendidos ?? 0),
      chamadosAbertos: acc.chamadosAbertos + (t?.chamadosAbertos ?? 0),
      chamadosFechados: acc.chamadosFechados + (t?.chamadosFechados ?? 0),
      totalChamados: acc.totalChamados + (t?.totalChamados ?? 0),
    };
  }, {
    mensagensEnviadas: 0,
    mensagensRecebidas: 0,
    totalMensagens: 0,
    relacaoEnvioRecebimento: null as number | null,
    tempoMedioChamadoSegundos: 0,
    mediaPrimeiroTempoEsperaSegundos: 0,
    mediaPrimeiroTempoEsperaAposBotSegundos: 0,
    tempoMedioEsperaSegundos: 0,
    contatosAtendidos: 0,
    chamadosAbertos: 0,
    chamadosFechados: 0,
    totalChamados: 0,
  });

  totais.relacaoEnvioRecebimento = totais.mensagensRecebidas > 0
    ? totais.mensagensEnviadas / totais.mensagensRecebidas
    : null;

  const diarioMap = new Map<string, { data: string; mensagensEnviadas: number; mensagensRecebidas: number; totalMensagens: number }>();
  for (const r of resultados) {
    for (const item of r.diario) {
      const existing = diarioMap.get(item.data);
      if (existing) {
        existing.mensagensEnviadas += item.mensagensEnviadas;
        existing.mensagensRecebidas += item.mensagensRecebidas;
        existing.totalMensagens += item.totalMensagens;
      } else {
        diarioMap.set(item.data, { ...item });
      }
    }
  }
  const diario = Array.from(diarioMap.values()).sort((a, b) => a.data.localeCompare(b.data));

  return { totais, diario };
}

// --- Servicos/conexoes ---

interface DigisacServiceItem {
  id?: string;
  name?: string;
  type?: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
}

interface DigisacServicesResponse {
  data?: DigisacServiceItem[];
  lastPage?: number;
}

const CACHE_SERVICOS_TTL = 10 * 60 * 1000;
let cacheServicos: { data: ServicoDigisacDashboard[]; timestamp: number } | null = null;

function sanitizarServicos(items: DigisacServiceItem[]): ServicoDigisacDashboard[] {
  return items
    .filter((s) => s.id && s.name && !s.deletedAt)
    .filter((s) => s.type === 'whatsapp')
    .filter((s) => !s.archivedAt)
    .map((s) => ({
      id: s.id!,
      name: s.name!,
      type: s.type!,
      archivedAt: s.archivedAt ?? null,
    }));
}

export async function listarServicosDigisac(): Promise<ServicoDigisacDashboard[]> {
  const agora = Date.now();

  if (cacheServicos && agora - cacheServicos.timestamp < CACHE_SERVICOS_TTL) {
    console.log('[DIGISAC][SERVICOS] Cache hit');
    return cacheServicos.data;
  }

  const query = JSON.stringify({ where: {}, page: 1 });
  const endpoint = `/services?query=${encodeURIComponent(query)}`;

  console.log('[DIGISAC][SERVICOS] Buscando servicos');

  const resp: DigisacServicesResponse = await fetchDigisac(endpoint);

  let todosItems: DigisacServiceItem[] = Array.isArray(resp.data) ? resp.data : [];
  const lastPage = Number(resp.lastPage) || 1;

  if (lastPage > 1) {
    for (let p = 2; p <= lastPage; p++) {
      try {
        const queryPage = JSON.stringify({ where: {}, page: p });
        const endpointPage = `/services?query=${encodeURIComponent(queryPage)}`;
        const respPage: DigisacServicesResponse = await fetchDigisac(endpointPage);
        if (Array.isArray(respPage.data)) {
          todosItems = [...todosItems, ...respPage.data];
        }
      } catch {
        console.error(`[DIGISAC][SERVICOS] Erro ao buscar pagina ${p}, parando paginacao`);
        break;
      }
    }
  }

  const sanitizados = sanitizarServicos(todosItems);

  cacheServicos = { data: sanitizados, timestamp: agora };

  console.log(`[DIGISAC][SERVICOS] Servicos sanitizados: ${sanitizados.length}`);

  return sanitizados;
}
