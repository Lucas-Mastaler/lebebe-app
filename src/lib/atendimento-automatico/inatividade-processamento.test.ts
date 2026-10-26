import { beforeEach, expect, it, vi } from 'vitest';
import { devolverSessoesInativas } from './inatividade';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';
import { consultarControleChamado } from './controle-chamado';
import { transferirAtendimentoPosVenda } from '@/lib/digisac/transferencia-pos-venda';
import { DEPARTAMENTO_POS_VENDA_ID } from '@/lib/digisac/departamentosFixos';

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));
vi.mock('@/lib/digisac/clienteDigisac', () => ({ fetchDigisac: vi.fn() }));
vi.mock('./controle-chamado', () => ({ consultarControleChamado: vi.fn(), estadoAguardaCliente: () => true }));
vi.mock('@/lib/digisac/transferencia-pos-venda', () => ({
  atendimentoAutomaticoEncerrado: () => false, transferirAtendimentoPosVenda: vi.fn(),
}));

let atual: Record<string, unknown>;
let escritas: Record<string, unknown>[];
function banco() {
  return { from() {
    const filtros: Record<string, unknown> = {};
    let patch: Record<string, unknown> | undefined;
    const executar = () => {
      if (!patch) return { data: [structuredClone(atual)], error: null };
      if (Object.entries(filtros).some(([k, v]) => !k.includes('->') && atual[k] !== v)) return { data: null, error: null };
      escritas.push(patch); atual = { ...atual, ...patch };
      return { data: { id: atual.id }, error: null };
    };
    const q = {
      select: () => q, in: () => q, or: () => q, order: () => q, limit: () => q,
      eq: (k: string, v: unknown) => { filtros[k] = v; return q; },
      update: (v: Record<string, unknown>) => { patch = v; return q; },
      single: async () => ({ data: structuredClone(atual), error: null }),
      maybeSingle: async () => executar(),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(executar()).then(resolve),
    };
    return q;
  } };
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.ATENDIMENTO_POSVENDA_AUTO_REPLY_ENABLED = 'true';
  process.env.DIGISAC_BOT_USER_ID = 'bot';
  const passado = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  atual = { id: 's1', status: 'ativa', estado: 'pedido_nao_localizado', updated_at: passado,
    digisac_ticket_id: 't1', digisac_contact_id: 'c1', ultima_mensagem_em: '2020-01-01',
    metadata: { resposta_automatica_enviada: true, aguardando_cliente_desde: passado,
      aguardando_cliente_message_id: 'm1', controle_automacao_user_id: 'bot' } };
  escritas = [];
  vi.mocked(createServiceClient).mockReturnValue(banco() as never);
  vi.mocked(consultarControleChamado).mockResolvedValue({ id: 't1', userId: 'bot', contactId: 'c1',
    isOpen: true, endedAt: null, departmentId: DEPARTAMENTO_POS_VENDA_ID });
  vi.mocked(fetchDigisac).mockResolvedValue({ data: [{ id: 'm1', ticketId: 't1', type: 'chat', isFromMe: true, timestamp: passado }] });
  vi.mocked(transferirAtendimentoPosVenda).mockResolvedValue({ status: 'aceita', motivo: null,
    departmentId: DEPARTAMENTO_POS_VENDA_ID, ticketId: 't1', httpStatus: 200, em: new Date().toISOString() });
});

it('encerra a sessão e devolve sem enviar mensagem ao cliente', async () => {
  expect(await devolverSessoesInativas()).toMatchObject({ devolvidas: 1, erros: 0 });
  expect(atual.estado).toBe('transferido_humano');
  expect(atual.metadata).toMatchObject({ atendimento_automatico_encerrado: true,
    motivo_transferencia_humano: 'inatividade_cliente', devolucao_pos_venda_pendente: false });
  expect(transferirAtendimentoPosVenda).toHaveBeenCalledTimes(1);
});
it('simulação não reserva, altera sessão nem transfere', async () => {
  expect(await devolverSessoesInativas({ simulacao: true })).toMatchObject({ elegiveis: 1, devolvidas: 0 });
  expect(escritas).toHaveLength(0); expect(transferirAtendimentoPosVenda).not.toHaveBeenCalled();
});
it('atendente assumiu: cancela somente a espera, preservando o chamado', async () => {
  vi.mocked(consultarControleChamado).mockResolvedValue({ id: 't1', userId: 'victor', contactId: 'c1', isOpen: true,
    endedAt: null, departmentId: DEPARTAMENTO_POS_VENDA_ID });
  expect(await devolverSessoesInativas()).toMatchObject({ ignoradas: 1, devolvidas: 0 });
  expect(transferirAtendimentoPosVenda).not.toHaveBeenCalled();
});
it('resposta do cliente entre seleção e reserva impede a transferência', async () => {
  vi.mocked(fetchDigisac).mockImplementation(async () => {
    atual.updated_at = new Date().toISOString();
    return { data: [{ id: 'm1', ticketId: 't1', type: 'chat', isFromMe: true, timestamp: '2026-01-01' }] };
  });
  expect(await devolverSessoesInativas()).toMatchObject({ ignoradas: 1, devolvidas: 0 });
  expect(transferirAtendimentoPosVenda).not.toHaveBeenCalled(); expect(escritas).toHaveLength(0);
});
it('histórico indisponível mantém a espera para nova verificação', async () => {
  vi.mocked(fetchDigisac).mockResolvedValue({ data: [], total: 200 });
  expect(await devolverSessoesInativas()).toMatchObject({ erros: 1, devolvidas: 0 });
  expect(escritas).toHaveLength(0); expect(transferirAtendimentoPosVenda).not.toHaveBeenCalled();
});
it('falha de transferência fica pendente e pode recuperar sem mensagem nova', async () => {
  vi.mocked(transferirAtendimentoPosVenda).mockResolvedValueOnce({ status: 'incerta', motivo: 'timeout',
    departmentId: DEPARTAMENTO_POS_VENDA_ID, ticketId: 't1', httpStatus: null, em: new Date().toISOString() });
  expect(await devolverSessoesInativas()).toMatchObject({ erros: 1 });
  expect(atual.metadata).toMatchObject({ devolucao_pos_venda_pendente: true });
  expect(await devolverSessoesInativas()).toMatchObject({ devolvidas: 1 });
  expect(atual.metadata).toMatchObject({ devolucao_pos_venda_pendente: false });
});
