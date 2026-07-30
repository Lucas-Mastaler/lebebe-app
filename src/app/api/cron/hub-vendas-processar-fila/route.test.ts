import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

const processarFilaRecuperacaoHubVendasMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/digisac/hub-vendas/processar-fila', () => ({
  processarFilaRecuperacaoHubVendas: processarFilaRecuperacaoHubVendasMock,
}))

function criarRequest(secret = 'cron-secret', params: Record<string, string | number | undefined> = {}) {
  const url = new URL('http://local/api/cron/hub-vendas-processar-fila')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('/api/cron/hub-vendas-processar-fila', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret'
    processarFilaRecuperacaoHubVendasMock.mockReset()
    processarFilaRecuperacaoHubVendasMock.mockResolvedValue({
      ok: true,
      automacaoAtiva: false,
      pausada: true,
      modoTeste: false,
      modoSimulacao: false,
      totalReservado: 0,
      totalEnviado: 0,
      detalhes: [],
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('bloqueia sem CRON_SECRET configurado', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(criarRequest())

    expect(response.status).toBe(500)
    expect(processarFilaRecuperacaoHubVendasMock).not.toHaveBeenCalled()
  })

  it('bloqueia authorization incorreto', async () => {
    const response = await GET(criarRequest('errado'))

    expect(response.status).toBe(401)
    expect(processarFilaRecuperacaoHubVendasMock).not.toHaveBeenCalled()
  })

  it('executa processamento global com limite maximo 5', async () => {
    const response = await GET(criarRequest('cron-secret', { limite: 100 }))

    expect(response.status).toBe(200)
    expect(processarFilaRecuperacaoHubVendasMock).toHaveBeenCalledWith({
      limite: 5,
      filaId: undefined,
      modoTeste: false,
      modoSimulacao: false,
    })
  })

  it('bloqueia filaId invalido', async () => {
    const response = await GET(criarRequest('cron-secret', { filaId: 'telefone-qualquer', modoTeste: 'true' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'fila_id_invalido' })
    expect(processarFilaRecuperacaoHubVendasMock).not.toHaveBeenCalled()
  })

  it('exige modoTeste para filaId especifica', async () => {
    const response = await GET(criarRequest('cron-secret', { filaId: '2afa6d30-2a17-46fe-b968-3d412bcaf0f3' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'modo_teste_obrigatorio' })
    expect(processarFilaRecuperacaoHubVendasMock).not.toHaveBeenCalled()
  })

  it('executa dry-run isolado de uma fila', async () => {
    const filaId = '2afa6d30-2a17-46fe-b968-3d412bcaf0f3'

    const response = await GET(criarRequest('cron-secret', {
      filaId,
      modoTeste: 'true',
      modoSimulacao: 'true',
      limite: 4,
    }))

    expect(response.status).toBe(200)
    expect(processarFilaRecuperacaoHubVendasMock).toHaveBeenCalledWith({
      limite: 4,
      filaId,
      modoTeste: true,
      modoSimulacao: true,
    })
  })
})
