import { NextRequest, NextResponse } from 'next/server';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q');

        if (!query || query.length < 2) {
            return NextResponse.json([]);
        }

        const filter = {
            where: {
                name: {
                    $iLike: `%${query}%`
                }
            },
            page: 1,
            perPage: 20
        };

        const jsonFilter = JSON.stringify(filter);
        const url = `/departments?query=${encodeURIComponent(jsonFilter)}`;

        const response = await fetchDigisac(url);
        const items = Array.isArray(response) ? response : (response.rows || []);

        const formatted = items.map((d: any) => ({
            id: d.id,
            name: d.name
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('Erro no autocomplete departments:', error);
        return NextResponse.json([], { status: 500 });
    }
}
