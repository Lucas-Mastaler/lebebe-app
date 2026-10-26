import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INATIVIDADE_CLIENTE_MS, sessaoAguardandoClienteExpirada, ultimaMensagemAindaAguardaCliente } from './inatividade';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';

vi.mock('@/lib/digisac/clienteDigisac', () => ({ fetchDigisac: vi.fn(), fetchDigisacRaw: vi.fn() }));
const agora = Date.parse('2026-10-26T20:00:00Z');
function sessao() {
  return { id: 's1', status: 'ativa', estado: 'pedido_nao_localizado', updated_at: '2026-10-26T18:00:00Z',
    digisac_contact_id: 'c1', digisac_ticket_id: 't1', ultima_mensagem_em: '2026-10-26T18:00:00Z',
    metadata: { aguardando_cliente_desde: '2026-10-26T18:01:00Z', resposta_automatica_enviada: true,
      controle_automacao_user_id: 'bot', aguardando_cliente_message_id: 'm1' } as Record<string, unknown> };
}
beforeEach(() => vi.resetAllMocks());

describe('prazo de inatividade', () => {
  it('vence somente depois de 1h', () => {
    const s = sessao(); const inicio = Date.parse(String(s.metadata.aguardando_cliente_desde));
    expect(sessaoAguardandoClienteExpirada(s, inicio + INATIVIDADE_CLIENTE_MS)).toBe(false);
    expect(sessaoAguardandoClienteExpirada(s, inicio + INATIVIDADE_CLIENTE_MS + 1)).toBe(true);
  });
  it('resposta posterior do cliente cancela o prazo', () => {
    expect(sessaoAguardandoClienteExpirada({ ...sessao(), ultima_mensagem_em: '2026-10-26T19:00:00Z' }, agora)).toBe(false);
  });
  it.each(['pausado_humano', 'bloqueado_24h', 'parado', 'transferido_humano'])('não retoma status %s', status => {
    expect(sessaoAguardandoClienteExpirada({ ...sessao(), status }, agora)).toBe(false);
  });
  it.each(['consultando_datas', 'erro_tecnico_busca_agenda', 'pedido_confirmado', 'reagendamento_confirmado'])('não confunde %s com espera', estado => {
    expect(sessaoAguardandoClienteExpirada({ ...sessao(), estado }, agora)).toBe(false);
  });
  it('não conta envio falho ou sem ID confirmável', () => {
    const s = sessao(); s.metadata.resposta_automatica_enviada = false;
    expect(sessaoAguardandoClienteExpirada(s, agora)).toBe(false);
    s.metadata.resposta_automatica_enviada = true; s.metadata.aguardando_cliente_message_id = null;
    expect(sessaoAguardandoClienteExpirada(s, agora)).toBe(false);
  });
});

describe('última mensagem real do ticket', () => {
  const bot = { id: 'm1', ticketId: 't1', type: 'chat', timestamp: '2026-10-26T18:01:00Z', isFromMe: true };
  it('confirma a pergunta enviada e ignora eventos de ticket', async () => {
    vi.mocked(fetchDigisac).mockResolvedValue({ data: [bot, { ...bot, id: 'evento', type: 'ticket', timestamp: '2026-10-26T18:02:00Z' }] });
    expect(await ultimaMensagemAindaAguardaCliente('t1', 'm1')).toBe(true);
  });
  it.each(['chat', 'image', 'audio', 'document'])('resposta do cliente em %s impede devolução', async type => {
    vi.mocked(fetchDigisac).mockResolvedValue({ data: [bot, { ...bot, id: 'cliente', type, isFromMe: false, timestamp: '2026-10-26T19:01:00Z' }] });
    expect(await ultimaMensagemAindaAguardaCliente('t1', 'm1')).toBe(false);
  });
  it('mensagem posterior de atendente também impede devolução', async () => {
    vi.mocked(fetchDigisac).mockResolvedValue({ data: [bot, { ...bot, id: 'humano', timestamp: '2026-10-26T19:01:00Z' }] });
    expect(await ultimaMensagemAindaAguardaCliente('t1', 'm1')).toBe(false);
  });
  it('histórico incompleto ou de outro ticket não autoriza', async () => {
    vi.mocked(fetchDigisac).mockResolvedValueOnce({ data: [bot], total: 101 })
      .mockResolvedValueOnce({ data: [{ ...bot, ticketId: 'outro' }] });
    expect(await ultimaMensagemAindaAguardaCliente('t1', 'm1')).toBeNull();
    expect(await ultimaMensagemAindaAguardaCliente('t1', 'm1')).toBeNull();
  });
});
