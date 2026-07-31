import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

const recuperarFilasAbandonadasHubVendasMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/digisac/hub-vendas/manutencao', () => ({
  recuperarFilasAbandonadasHubVendas: recuperarFilasAbandonadasHubVendasMock,
}))

function criarRequest(secret = 'cron-secret', params: Record<string, string | number | undefined> = {}) {
  const url = new URL('http://local/api/cron/hub-vendas-recuperar-filas')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('/api/cron/hub-vendas-recuperar-filas', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret'
    recuperarFilasAbandonadasHubVendasMock.mockReset()
    recuperarFilasAbandonadasHubVendasMock.mockResolvedValue({
      ok: true,
      modoSimulacao: false,
      totalAnalisado: 0,
      totalReservasLiberadas: 0,
      totalResultadoIncerto: 0,
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
    expect(recuperarFilasAbandonadasHubVendasMock).not.toHaveBeenCalled()
  })

  it('bloqueia authorization incorreto', async () => {
    const response = await GET(criarRequest('errado'))

    expect(response.status).toBe(401)
    expect(recuperarFilasAbandonadasHubVendasMock).not.toHaveBeenCalled()
  })

  it('executa recuperacao com dry-run e limite maximo seguro', async () => {
    const response = await GET(criarRequest('cron-secret', { modoSimulacao: 'true', limite: 500 }))

    expect(response.status).toBe(200)
    expect(recuperarFilasAbandonadasHubVendasMock).toHaveBeenCalledWith({
      limite: 50,
      modoSimulacao: true,
    })
  })
})
