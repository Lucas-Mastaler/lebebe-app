import { NextRequest, NextResponse } from 'next/server';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';
import { formatarDataPtBr, formatarHoraPtBr } from '@/lib/digisac/formatadores';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    if (!contactId) {
      return NextResponse.json({ error: 'Parâmetro contactId é obrigatório' }, { status: 400 });
    }

    const url = `/schedule?where[contactId]=${contactId}&include[0][model]=contact&include[1][model]=department&include[2][model]=user&page=1&perPage=200&order[0][0]=createdAt&order[0][1]=DESC`;
    const res = await fetchDigisac(url);
    const items = Array.isArray(res) ? res : (res.rows || res.data || []);

    const mapped = items.map((s: any) => ({
      id: s.id,
      message: s.message || s.data?.message || '',
      createdAt: s.createdAt ? `${formatarDataPtBr(s.createdAt)} ${formatarHoraPtBr(s.createdAt)}` : '',
      scheduledAt: s.scheduledAt ? `${formatarDataPtBr(s.scheduledAt)} ${formatarHoraPtBr(s.scheduledAt)}` : '',
      notes: s.notes || '',
      status: s.status || 'scheduled',
      statusLabel: ((): string => {
        const st = s.status || 'scheduled';
        if (st === 'error' || st === 'canceled') return 'erro';
        if (st === 'done') return 'finalizado';
        return 'agendado';
      })(),
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('[API][CHAMADOS] Erro ao listar agendamentos por contato:', error);
    return NextResponse.json({ error: 'Erro ao buscar agendamentos' }, { status: 500 });
  }
}
