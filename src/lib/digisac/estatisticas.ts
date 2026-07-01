import { fetchDigisac } from './clienteDigisac';
import { montarRangeUtcSaoPaulo } from './utilsDatas';
import type { EstatisticasDigisacResponse } from '@/types';

interface BuscarEstatisticasParams {
  dataInicio: string;
  dataFim: string;
  serviceId?: string;
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
  return `${params.dataInicio}|${params.dataFim}|${params.serviceId ?? 'all'}`;
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
  const { dataInicio, dataFim, serviceId } = params;

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

  const chave = montarChaveCache(params);
  const cached = cache.get(chave);
  const agora = Date.now();

  if (cached && agora - cached.timestamp < CACHE_TTL) {
    console.log(`[DIGISAC][ESTATISTICAS] Cache hit para chave=${chave}`);
    return cached.data;
  }

  console.log(`[DIGISAC][ESTATISTICAS] Buscando endpoint=${endpoint}`);

  const resp: DigisacByPeriodResponse = await fetchDigisac(endpoint);

  const normalizado = normalizarRespostaDigisac(resp);

  cache.set(chave, { data: normalizado, timestamp: agora });

  console.log(`[DIGISAC][ESTATISTICAS] Resposta normalizada. diarioItems=${normalizado.diario.length}`);

  return normalizado;
}
