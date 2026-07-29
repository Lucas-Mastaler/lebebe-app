import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

const prepararFilaRecuperacaoHubVendasMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/digisac/hub-vendas/preparar-fila', () => ({
  prepararFilaRecuperacaoHubVendas: prepararFilaRecuperacaoHubVendasMock,
}))

function criarRequest(secret = 'cron-secret', limite?: number) {
  const url = new URL('http://local/api/cron/hub-vendas-preparar-fila')
  if (limite) url.searchParams.set('limite', String(limite))
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('/api/cron/hub-vendas-preparar-fila', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret'
    prepararFilaRecuperacaoHubVendasMock.mockReset()
    prepararFilaRecuperacaoHubVendasMock.mockResolvedValue({
      ok: true,
      automacaoAtiva: false,
      pausada: true,
      motivo: 'fase_1',
      totalCandidatos: 0,
      totalConvertidosReconciliacao: 0,
      totalClienteEmAtendimento: 0,
      totalFilaCriada: 0,
      totalFilaExistente: 0,
      totalSemCapacidade: 0,
      totalErros: 0,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('bloqueia sem CRON_SECRET configurado', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(criarRequest())

    expect(response.status).toBe(500)
    expect(prepararFilaRecuperacaoHubVendasMock).not.toHaveBeenCalled()
  })

  it('bloqueia authorization incorreto', async () => {
    const response = await GET(criarRequest('errado'))

    expect(response.status).toBe(401)
    expect(prepararFilaRecuperacaoHubVendasMock).not.toHaveBeenCalled()
  })

  it('executa preparacao e limita parametro limite', async () => {
    const response = await GET(criarRequest('cron-secret', 500))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, automacaoAtiva: false, totalFilaCriada: 0 })
    expect(prepararFilaRecuperacaoHubVendasMock).toHaveBeenCalledWith({ limite: 200 })
  })
})
