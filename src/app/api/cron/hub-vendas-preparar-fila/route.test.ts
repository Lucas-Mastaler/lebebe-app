import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

const prepararFilaRecuperacaoHubVendasMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/digisac/hub-vendas/preparar-fila', () => ({
  prepararFilaRecuperacaoHubVendas: prepararFilaRecuperacaoHubVendasMock,
}))

function criarRequest(secret = 'cron-secret', params: Record<string, string | number | undefined> = {}) {
  const url = new URL('http://local/api/cron/hub-vendas-preparar-fila')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
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
    const response = await GET(criarRequest('cron-secret', { limite: 500 }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, automacaoAtiva: false, totalFilaCriada: 0 })
    expect(prepararFilaRecuperacaoHubVendasMock).toHaveBeenCalledWith({
      limite: 10,
      leadId: undefined,
      modoTeste: false,
      modoSimulacao: false,
    })
  })

  it('bloqueia leadId invalido', async () => {
    const response = await GET(criarRequest('cron-secret', { leadId: 'telefone-qualquer', modoTeste: 'true' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'lead_id_invalido' })
    expect(prepararFilaRecuperacaoHubVendasMock).not.toHaveBeenCalled()
  })

  it('exige modoTeste para leadId especifico', async () => {
    const response = await GET(criarRequest('cron-secret', { leadId: 'da772a09-dcf0-4476-a81d-86983d7ac624' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'modo_teste_obrigatorio' })
    expect(prepararFilaRecuperacaoHubVendasMock).not.toHaveBeenCalled()
  })

  it('executa modo teste simulado para um unico lead', async () => {
    const leadId = 'da772a09-dcf0-4476-a81d-86983d7ac624'

    const response = await GET(criarRequest('cron-secret', {
      leadId,
      modoTeste: 'true',
      modoSimulacao: 'true',
      limite: 10,
    }))

    expect(response.status).toBe(200)
    expect(prepararFilaRecuperacaoHubVendasMock).toHaveBeenCalledWith({
      limite: 10,
      leadId,
      modoTeste: true,
      modoSimulacao: true,
    })
  })
})
