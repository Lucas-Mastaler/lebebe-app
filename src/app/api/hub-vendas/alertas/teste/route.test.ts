import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks
vi.mock('@/lib/auth/module-access', () => ({
  requireModuleAccess: vi.fn(),
}))

vi.mock('@/lib/digisac/hub-vendas/alertas', () => ({
  alertarTesteManual: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({}),
}))

const { requireModuleAccess } = await import('@/lib/auth/module-access')
const { alertarTesteManual } = await import('@/lib/digisac/hub-vendas/alertas')
const { POST } = await import('./route')

function criarAuthResponse(ok: boolean, acessoTotal = false, extra: Record<string, unknown> = {}) {
  if (!ok) {
    return {
      ok: false as const,
      response: new Response(JSON.stringify({ ok: false, message: 'Acesso negado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    }
  }
  return {
    ok: true as const,
    user: { id: 'user-1' },
    email: 'admin@example.com',
    allowedUser: { id: 'user-1', email: 'admin@example.com', role: 'superadmin' },
    acessoTotal,
    moduleKey: 'hub_vendas_gestao',
    origem: 'superadmin' as const,
    ...extra,
  }
}

describe('POST /api/hub-vendas/alertas/teste', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exige autenticação — retorna 403 se não autenticado', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(criarAuthResponse(false))
    const res = await POST()
    expect(res.status).toBe(403)
  })

  it('exige superadmin — retorna 403 se acessoTotal=false', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(criarAuthResponse(true, false))
    const res = await POST()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('apenas_superadmin')
  })

  it('usuário sem permissão recebe 403', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(criarAuthResponse(false))
    const res = await POST()
    expect(res.status).toBe(403)
  })

  it('superadmin autorizado envia alerta de teste com sucesso', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(criarAuthResponse(true, true))
    vi.mocked(alertarTesteManual).mockResolvedValueOnce({ ok: true, deduplicado: false })

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.deduplicado).toBe(false)
    expect(body.enviadoEm).toBeTruthy()
  })

  it('alerta deduplicado retorna ok com deduplicado=true', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(criarAuthResponse(true, true))
    vi.mocked(alertarTesteManual).mockResolvedValueOnce({ ok: true, deduplicado: true })

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.deduplicado).toBe(true)
  })

  it('falha no envio retorna 502', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(criarAuthResponse(true, true))
    vi.mocked(alertarTesteManual).mockResolvedValueOnce({ ok: false, erro: 'erro_digisac' })

    const res = await POST()
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('falha_envio_teste')
  })

  it('exceção interna retorna 500', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(criarAuthResponse(true, true))
    vi.mocked(alertarTesteManual).mockRejectedValueOnce(new Error('boom'))

    const res = await POST()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('erro_interno')
  })

  it('não aceita contactId/serviceId/userId do frontend — rota não lê body', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(criarAuthResponse(true, true))
    vi.mocked(alertarTesteManual).mockResolvedValueOnce({ ok: true, deduplicado: false })

    // A rota POST() não recebe request nem lê body — qualquer payload é ignorado
    const res = await POST()
    expect(res.status).toBe(200)
    // Verifica que alertarTesteManual foi chamado sem parâmetros do frontend
    expect(alertarTesteManual).toHaveBeenCalledWith()
  })

  it('não retorna IDs técnicos na resposta', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(criarAuthResponse(true, true))
    vi.mocked(alertarTesteManual).mockResolvedValueOnce({ ok: true, deduplicado: false })

    const res = await POST()
    const body = await res.json()
    const bodyStr = JSON.stringify(body)
    expect(bodyStr).not.toContain('contactId')
    expect(bodyStr).not.toContain('serviceId')
    expect(bodyStr).not.toContain('userId')
    expect(bodyStr).not.toContain('Bearer')
    expect(bodyStr).not.toContain('token')
  })

  it('usa alertarTesteManual (autoria bot, contato técnico, tipo teste_manual)', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(criarAuthResponse(true, true))
    vi.mocked(alertarTesteManual).mockResolvedValueOnce({ ok: true, deduplicado: false })

    await POST()
    expect(alertarTesteManual).toHaveBeenCalledTimes(1)
    // A função alertarTesteManual internamente usa origin=bot, fromMe=true,
    // userId=DIGISAC_BOT_USER_ID, contactId=HUB_VENDAS_ALERTAS_CONTACT_ID,
    // serviceId=HUB_VENDAS_ALERTAS_SERVICE_ID, tipo='teste_manual'
  })
})
