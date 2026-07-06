import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  isConexaoHabilitada,
  fecharRegistroAutomaticoDigisac,
  type RegistroParaFechar,
} from '@/lib/digisac/finalizacoesAutomaticas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMITE_MAX_IDS = 100;

interface ItemFinalizado {
  id: string;
  digisac_ticket_id: string;
  protocolo: string | null;
  nome_contato: string | null;
  status: string;
}

interface ItemErro {
  id: string;
  digisac_ticket_id: string;
  protocolo: string | null;
  nome_contato: string | null;
  erro: string;
}

interface ItemIgnorado {
  id: string;
  protocolo: string | null;
  motivo: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
    requiredRole: 'superadmin',
  });
  if (!auth.ok) return auth.response;

  console.log('[FECHAR-SELECIONADOS] Inicio.');

  try {
    const body = await request.json().catch(() => null);
    const ids: unknown = body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'ids deve ser um array nao vazio' },
        { status: 400 }
      );
    }

    if (ids.length > LIMITE_MAX_IDS) {
      return NextResponse.json(
        { ok: false, error: `Limite maximo de ${LIMITE_MAX_IDS} registros por execucao` },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Buscar todos os registros de uma vez
    const { data: registros, error: errBusca } = await supabase
      .from('digisac_fechamentos_automaticos')
      .select('id, digisac_ticket_id, digisac_contact_id, service_id, status, protocolo, nome_contato, ticket_history_url')
      .in('id', ids as string[]);

    if (errBusca) {
      console.error('[FECHAR-SELECIONADOS] Erro ao buscar registros:', errBusca.message);
      return NextResponse.json(
        { ok: false, error: 'Erro ao buscar registros' },
        { status: 500 }
      );
    }

    const registrosMap = new Map<string, RegistroParaFechar>();
    for (const r of registros ?? []) {
      registrosMap.set(r.id, r as RegistroParaFechar);
    }

    const finalizados: ItemFinalizado[] = [];
    const erros: ItemErro[] = [];
    const ignorados: ItemIgnorado[] = [];

    // Processar sequencialmente para evitar rate limit no Digisac
    for (const id of ids as string[]) {
      const reg = registrosMap.get(id);

      if (!reg) {
        ignorados.push({ id, protocolo: null, motivo: 'Registro nao encontrado' });
        continue;
      }

      if (reg.status === 'finalizado') {
        ignorados.push({ id: reg.id, protocolo: reg.protocolo, motivo: 'Ja finalizado' });
        continue;
      }

      if (reg.status !== 'pendente' && reg.status !== 'erro') {
        ignorados.push({ id: reg.id, protocolo: reg.protocolo, motivo: `Status ${reg.status} nao permitido` });
        continue;
      }

      if (!(await isConexaoHabilitada(supabase, reg.service_id))) {
        ignorados.push({ id: reg.id, protocolo: reg.protocolo, motivo: 'Conexao nao habilitada para automacao' });
        continue;
      }

      if (!reg.digisac_contact_id || reg.digisac_contact_id.trim() === '') {
        ignorados.push({ id: reg.id, protocolo: reg.protocolo, motivo: 'contactId ausente' });
        continue;
      }

      if (!reg.digisac_ticket_id || reg.digisac_ticket_id.trim() === '') {
        ignorados.push({ id: reg.id, protocolo: reg.protocolo, motivo: 'ticketId ausente' });
        continue;
      }

      const resultado = await fecharRegistroAutomaticoDigisac(reg, supabase);

      if (resultado.ok) {
        finalizados.push({
          id: resultado.id,
          digisac_ticket_id: resultado.digisac_ticket_id,
          protocolo: resultado.protocolo,
          nome_contato: resultado.nome_contato,
          status: 'finalizado',
        });
      } else {
        erros.push({
          id: resultado.id,
          digisac_ticket_id: resultado.digisac_ticket_id,
          protocolo: resultado.protocolo,
          nome_contato: resultado.nome_contato,
          erro: resultado.erro ?? 'Erro desconhecido',
        });
      }
    }

    const totalProcessados = finalizados.length + erros.length;

    console.log(
      '[FECHAR-SELECIONADOS] Fim.' +
      ' totalRecebidos=' + ids.length +
      ' totalProcessados=' + totalProcessados +
      ' totalFinalizados=' + finalizados.length +
      ' totalErros=' + erros.length +
      ' totalIgnorados=' + ignorados.length
    );

    return NextResponse.json({
      ok: true,
      modo: 'fechar-selecionados',
      totalRecebidos: ids.length,
      totalProcessados,
      totalFinalizados: finalizados.length,
      totalErros: erros.length,
      totalIgnorados: ignorados.length,
      finalizados,
      erros,
      ignorados,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[FECHAR-SELECIONADOS] Erro geral:', mensagem);
    return NextResponse.json(
      { ok: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
