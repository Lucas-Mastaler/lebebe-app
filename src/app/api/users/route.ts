import { NextRequest, NextResponse } from 'next/server';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';

export async function GET(request: NextRequest) {
    try {
        console.log('[DIGISAC][USERS] GET /users?perPage=40');
        const response = await fetchDigisac('/users?perPage=40');
        const users = Array.isArray(response) ? response : (response.data || []);

        console.log(`[DIGISAC][USERS] total=${users.length}`);

        return NextResponse.json(users.map((u: any) => ({
            id: u.id,
            name: u.name
        })));
    } catch (error) {
        console.error('[DIGISAC][USERS] Erro ao buscar usuários:', error);
        return NextResponse.json({ error: 'Erro ao buscar usuários do Digisac' }, { status: 500 });
    }
}
