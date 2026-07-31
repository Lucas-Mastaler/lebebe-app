import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processarWebhookHubVendas } from './processar-webhook'

const registrarEntradaHubVendasMock = vi.hoisted(() => vi.fn())
const registrarConversaoHubVendasMock = vi.hoisted(() => vi.fn())
const createServiceClientMock = vi.hoisted(() => vi.fn())
const reservarEventoHubVendasMock = vi.hoisted(() => vi.fn())
const finalizarEventoHubVendasMock = vi.hoisted(() => vi.fn())
const registrarLogRespostaRecuperacaoHubVendasMock = vi.hoisted(() => vi.fn())

const supabaseFake = {}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: createServiceClientMock,
}))

vi.mock('./eventos', () => ({
  reservarEventoHubVendas: reservarEventoHubVendasMock,
  finalizarEventoHubVendas: finalizarEventoHubVendasMock,
}))

vi.mock('./registrar-entrada', () => ({
  registrarEntradaHubVendas: registrarEntradaHubVendasMock,
}))

vi.mock('./registrar-conversao', () => ({
  registrarConversaoHubVendas: registrarConversaoHubVendasMock,
}))

vi.mock('./resposta', () => ({
  registrarLogRespostaRecuperacaoHubVendas: registrarLogRespostaRecuperacaoHubVendasMock,
}))

const SAUDACAO = `
Seja bem-vindo a Central de Atendimento Le Bebe!
Loja Portao http://wa.me/+554184426528
Loja Bigorrilho http://wa.me/+554188043042
Loja Hauer http://wa.me/+554192220492
`

function payload(overrides: Record<string, unknown>) {
  return {
    event: 'message.created',
    data: {
      id: 'msg-1',
      contactId: 'contact-1',
      serviceId: '4af28025-c210-4336-a560-785d2fb8a778',
      ticketId: 'ticket-1',
      timestamp: '2026-07-24T12:00:00.000Z',
      type: 'chat',
      visible: true,
      isComment: false,
      isFromBot: false,
      ...overrides,
    },
  }
}

describe('processarWebhookHubVendas', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.local'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'
    createServiceClientMock.mockReset()
    createServiceClientMock.mockReturnValue(supabaseFake)
    reservarEventoHubVendasMock.mockReset()
    reservarEventoHubVendasMock.mockResolvedValue({ reservado: true, eventoId: 'evento-1' })
    finalizarEventoHubVendasMock.mockReset()
    finalizarEventoHubVendasMock.mockResolvedValue(undefined)
    registrarEntradaHubVendasMock.mockReset()
    registrarConversaoHubVendasMock.mockReset()
    registrarLogRespostaRecuperacaoHubVendasMock.mockReset()
    registrarEntradaHubVendasMock.mockResolvedValue({ ok: true, processed: true })
    registrarConversaoHubVendasMock.mockResolvedValue({ ok: true, processed: true })
    registrarLogRespostaRecuperacaoHubVendasMock.mockResolvedValue({ encontrada: false })
  })

  it('processa saudacao do Hub enviada pela empresa', async () => {
    const resultado = await processarWebhookHubVendas(
      payload({ isFromMe: true, sent: true, origin: 'user', text: SAUDACAO })
    )

    expect(resultado).toEqual({ ok: true, processed: true, kind: 'entrada_hub' })
    expect(reservarEventoHubVendasMock).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'entrada_hub')
    expect(registrarEntradaHubVendasMock).toHaveBeenCalledWith(
      expect.any(Object),
      supabaseFake,
      { eventoId: 'evento-1' }
    )
  })

  it('reserva e ignora mensagem enviada pelo Hub que nao e saudacao forte', async () => {
    const resultado = await processarWebhookHubVendas(
      payload({ isFromMe: true, sent: true, origin: 'user', text: 'Oi' })
    )

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'nao_e_saudacao' })
    expect(reservarEventoHubVendasMock).toHaveBeenCalledTimes(1)
    expect(finalizarEventoHubVendasMock).toHaveBeenCalledWith(
      supabaseFake,
      'evento-1',
      'ignorado',
      { reason: 'nao_e_saudacao' }
    )
    expect(registrarEntradaHubVendasMock).not.toHaveBeenCalled()
  })

  it('reserva e ignora tipo nao suportado em conexao monitorada', async () => {
    const resultado = await processarWebhookHubVendas(payload({ type: 'image' }))

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'tipo_nao_suportado' })
    expect(reservarEventoHubVendasMock).toHaveBeenCalledTimes(1)
    expect(finalizarEventoHubVendasMock).toHaveBeenCalledWith(
      supabaseFake,
      'evento-1',
      'ignorado',
      { reason: 'tipo_nao_suportado' }
    )
    expect(registrarEntradaHubVendasMock).not.toHaveBeenCalled()
    expect(registrarConversaoHubVendasMock).not.toHaveBeenCalled()
  })

  it('nao reserva evento de conexao fora da allowlist', async () => {
    const resultado = await processarWebhookHubVendas(payload({ serviceId: 'service-fora', text: 'Oi' }))

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'service_id_nao_monitorado' })
    expect(reservarEventoHubVendasMock).not.toHaveBeenCalled()
  })

  it('processa saudacao interativa pelo caminho data.data.interactive.body.text', async () => {
    const resultado = await processarWebhookHubVendas(
      payload({
        type: 'interactive',
        isFromMe: true,
        sent: true,
        origin: 'user',
        text: '',
        data: { interactive: { body: { text: SAUDACAO } } },
      })
    )

    expect(resultado).toEqual({ ok: true, processed: true, kind: 'entrada_hub' })
    expect(registrarEntradaHubVendasMock).toHaveBeenCalledTimes(1)
  })

  it('processa mensagem entrante em loja monitorada como conversao', async () => {
    const resultado = await processarWebhookHubVendas(
      payload({ serviceId: '0973f84b-8294-4615-9657-ba95b6346246', isFromMe: false, text: 'Oi' })
    )

    expect(resultado).toEqual({ ok: true, processed: true, kind: 'conversao_loja' })
    expect(registrarLogRespostaRecuperacaoHubVendasMock).toHaveBeenCalledWith({
      supabase: supabaseFake,
      ticketId: 'ticket-1',
      serviceId: '0973f84b-8294-4615-9657-ba95b6346246',
    })
    expect(registrarConversaoHubVendasMock).toHaveBeenCalledWith(
      expect.any(Object),
      'bigorrilho',
      supabaseFake,
      { eventoId: 'evento-1' }
    )
  })

  it('mantem conversao quando log de resposta de recuperacao falha', async () => {
    registrarLogRespostaRecuperacaoHubVendasMock.mockRejectedValueOnce(new Error('falha leitura fila'))

    const resultado = await processarWebhookHubVendas(
      payload({ serviceId: '0973f84b-8294-4615-9657-ba95b6346246', isFromMe: false, text: 'Oi' })
    )

    expect(resultado).toEqual({ ok: true, processed: true, kind: 'conversao_loja' })
    expect(registrarConversaoHubVendasMock).toHaveBeenCalledTimes(1)
  })

  it('ignora mensagem enviada por nos em loja', async () => {
    const resultado = await processarWebhookHubVendas(
      payload({ serviceId: '0973f84b-8294-4615-9657-ba95b6346246', isFromMe: true, text: 'Mensagem ativa' })
    )

    expect(resultado).toEqual({ ok: true, ignored: true, reason: 'nao_e_conversao' })
    expect(finalizarEventoHubVendasMock).toHaveBeenCalledWith(
      supabaseFake,
      'evento-1',
      'ignorado',
      { reason: 'nao_e_conversao' }
    )
    expect(registrarConversaoHubVendasMock).not.toHaveBeenCalled()
  })
})
