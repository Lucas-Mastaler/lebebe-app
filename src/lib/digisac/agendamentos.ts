import { fetchDigisac } from './clienteDigisac';
import { montarRangeUtcSaoPaulo } from './utilsDatas';
import { buscarContatosPorIds } from './contatos';
import {
    formatarDataPtBr,
    formatarHoraPtBr,
    formatarTags
} from './formatadores';
import { Agendamento, PesquisaResponse } from '@/types';

interface FiltrosService {
    dataAgendamentoInicio?: string;
    dataAgendamentoFim?: string;
    dataCriacaoInicio?: string;
    dataCriacaoFim?: string;
    departmentId?: string;
    userId?: string;
    status?: string | string[];
    // Novos filtros de Ticket
    conversaAberta?: 'all' | 'yes' | 'no';
    dataUltimoChamadoFechadoInicio?: string;
    dataUltimoChamadoFechadoFim?: string;
    page?: number;
    perPage?: number;
}

// Cache de Contatos (Tags) - 10 min
const contactCache = new Map<string, { data: any, timestamp: number }>();
// Cache de Tickets - 10 min
const ticketCache = new Map<string, { data: any[], timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

async function buscarContatoCompleto(contactId: string): Promise<any> {
    const now = Date.now();
    const cached = contactCache.get(contactId);

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return { ...cached.data, _cacheHit: true };
    }

    // Apenas tags agora, removemos customFieldValues
    const queryObj = {
        "include": [
            { "model": "tags" }
        ]
    };
    const queryString = encodeURIComponent(JSON.stringify(queryObj));
    const url = `/contacts/${contactId}?query=${queryString}`;

    try {
        const res = await fetchDigisac(url);
        // console.log(`[DIGISAC][CONTATO] GET /contacts/${contactId} status=200`);
        contactCache.set(contactId, { data: res, timestamp: now });
        return { ...res, _cacheHit: false };
    } catch (error) {
        console.error(`[DIGISAC][CONTATO] Erro ao buscar contato ${contactId}:`, error);
        return { tags: [], _cacheHit: false };
    }
}

async function buscarTicketsPorContato(contactId: string): Promise<any[]> {
    const now = Date.now();
    const cached = ticketCache.get(contactId);

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return cached.data; // Cache hit
    }

    // Busca tickets do contato
    try {
        // Buscar 50 tickets recentes
        const url = `/tickets?where[contactId]=${contactId}&perPage=50&order[0][0]=updatedAt&order[0][1]=DESC`;
        const res = await fetchDigisac(url);
        const data = Array.isArray(res) ? res : (res.data || []);

        ticketCache.set(contactId, { data: data, timestamp: now });
        return data;
    } catch (error) {
        console.error(`[DIGISAC][TICKETS] Erro ao buscar tickets do contato ${contactId}:`, error);
        return [];
    }
}

// Helper para concorrência
async function buscarDadosEmLote(ids: string[], fn: (id: string) => Promise<any>, limite: number) {
    const resultados = new Map<string, any>();

    for (let i = 0; i < ids.length; i += limite) {
        const chunk = ids.slice(i, i + limite);
        const promises = chunk.map(async (id) => {
            const data = await fn(id);
            resultados.set(id, data);
        });
        await Promise.all(promises);
    }
    return resultados;
}

export async function buscarAgendamentosFormatados(filtros: FiltrosService): Promise<PesquisaResponse> {
    const startTotal = Date.now();

    // 1. Processar datas e Log
    console.log(`[API] filtrosTickets recebidos:`, {
        conversaAberta: filtros.conversaAberta,
        dataUltimoChamadoFechadoInicio: filtros.dataUltimoChamadoFechadoInicio,
        dataUltimoChamadoFechadoFim: filtros.dataUltimoChamadoFechadoFim
    });

    const params = new URLSearchParams();
    let temFiltroValido = false;

    // Filtro Agendamento (scheduledAt)
    if (filtros.dataAgendamentoInicio && filtros.dataAgendamentoFim) {
        const { inicioUtc, fimUtc } = montarRangeUtcSaoPaulo(filtros.dataAgendamentoInicio, filtros.dataAgendamentoFim);
        console.log(`[DIGISAC] Range Agendamento UTC: ${inicioUtc} ate ${fimUtc}`);
        params.append('where[scheduledAt][$between][0]', inicioUtc);
        params.append('where[scheduledAt][$between][1]', fimUtc);
        temFiltroValido = true;
    }

    // Filtro Criação (createdAt)
    if (filtros.dataCriacaoInicio && filtros.dataCriacaoFim) {
        const { inicioUtc, fimUtc } = montarRangeUtcSaoPaulo(filtros.dataCriacaoInicio, filtros.dataCriacaoFim);
        console.log(`[DIGISAC] Range Criação UTC: ${inicioUtc} ate ${fimUtc}`);
        params.append('where[createdAt][$between][0]', inicioUtc);
        params.append('where[createdAt][$between][1]', fimUtc);
        temFiltroValido = true;
    }

    if (!temFiltroValido) {
        throw new Error('Pelo menos um intervalo de datas (Agendamento ou Criação) deve ser fornecido completo.');
    }

    // 2. Outros Includes
    params.append('include[0][model]', 'contact');
    params.append('include[1][model]', 'department');
    params.append('include[2][model]', 'user');

    // Filtros opcionais
    if (filtros.departmentId) params.append('where[departmentId]', filtros.departmentId);
    if (filtros.userId) params.append('where[userId]', filtros.userId);

    // Lógica de Status
    let statusFilterLocal: string[] | null = null;
    if (filtros.status) {
        if (Array.isArray(filtros.status)) {
            if (filtros.status.length > 0) statusFilterLocal = filtros.status;
        } else {
            params.append('where[status]', filtros.status);
        }
    }

    // Paginação da API request (busca inicial)
    const requestedPage = filtros.page || 1;
    const requestedPerPage = Math.min(filtros.perPage || 30, 100);

    params.append('page', String(requestedPage));
    params.append('perPage', String(requestedPerPage));
    params.append('order[0][0]', 'scheduledAt');
    params.append('order[0][1]', 'ASC');

    const url = `/schedule?${params.toString()}`;
    console.log(`[DIGISAC] URL Final: /schedule?${params.toString()}`);

    // 3. Chamada API
    const response = await fetchDigisac(url);
    let itemsRaw = Array.isArray(response) ? response : (response.rows || response.data || []);
    let total = response.count || response.total || itemsRaw.length;
    let lastPage = response.lastPage || 1;

    // 4. Filtragem Local de Status
    if (statusFilterLocal) {
        const antes = itemsRaw.length;
        itemsRaw = itemsRaw.filter((item: any) => statusFilterLocal!.includes(item.status));
        console.log(`[DIGISAC] Filtro status local: ${antes} -> ${itemsRaw.length} itens.`);
    }

    console.log(`[DIGISAC] Schedules retornados (pós-filtro status): ${itemsRaw.length}`);

    // 5. Enriquecimento (Dados do Contato + Tickets)
    const contactIds = Array.from(new Set(itemsRaw.map((i: any) => i.contactId).filter(Boolean)));
    console.log(`[DIGISAC] ContactIds únicos a processar: ${contactIds.length}`);

    // Busca Contatos (Limit 5)
    // Usamos buscarDadosEmLote generico
    const mapContatos = await buscarDadosEmLote(contactIds as string[], buscarContatoCompleto, 5);

    // Busca Tickets (Limit 5)
    // Usamos buscarDadosEmLote generico
    const mapTickets = await buscarDadosEmLote(contactIds as string[], buscarTicketsPorContato, 5);

    // Logs Contato/Tags
    let totalTags = 0;
    mapContatos.forEach((c: any) => { if (c.tags?.length) totalTags++; });
    console.log(`[DIGISAC][CONTATO] tags=${totalTags} contactCacheHit=${contactCache.size > 0}`);

    // Logs Tickets
    console.log(`[DIGISAC][TICKETS] contactIdsUnicos=${contactIds.length} fetched=${contactIds.length}`);

    // Log de Debug Obrigatório para 1 contato
    if (contactIds.length > 0) {
        const sampleId = contactIds[0] as string;
        const tks = mapTickets.get(sampleId);
        const isOpen = tks?.some((t: any) => t.isOpen);
        const lastClosed = tks?.find((t: any) => !t.isOpen && (t.endedAt || t.updatedAt));
        console.log(`[DIGISAC][TICKETS] contactId=${sampleId} isOpen=${isOpen} lastClosed=${lastClosed ? (lastClosed.endedAt || lastClosed.updatedAt) : 'null'}`);
    }

    // 6. Transformação Final + Filtros de Ticket
    let items: Agendamento[] = [];

    // Pré-processamento filtro ticket (range)
    const rangeLastClosed = filtros.dataUltimoChamadoFechadoInicio && filtros.dataUltimoChamadoFechadoFim
        ? montarRangeUtcSaoPaulo(filtros.dataUltimoChamadoFechadoInicio, filtros.dataUltimoChamadoFechadoFim)
        : null;

    console.log(`[API] antesFiltro=${itemsRaw.length}`);

    for (const raw of itemsRaw) {
        const contactDetail = mapContatos.get(raw.contactId) || {};
        const contactBasic = raw.contact || {};
        const contactFinal = { ...contactBasic, ...contactDetail };

        const tickets = mapTickets.get(raw.contactId) || [];

        // Logica Ticket
        const hasOpenTicket = tickets.some((t: any) => t.isOpen);

        // Encontrar ultimo fechado (isOpe=false)
        const closedTickets = tickets.filter((t: any) => !t.isOpen);
        // Ordenar por endedAt desc
        closedTickets.sort((a: any, b: any) => {
            const dA = new Date(a.endedAt || 0).getTime();
            const dB = new Date(b.endedAt || 0).getTime();
            return dB - dA;
        });

        const lastClosedTicket = closedTickets[0];
        // Validar se tem endedAt para considerar fechado valido, conforme instrução do user?
        // "se endedAt for nulo, não conta como fechado válido"
        const ultimoChamadoFechadoIso = (lastClosedTicket && lastClosedTicket.endedAt)
            ? lastClosedTicket.endedAt
            : null;

        // Apply filters Strict Logic

        // 1. Filtro Conversa Aberta
        if (filtros.conversaAberta === 'yes') {
            if (!hasOpenTicket) continue;
        } else if (filtros.conversaAberta === 'no') {
            if (hasOpenTicket) {
                continue; // Não pode ter aberto
            }
            if (!ultimoChamadoFechadoIso) {
                continue; // Deve ter 1 fechado válido com endedAt
            }
        }

        // 2. Filtro Range Ultimo Chamado
        if (rangeLastClosed) {
            if (!ultimoChamadoFechadoIso) continue;
            const tDate = new Date(ultimoChamadoFechadoIso).getTime();
            const tStart = new Date(rangeLastClosed.inicioUtc).getTime();
            const tEnd = new Date(rangeLastClosed.fimUtc).getTime();
            if (tDate < tStart || tDate > tEnd) continue;
        }

        const status = raw.status || 'scheduled';
        let statusLabel = 'Agendado';
        let statusBadgeVariant: 'info' | 'success' | 'destructive' = 'success';

        if (status === 'done') {
            statusLabel = 'Finalizado';
            statusBadgeVariant = 'info';
        } else if (status === 'error' || status === 'canceled') {
            statusLabel = 'Erro/Cancelado';
            statusBadgeVariant = 'destructive';
        }

        items.push({
            id: raw.id,
            accountId: raw.accountId,
            departmentId: raw.departmentId,
            userId: raw.userId,
            contactId: raw.contactId,

            loja: raw.department?.name || '',
            consultora: raw.user?.name || '',
            nomeWhatsapp: contactFinal.name || 'Sem nome',
            nomeDigisac: contactFinal.internalName || '',
            mensagemAgendada: raw.message || raw.data?.message || '',
            comentario: raw.notes || '',

            tags: contactFinal.tags ? (
                contactFinal.tags
                    .map((t: any) => t.name || t.label || t.title || t.tag?.name || '')
                    .filter((s: string) => s && s.trim().length > 0)
                    .join(', ')
            ) : '',

            // Novos Campos
            statusChamado: hasOpenTicket ? 'Aberto' : 'Fechado',
            ultimoChamadoFechado: ultimoChamadoFechadoIso ? `${formatarDataPtBr(ultimoChamadoFechadoIso)} ${formatarHoraPtBr(ultimoChamadoFechadoIso)}` : '',

            // Status & Flags
            statusCode: status,
            statusLabel,
            statusBadgeVariant,

            abrirTicketLabel: raw.openTicket ? 'Sim' : 'Não',
            notificarLabel: raw.notificateUser ? 'Sim' : 'Não',

            // Datas
            agendadoDia: formatarDataPtBr(raw.scheduledAt),
            agendadoHora: formatarHoraPtBr(raw.scheduledAt),
            criadoEm: formatarDataPtBr(raw.createdAt),
            atualizadoEm: formatarDataPtBr(raw.updatedAt),
        } as unknown as Agendamento);
    }

    console.log(`[API] depoisFiltro=${items.length} page=${requestedPage} perPage=${requestedPerPage} total=${total}`);

    const endTotal = Date.now();
    console.log(`[DIGISAC] Tempo total processamento: ${endTotal - startTotal}ms`);

    return {
        items,
        meta: {
            currentPage: Number(requestedPage),
            lastPage: Number(lastPage),
            total: Number(total),
            perPage: Number(requestedPerPage)
        }
    };
}
