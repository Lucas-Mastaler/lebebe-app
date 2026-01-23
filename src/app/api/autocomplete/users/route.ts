import { NextRequest, NextResponse } from 'next/server';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q');

        if (!query || query.length < 2) {
            return NextResponse.json([]);
        }

        // Busca com iLike para case-insensitive contains
        // User endpoint Digisac padrão: /users
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
        const url = `/users?query=${encodeURIComponent(jsonFilter)}`;

        const response = await fetchDigisac(url);

        const items = Array.isArray(response) ? response : (response.rows || []);

        // Mapear para formato simples
        const formatted = items.map((u: any) => ({
            id: u.id,
            name: u.name
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('Erro no autocomplete users:', error);
        return NextResponse.json([], { status: 500 }); // Autocomplete falha silenciosamente com array vazio geralmente
    }
}
