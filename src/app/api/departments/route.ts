import { NextRequest, NextResponse } from 'next/server';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';

export async function GET(request: NextRequest) {
    try {
        // Listar todos departamentos.
        // Se houver muitos, o Digisac pagina. Vamos pegar a primeira pagina generosa.
        const url = `/departments?perPage=100`;

        const response = await fetchDigisac(url);
        const items = Array.isArray(response) ? response : (response.rows || []);

        const formatted = items.map((d: any) => ({
            id: d.id,
            name: d.name
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('Erro ao listar departamentos:', error);
        return NextResponse.json({ error: 'Erro ao buscar departamentos' }, { status: 500 });
    }
}
