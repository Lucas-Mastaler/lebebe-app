import { NextRequest, NextResponse } from 'next/server';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { checkRateLimit } from '@/lib/ratelimit';

const ALLOWED_SERVICE_IDS = new Set(['4af28025-c210-4336-a560-785d2fb8a778']);
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_PER_PAGE = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRequiredIsoDate(value: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (date.toISOString() !== value) return null;
    return date;
}

function parsePositiveInteger(value: string, fallback: number) {
    if (!/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
    return parsed || fallback;
}

function sanitizeScheduleItem(item: unknown) {
    if (!item || typeof item !== 'object') return null;
    const schedule = item as {
        id?: unknown;
        scheduledAt?: unknown;
        serviceId?: unknown;
    };

    if (typeof schedule.scheduledAt !== 'string') return null;

    return {
        id: typeof schedule.id === 'string' ? schedule.id : '',
        scheduledAt: schedule.scheduledAt,
        serviceId: typeof schedule.serviceId === 'string' ? schedule.serviceId : '',
    };
}

export async function GET(request: NextRequest) {
    try {
        const access = await requireModuleAccess('horarios_agendamentos');
        if (!access.ok) return access.response;

        // Rate Limit Check
        const { success } = await checkRateLimit(request);

        if (!success) {
            console.warn('[API] Rate limit excedido para IP', request.headers.get('x-forwarded-for') || 'unknown');
            return NextResponse.json(
                { error: 'Muitas requisições. Tente novamente em instantes.' },
                { status: 429 }
            );
        }
        const searchParams = request.nextUrl.searchParams;

        const serviceId = searchParams.get('where[serviceId]');
        const startUtc = searchParams.get('where[scheduledAt][$between][0]');
        const endUtc = searchParams.get('where[scheduledAt][$between][1]');
        const page = searchParams.get('page') || '1';
        const perPage = searchParams.get('perPage') || '100';

        if (!serviceId || !startUtc || !endUtc) {
            return NextResponse.json(
                { error: 'Parâmetros obrigatórios faltando: serviceId, scheduledAt[0], scheduledAt[1]' },
                { status: 400 }
            );
        }

        if (!UUID_RE.test(serviceId) || !ALLOWED_SERVICE_IDS.has(serviceId)) {
            return NextResponse.json(
                { error: 'serviceId inválido' },
                { status: 400 }
            );
        }

        const startDate = parseRequiredIsoDate(startUtc);
        const endDate = parseRequiredIsoDate(endUtc);

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: 'Datas inválidas. Use ISO UTC com milissegundos, ex: 2026-06-26T10:00:00.000Z' },
                { status: 400 }
            );
        }

        if (endDate.getTime() <= startDate.getTime()) {
            return NextResponse.json(
                { error: 'Range de datas inválido' },
                { status: 400 }
            );
        }

        if (endDate.getTime() - startDate.getTime() > MAX_RANGE_MS) {
            return NextResponse.json(
                { error: 'Range de datas excede o limite permitido' },
                { status: 400 }
            );
        }

        const parsedPage = parsePositiveInteger(page, 1);
        const parsedPerPage = parsePositiveInteger(perPage, 100);

        if (!parsedPage || !parsedPerPage) {
            return NextResponse.json(
                { error: 'Parâmetros de paginação inválidos' },
                { status: 400 }
            );
        }

        if (parsedPage !== 1) {
            return NextResponse.json(
                { error: 'Página inválida' },
                { status: 400 }
            );
        }

        const safePerPage = Math.min(parsedPerPage, MAX_PER_PAGE);

        console.log('[API] GET /api/digisac/schedule public', {
            rangeHours: Math.round((endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000)),
            page: parsedPage,
            perPage: safePerPage,
        });

        const digisacParams = new URLSearchParams({
            'where[serviceId]': serviceId,
            'where[scheduledAt][$between][0]': startUtc,
            'where[scheduledAt][$between][1]': endUtc,
            'page': String(parsedPage),
            'perPage': String(safePerPage),
        });

        const endpoint = `/schedule?${digisacParams.toString()}`;

        const response = await fetchDigisac(endpoint);
        const rawItems: unknown[] = Array.isArray(response?.data) ? response.data : [];
        const items = rawItems
            .map(sanitizeScheduleItem)
            .filter((item): item is NonNullable<typeof item> => item !== null);

        console.log('[API] Agendamentos publicos retornados:', items.length);

        return NextResponse.json({
            items,
            meta: {
                page: parsedPage,
                perPage: safePerPage,
                total: items.length,
            }
        }, {
            headers: {
                'Cache-Control': 'no-store',
            },
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ [API] Erro ao buscar agendamentos:', errorMessage);

        return NextResponse.json(
            {
                error: 'Erro ao buscar agendamentos do Digisac',
                details: errorMessage
            },
            { status: 500 }
        );
    }
}
