import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), ficha: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/atendimento-presencial/api-auth', () => ({ requireAtendimentoPresencialHistoricoAccess: mocks.auth }))
vi.mock('@/lib/atendimento-presencial/rascunhos', () => ({ requireAtendimentoPresencialFichaAccess: mocks.ficha, isUuid: (v: string) => /^[0-9a-f-]{36}$/.test(v) }))
vi.mock('@/lib/atendimento-presencial/essenciais', () => ({ ESSENCIAIS_HABILITADOS: true }))
import { GET } from './route'
const cliente = '10000000-0000-4000-8000-000000000001'
const usuario = '10000000-0000-4000-8000-000000000002'
const rascunho = '10000000-0000-4000-8000-000000000003'
const executar = (query = '', id = cliente) => GET(new Request(`http://localhost/api/clientes/${id}/essenciais${query}`), { params: Promise.resolve({ id }) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ ok: true, allowedUser: { id: usuario } })
  mocks.ficha.mockResolvedValue({ ok: true, allowedUser: { id: usuario } })
  mocks.rpc.mockResolvedValue({ data: { respostas: {} }, error: null })
})
describe('leitura protegida de essenciais', () => {
  it('não consulta o banco sem autenticação/módulo', async () => {
    mocks.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) })
    expect((await executar()).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('vincula o estado atual ao rascunho e executor autenticado', async () => {
    expect((await executar(`?rascunhoId=${rascunho}`)).status).toBe(200)
    expect(mocks.ficha).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith('atendimento_presencial_ler_essenciais', { p_cliente: cliente, p_executor: usuario, p_rascunho: rascunho })
  })
  it('pagina o histórico mínimo compartilhado, sem liberar detalhe de atendimento', async () => {
    await executar('?pagina=2')
    expect(mocks.rpc).toHaveBeenCalledWith('atendimento_presencial_historico_essenciais', { p_cliente: cliente, p_executor: usuario, p_pagina: 2 })
  })
  it.each(['?pagina=-1', '?pagina=1.2', '?pagina=10001', '?rascunhoId=invalido'])('rejeita parâmetros inválidos %s', async query => {
    expect((await executar(query)).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('não transforma falha no banco em ausência de respostas', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
    expect((await executar()).status).toBe(503)
  })
  it('respeita a negativa de autorização do banco e evita cache compartilhado', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    expect((await executar()).status).toBe(403)
    expect((await executar()).headers.get('cache-control')).toBe('private, no-store')
  })
})
