import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

const obterStatusHubVendasMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/digisac/hub-vendas/status', () => ({
  obterStatusHubVendas: obterStatusHubVendasMock,
}))

function criarRequest(secret = 'cron-secret') {
  return new NextRequest('http://local/api/cron/hub-vendas-status', {
    method: 'GET',
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('/api/cron/hub-vendas-status', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret'
    obterStatusHubVendasMock.mockReset()
    obterStatusHubVendasMock.mockResolvedValue({
      ok: true,
      automacao: { ativa: false, pausada: true, motivo: 'fase' },
      filas: { agendada: 0, reservada: 0, enviando: 0, enviadaHoje: 0, resultadoIncerto: 0, analiseManual: 0 },
      conexoes: { pausadas: 0, errosConsecutivos: {} },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('bloqueia sem CRON_SECRET configurado', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(criarRequest())

    expect(response.status).toBe(500)
    expect(obterStatusHubVendasMock).not.toHaveBeenCalled()
  })

  it('bloqueia authorization incorreto', async () => {
    const response = await GET(criarRequest('errado'))

    expect(response.status).toBe(401)
    expect(obterStatusHubVendasMock).not.toHaveBeenCalled()
  })

  it('retorna status sem dados pessoais', async () => {
    const response = await GET(criarRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      automacao: { ativa: false, pausada: true },
      conexoes: { pausadas: 0 },
    })
  })
})
