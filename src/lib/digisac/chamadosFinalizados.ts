import { fetchDigisac } from './clienteDigisac';
import { montarRangeUtcSaoPaulo } from './utilsDatas';
import { formatarTags } from './formatadores';

import { PesquisaChamadosResponse, ChamadoFinalizadoItem } from '@/types';

interface FiltrosChamadosService {
  dataUltimoChamadoFechadoInicio: string;
  dataUltimoChamadoFechadoFim: string;
  departmentIds?: string[];
  userIds?: string[];
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

async function buscarSchedulesDoContato(contactId: string, departmentIds?: string[], userIds?: string[]) {
  const now = Date.now();
  const cached = scheduleCache.get(contactId);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    const filtered = (cached.data || []).filter((s: any) => {
      const depOk = Array.isArray(departmentIds) && departmentIds.length > 0 ? departmentIds.includes(s.departmentId) : true;
      const userOk = Array.isArray(userIds) && userIds.length > 0 ? userIds.includes(s.userId) : true;
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
      const depOk = Array.isArray(departmentIds) && departmentIds.length > 0 ? departmentIds.includes(s.departmentId) : true;
      const userOk = Array.isArray(userIds) && userIds.length > 0 ? userIds.includes(s.userId) : true;
      return depOk && userOk;
    });
    return { data: filtered, cacheHit: false };
  } catch (e) {
    console.error('[DIGISAC][SCHEDULE] erro ao buscar schedules', contactId, e);
    return { data: [], cacheHit: false };
  }
}

// ============================================================================
// Sessão 1: Verificar se contato tem conversa (ticket) aberta
// ============================================================================
async function verificarConversaAberta(contactId: string): Promise<boolean> {
  const params = new URLSearchParams();
  params.append('where[contactId]', contactId);
  params.append('where[isOpen]', 'true');
  params.append('page', '1');
  params.append('perPage', '1');

  const url = `/tickets?${params.toString()}`;
  console.log('[DIGISAC][TICKETS_ABERTOS] consultando contactId=', contactId, 'url=', url);

  try {
    const res = await fetchDigisac(url);
    // Log amostra da resposta para confirmar estrutura
    const amostra = JSON.stringify(res).slice(0, 500);
    console.log('[DIGISAC][TICKETS_ABERTOS] resposta (amostra)=', amostra);

    // Seguindo padrão do código: res pode ser array ou objeto com rows/data
    const tickets = Array.isArray(res) ? res : (res.rows || res.data || []);
    const total = (res && (res.count || res.total)) ?? tickets.length;

    console.log('[DIGISAC][TICKETS_ABERTOS] contactId=', contactId, 'ticketsAbertos=', total);
    return total > 0;
  } catch (e) {
    console.error('[DIGISAC][TICKETS_ABERTOS] erro ao verificar conversa aberta', contactId, e);
    return false;
  }
}

export async function pesquisarChamadosFinalizados(filtros: FiltrosChamadosService): Promise<PesquisaChamadosResponse> {
  const start = Date.now();
  const { inicioUtc, fimUtc } = montarRangeUtcSaoPaulo(
    filtros.dataUltimoChamadoFechadoInicio,
    filtros.dataUltimoChamadoFechadoFim
  );

  console.log('[DIGISAC][TICKETS] filtros recebidos=', {
    departmentIds: Array.isArray(filtros.departmentIds) ? filtros.departmentIds.length : 0,
    userIds: Array.isArray(filtros.userIds) ? filtros.userIds.length : 0,
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

  // Filtros Loja/Consultora no endpoint, se possível: apenas quando há 1 item
  if (Array.isArray(filtros.departmentIds) && filtros.departmentIds.length === 1) params.append('where[departmentId]', filtros.departmentIds[0]);
  if (Array.isArray(filtros.userIds) && filtros.userIds.length === 1) params.append('where[userId]', filtros.userIds[0]);

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
  console.log('[API][CHAMADOS] antesAgregacao.tickets=', tickets.length, 'aposAgregacao.contatosUnicos=', contactIds.length);

  // Buscar contato + schedules por contato (com filtros department/user)
  let contactCacheHits = 0;
  let scheduleCacheHits = 0;
  const items: ChamadoFinalizadoItem[] = [];
  for (const contactId of contactIds) {
    const contatoRes = await buscarContatoComTags(contactId);
    if (contatoRes.cacheHit) contactCacheHits++;

    const schedulesRes = await buscarSchedulesDoContato(contactId, filtros.departmentIds, filtros.userIds);
    if (schedulesRes.cacheHit) scheduleCacheHits++;
    const schedules = schedulesRes.data;

    // Se filtros de loja/consultora foram aplicados e não há schedules compatíveis, pular
    const temFiltroDep = Array.isArray(filtros.departmentIds) && filtros.departmentIds.length > 0;
    const temFiltroUser = Array.isArray(filtros.userIds) && filtros.userIds.length > 0;
    if ((temFiltroDep || temFiltroUser) && schedules.length === 0) continue;

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

    // ============================================================================
    // Sessão 2: Verificar status da conversa (ticket aberto ou fechado)
    // ============================================================================
    const conversaAberta = await verificarConversaAberta(contactId);
    const statusConversa: 'Aberta' | 'Fechado' = conversaAberta ? 'Aberta' : 'Fechado';

    items.push({
      contactId,
      nomeDigisac: contato?.internalName || contato?.name || '',
      loja,
      consultora,
      statusConversa,
      tags: tagsStr || '-',
      qtdAgendamentosTotal: total,
      qtdAgendamentosAbertos: abertos,
      qtdAgendamentosFinalizados: finalizados,
      qtdAgendamentosErro: erro,
    });
  }

  console.log('[DIGISAC][CONTACT] uniqueContactIds=', contactIds.length, 'cacheHit=', contactCacheHits, 'fetched=', contactIds.length - contactCacheHits);
  console.log('[DIGISAC][SCHEDULE] uniqueContactIds=', contactIds.length, 'cacheHit=', scheduleCacheHits, 'fetched=', contactIds.length - scheduleCacheHits);

  // Detectar nomes duplicados por contactId (debug)
  const nomeParaIds = new Map<string, string[]>();
  for (const it of items) {
    const nome = (it.nomeDigisac || '').trim();
    const arr = nomeParaIds.get(nome) || [];
    arr.push(it.contactId);
    nomeParaIds.set(nome, arr);
  }
  const duplicados = Array.from(nomeParaIds.entries()).filter(([nome, ids]) => nome && ids.length > 1);
  if (duplicados.length > 0) {
    console.warn('[API][CHAMADOS] nomesDuplicadosDetectados=', duplicados.map(([nome, ids]) => ({ nome, contactIds: ids })));
  }

  // Padrão: sempre acrescentar sufixo com 4 últimos dígitos do telefone (quando disponível).
  // Fontes: contatoCompleto.data.number (principal) -> sampleTicket.contact.data.number (fallback) -> (sem telefone) usa fallback contactId.
  {
    let ajustados = 0;
    let usandoTelefone = 0;
    let usandoFallbackId = 0;

    const pegarUltimos4 = (val: any): string | null => {
      if (val === undefined || val === null) return null;
      const digits = String(val).replace(/\D/g, '');
      if (digits.length >= 8) return digits.slice(-4);
      return null;
    };

    const removerSufixoUltimos4 = (nome: string): string => {
      // remove apenas o sufixo final no formato " (1234)" para evitar duplicar
      return nome.replace(/\s\(\d{4}\)\s*$/, '').trimEnd();
    };

    for (const it of items) {
      const sampleTicket = byContact.get(it.contactId)?.sample || {};
      const contactEmbed = sampleTicket?.contact || {};
      const contatoCompleto = contactCache.get(it.contactId)?.data || {};

      const rawPrincipal = (contatoCompleto as any)?.data?.number as any;
      const rawFallback = (contactEmbed as any)?.data?.number as any;

      const last4 = pegarUltimos4(rawPrincipal) || pegarUltimos4(rawFallback);

      const nomeBase = removerSufixoUltimos4((it.nomeDigisac || '').trim());
      if (!nomeBase) continue;

      if (last4) {
        it.nomeDigisac = `${nomeBase} (${last4})`;
        usandoTelefone++;
      } else {
        it.nomeDigisac = `${nomeBase} (${it.contactId.slice(0, 6)})`;
        usandoFallbackId++;
      }
      ajustados++;
    }

    console.log('[API][CHAMADOS] sufixoNomeComUltimos4 ajustados=', ajustados, 'comTelefone=', usandoTelefone, 'fallbackContactId=', usandoFallbackId);
  }

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
