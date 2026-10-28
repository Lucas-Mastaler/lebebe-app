import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assumirChamadoAutomacao } from './controle-chamado';
import { fetchDigisac, fetchDigisacRaw } from '@/lib/digisac/clienteDigisac';
import { DEPARTAMENTO_POS_VENDA_AUTO_ATENDIMENTO_ID } from '@/lib/digisac/departamentosFixos';

vi.mock('@/lib/digisac/clienteDigisac', () => ({ fetchDigisac: vi.fn(), fetchDigisacRaw: vi.fn() }));
const ticket = (userId: string | null = null) => ({
  id: 'ticket-1', contactId: 'contato-1', departmentId: DEPARTAMENTO_POS_VENDA_AUTO_ATENDIMENTO_ID,
  userId, isOpen: true, endedAt: null,
});
beforeEach(() => { vi.resetAllMocks(); process.env.DIGISAC_BOT_USER_ID = 'automacao'; });

describe('assumirChamadoAutomacao', () => {
  it('atribui explicitamente ao usuário offline e confirma por GET', async () => {
    vi.mocked(fetchDigisac).mockResolvedValueOnce(ticket()).mockResolvedValueOnce(ticket('automacao'));
    vi.mocked(fetchDigisacRaw).mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await assumirChamadoAutomacao('ticket-1', 'contato-1')).toEqual({ ok: true, ticketId: 'ticket-1', userId: 'automacao' });
    expect(JSON.parse(String(vi.mocked(fetchDigisacRaw).mock.calls[0][1]?.body))).toMatchObject({ userId: 'automacao' });
  });
  it('não disputa chamado de humano', async () => {
    vi.mocked(fetchDigisac).mockResolvedValue(ticket('victor'));
    expect(await assumirChamadoAutomacao('ticket-1', 'contato-1')).toEqual({ ok: false, motivo: 'atribuido_humano' });
    expect(fetchDigisacRaw).not.toHaveBeenCalled();
  });
  it('não repete atribuição já confirmada', async () => {
    vi.mocked(fetchDigisac).mockResolvedValue(ticket('automacao'));
    expect((await assumirChamadoAutomacao('ticket-1', 'contato-1')).ok).toBe(true);
    expect(fetchDigisacRaw).not.toHaveBeenCalled();
  });
  it.each([
    { isOpen: false }, { contactId: 'outro' }, { departmentId: 'outro' }, { endedAt: '2026-10-26' },
  ])('recusa ticket incompatível %j', async patch => {
    vi.mocked(fetchDigisac).mockResolvedValue({ ...ticket(), ...patch });
    expect((await assumirChamadoAutomacao('ticket-1', 'contato-1')).ok).toBe(false);
    expect(fetchDigisacRaw).not.toHaveBeenCalled();
  });
  it('200 sem atribuição efetiva não é sucesso', async () => {
    vi.mocked(fetchDigisac).mockResolvedValue(ticket());
    vi.mocked(fetchDigisacRaw).mockResolvedValue(new Response('{}'));
    expect(await assumirChamadoAutomacao('ticket-1', 'contato-1')).toEqual({ ok: false, motivo: 'atribuicao_nao_confirmada' });
  });
  it('confirma ticket novo devolvido na atribuição', async () => {
    vi.mocked(fetchDigisac).mockResolvedValueOnce(ticket())
      .mockResolvedValueOnce({ ...ticket('automacao'), id: 'ticket-novo' });
    vi.mocked(fetchDigisacRaw).mockResolvedValue(new Response('{"ticketId":"ticket-novo"}'));
    expect(await assumirChamadoAutomacao('ticket-1', 'contato-1')).toMatchObject({ ok: true, ticketId: 'ticket-novo' });
  });
});
