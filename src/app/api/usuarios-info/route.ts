import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

// GET /api/usuarios-info?contactIds=id1,id2,id3
export async function GET(request: NextRequest) {
  try {
    const contactIdsParam = request.nextUrl.searchParams.get('contactIds');
    if (!contactIdsParam) {
      return NextResponse.json({ error: 'contactIds é obrigatório' }, { status: 400 });
    }

    const contactIds = contactIdsParam.split(',').map(id => id.trim()).filter(Boolean);
    if (contactIds.length === 0) {
      return NextResponse.json({ data: {} });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('usuarios_info')
      .select('contact_id, observacao')
      .in('contact_id', contactIds);

    if (error) {
      console.error('[API][USUARIOS_INFO] Erro ao buscar observações:', error);
      return NextResponse.json({ error: 'Erro ao buscar observações' }, { status: 500 });
    }

    // Retorna como mapa { contactId: observacao }
    const map: Record<string, string> = {};
    for (const row of data || []) {
      map[row.contact_id] = row.observacao || '';
    }

    return NextResponse.json({ data: map });
  } catch (error) {
    console.error('[API][USUARIOS_INFO] Erro inesperado GET:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST /api/usuarios-info  body: { contactId, observacao }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, observacao } = body || {};

    if (!contactId || typeof contactId !== 'string') {
      return NextResponse.json({ error: 'contactId é obrigatório' }, { status: 400 });
    }

    if (typeof observacao !== 'string') {
      return NextResponse.json({ error: 'observacao deve ser uma string' }, { status: 400 });
    }

    if (observacao.length > 100) {
      return NextResponse.json({ error: 'observacao deve ter no máximo 100 caracteres' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Upsert: insere se não existe, atualiza se já existe
    const { error } = await supabase
      .from('usuarios_info')
      .upsert(
        { contact_id: contactId, observacao },
        { onConflict: 'contact_id' }
      );

    if (error) {
      console.error('[API][USUARIOS_INFO] Erro ao salvar observação:', error);
      return NextResponse.json({ error: 'Erro ao salvar observação' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API][USUARIOS_INFO] Erro inesperado POST:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
