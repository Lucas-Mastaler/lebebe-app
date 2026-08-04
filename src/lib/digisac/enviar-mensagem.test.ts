import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDigisacRaw } from './clienteDigisac';
import { enviarMensagemDigisac } from './enviar-mensagem';

vi.mock('./clienteDigisac', () => ({ fetchDigisacRaw: vi.fn() }));

describe('enviarMensagemDigisac', () => {
  beforeEach(() => {
    vi.mocked(fetchDigisacRaw).mockReset();
    process.env.DIGISAC_BOT_USER_ID = 'dccc9334-ba37-452d-bee4-acec3eef7789';
  });

  afterEach(() => {
    delete process.env.DIGISAC_BOT_USER_ID;
    vi.restoreAllMocks();
  });

  it('envia o usuario automatico no payload sem alterar ticket ou departamento', async () => {
    vi.mocked(fetchDigisacRaw).mockResolvedValue(new Response(JSON.stringify({ id: 'msg-1' }), { status: 200 }));

    const resultado = await enviarMensagemDigisac({
      contactId: 'contact-1',
      ticketId: 'ticket-1',
      texto: 'mensagem de teste',
    });

    expect(resultado).toEqual({ ok: true, digisac_message_id: 'msg-1' });
    const [, options] = vi.mocked(fetchDigisacRaw).mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body).toMatchObject({
      contactId: 'contact-1',
      ticketId: 'ticket-1',
      userId: 'dccc9334-ba37-452d-bee4-acec3eef7789',
      fromMe: true,
    });
    expect(body).not.toHaveProperty('departmentId');
    expect(Object.keys(body).sort()).toEqual(['contactId', 'fromMe', 'text', 'ticketId', 'type', 'userId']);
  });

  it('bloqueia o envio com erro controlado quando a env está ausente', async () => {
    delete process.env.DIGISAC_BOT_USER_ID;

    await expect(enviarMensagemDigisac({
      contactId: 'contact-1',
      ticketId: 'ticket-1',
      texto: 'mensagem de teste',
    })).resolves.toEqual({ ok: false, erro: 'DIGISAC_BOT_USER_ID_nao_configurado' });
    expect(fetchDigisacRaw).not.toHaveBeenCalled();
  });
});
