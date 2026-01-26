import { fetchDigisac } from './clienteDigisac';
import { montarRangeUtcSaoPaulo } from './utilsDatas';
import { formatarTags } from './formatadores';

import { PesquisaChamadosResponse, ChamadoFinalizadoItem } from '@/types';

interface FiltrosChamadosService {
  dataUltimoChamadoFechadoInicio: string;
  dataUltimoChamadoFechadoFim: string;
  departmentId?: string;
  userId?: string;
  page?: number;
  perPage?: number;
}
// Caches locais para logs de cacheHit
const contactCache = new Map<string, { data: any; timestamp: number }>();
const scheduleCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

async function buscarContatoComTags(contactId: string) {
  const now = Date.now();
  const cached = contactCache.get(contactId);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return { data: cached.data, cacheHit: true };
  }
  // Padrão n8n: query com include tags (sem inventar campos)
  const queryObj = { include: [{ model: 'tags' }] };
  const url = `/contacts/${contactId}?query=${encodeURIComponent(JSON.stringify(queryObj))}`;
  try {
    const res = await fetchDigisac(url);
    contactCache.set(contactId, { data: res, timestamp: now });
    return { data: res, cacheHit: false };
  } catch (e) {
    console.error('[DIGISAC][CONTACT] erro ao buscar contato', contactId, e);
    return { data: {}, cacheHit: false };
  }
}

async function buscarSchedulesDoContato(contactId: string, departmentId?: string, userId?: string) {
  const now = Date.now();
  const cached = scheduleCache.get(contactId);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    const filtered = (cached.data || []).filter((s: any) => {
      const depOk = departmentId ? s.departmentId === departmentId : true;
      const userOk = userId ? s.userId === userId : true;
      return depOk && userOk;
    });
    return { data: filtered, cacheHit: true };
  }
  // Endpoint conforme checklist: include contact/department/user e order por createdAt DESC
  const base = new URLSearchParams();
  base.append('where[contactId]', contactId);
  base.append('include[0][model]', 'contact');
  base.append('include[1][model]', 'department');
  base.append('include[2][model]', 'user');
  base.append('order[0][0]', 'createdAt');
  base.append('order[0][1]', 'DESC');
  base.append('page', '1');
  base.append('perPage', '200');
  const url = `/schedule?${base.toString()}`;
  try {
    const res = await fetchDigisac(url);
    const items = Array.isArray(res) ? res : (res.rows || res.data || []);
    // Cacheia o resultado bruto; o filtro é aplicado a cada chamada
    scheduleCache.set(contactId, { data: items, timestamp: now });
    const filtered = items.filter((s: any) => {
      const depOk = departmentId ? s.departmentId === departmentId : true;
      const userOk = userId ? s.userId === userId : true;
      return depOk && userOk;
    });
    return { data: filtered, cacheHit: false };
  } catch (e) {
    console.error('[DIGISAC][SCHEDULE] erro ao buscar schedules', contactId, e);
    return { data: [], cacheHit: false };
  }
}

export async function pesquisarChamadosFinalizados(filtros: FiltrosChamadosService): Promise<PesquisaChamadosResponse> {
  const start = Date.now();
  const { inicioUtc, fimUtc } = montarRangeUtcSaoPaulo(
    filtros.dataUltimoChamadoFechadoInicio,
    filtros.dataUltimoChamadoFechadoFim
  );

  console.log('[DIGISAC][TICKETS] filtros recebidos=', {
    departmentId: filtros.departmentId,
    userId: filtros.userId,
    page: filtros.page || 1,
    perPage: filtros.perPage || 30,
  });
  console.log('[DIGISAC][TICKETS] rangeUTC=', { inicioUtc, fimUtc });

  const params = new URLSearchParams();
  params.append('where[isOpen]', 'false');
  params.append('where[endedAt][$between][0]', inicioUtc);
  params.append('where[endedAt][$between][1]', fimUtc);
  // Incluir para extrair loja/consultora do ticket mais recente
  params.append('include[0][model]', 'contact');
  params.append('include[1][model]', 'department');
  params.append('include[2][model]', 'user');
  params.append('order[0][0]', 'endedAt');
  params.append('order[0][1]', 'DESC');

  // Filtros Loja/Consultora no endpoint, se possível
  if (filtros.departmentId) params.append('where[departmentId]', filtros.departmentId);
  if (filtros.userId) params.append('where[userId]', filtros.userId);

  // Paginação: não repassar a página da UI para a API do Digisac.
  // Buscamos um lote grande (primeira página) e paginamos localmente após agregar por contato.
  const requestedPage = filtros.page || 1;
  const requestedPerPage = Math.min(filtros.perPage || 30, 100);
  params.append('page', '1');
  params.append('perPage', '200');

  const url = `/tickets?${params.toString()}`;
  console.log('[DIGISAC][TICKETS] urlFinal=', url);
  const res = await fetchDigisac(url);
  const tickets = Array.isArray(res) ? res : (res.rows || res.data || []);
  const totalRet = (res && (res.count || res.total)) ?? tickets.length;
  console.log('[DIGISAC][TICKETS] totalRetornado=', totalRet, 'apiPage=1 uiPage=', requestedPage);

  // Agrupa por contactId e seleciona último fechado
  const byContact = new Map<string, any>();
  for (const t of tickets) {
    const cid = t.contactId;
    if (!cid) continue;
    const endedAt = t.endedAt || t.updatedAt;
    if (!byContact.has(cid)) {
      byContact.set(cid, { lastClosed: endedAt, sample: t });
    }
  }

  const contactIds = Array.from(byContact.keys());

  // Buscar contato + schedules por contato (com filtros department/user)
  let contactCacheHits = 0;
  let scheduleCacheHits = 0;
  const items: ChamadoFinalizadoItem[] = [];
  for (const contactId of contactIds) {
    const contatoRes = await buscarContatoComTags(contactId);
    if (contatoRes.cacheHit) contactCacheHits++;

    const schedulesRes = await buscarSchedulesDoContato(contactId, filtros.departmentId, filtros.userId);
    if (schedulesRes.cacheHit) scheduleCacheHits++;
    const schedules = schedulesRes.data;

    // Se filtros de loja/consultora foram aplicados e não há schedules compatíveis, pular
    if ((filtros.departmentId || filtros.userId) && schedules.length === 0) continue;

    // Contagens por status considerando apenas schedules filtrados
    const total = schedules.length;
    const abertos = schedules.filter((s: any) => s.status === 'scheduled').length;
    const finalizados = schedules.filter((s: any) => s.status === 'done').length;
    const erro = schedules.filter((s: any) => s.status === 'error' || s.status === 'canceled').length;

    // Loja/Consultora: do ticket mais recente fechado (sample)
    const sampleTicket = byContact.get(contactId)?.sample || {};
    const loja = sampleTicket?.department?.name || '';
    const consultora = sampleTicket?.user?.name || '';

    const contato = contatoRes.data || {};
    const tagsStr = formatarTags(contato?.tags || []);

    items.push({
      contactId,
      nomeDigisac: contato?.internalName || contato?.name || '',
      loja,
      consultora,
      tags: tagsStr || '-',
      qtdAgendamentosTotal: total,
      qtdAgendamentosAbertos: abertos,
      qtdAgendamentosFinalizados: finalizados,
      qtdAgendamentosErro: erro,
    });
  }

  console.log('[DIGISAC][CONTACT] uniqueContactIds=', contactIds.length, 'cacheHit=', contactCacheHits, 'fetched=', contactIds.length - contactCacheHits);
  console.log('[DIGISAC][SCHEDULE] uniqueContactIds=', contactIds.length, 'cacheHit=', scheduleCacheHits, 'fetched=', contactIds.length - scheduleCacheHits);

  // Ordena por nomeDigisac ASC para estabilidade
  items.sort((a, b) => (a.nomeDigisac || '').localeCompare(b.nomeDigisac || ''));

  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / requestedPerPage));
  const startIdx = (requestedPage - 1) * requestedPerPage;
  const paged = items.slice(startIdx, startIdx + requestedPerPage);

  const end = Date.now();
  console.log('[API][CHAMADOS] grupos=', total, 'retornando=', paged.length);
  console.log(`[API][CHAMADOS] agregados=${total} page=${requestedPage}/${lastPage} time=${end - start}ms`);

  return {
    items: paged,
    meta: {
      currentPage: requestedPage,
      lastPage,
      total,
      perPage: requestedPerPage,
    },
  };
}
