import { NextRequest, NextResponse } from 'next/server';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';
import { checkRateLimit } from '@/lib/ratelimit';

export async function GET(request: NextRequest) {
    try {
        // Rate Limit Check
        const { success, remaining } = await checkRateLimit(request);

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

        console.log('📥 [API] GET /api/digisac/schedule');
        console.log('   serviceId:', serviceId);
        console.log('   scheduledAt between:', startUtc, '-', endUtc);
        console.log('   page:', page, '| perPage:', perPage);

        if (!serviceId || !startUtc || !endUtc) {
            return NextResponse.json(
                { error: 'Parâmetros obrigatórios faltando: serviceId, scheduledAt[0], scheduledAt[1]' },
                { status: 400 }
            );
        }

        const digisacParams = new URLSearchParams({
            'where[serviceId]': serviceId,
            'where[scheduledAt][$between][0]': startUtc,
            'where[scheduledAt][$between][1]': endUtc,
            'page': page,
            'perPage': perPage,
        });

        const endpoint = `/schedule?${digisacParams.toString()}`;

        const response = await fetchDigisac(endpoint);

        console.log('✅ [API] Agendamentos retornados:', response?.data?.length || 0);

        return NextResponse.json({
            items: response?.data || [],
            meta: {
                page: parseInt(page),
                perPage: parseInt(perPage),
                total: response?.data?.length || 0,
            }
        });

    } catch (error: any) {
        console.error('❌ [API] Erro ao buscar agendamentos:', error.message);

        return NextResponse.json(
            {
                error: 'Erro ao buscar agendamentos do Digisac',
                details: error.message
            },
            { status: 500 }
        );
    }
}
