import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { createServiceClient } from '@/lib/supabase/service'
import { carregarContextoPedidosPersonalizados } from './contexto'
import { executarApiDecorisi, type DependenciasDecorisi } from './decorisi-handlers'

vi.mock('@/lib/auth/api-auth', () => ({ requireAuthenticatedUser: vi.fn() }))
vi.mock('@/lib/auth/module-access', () => ({ requireModuleAccess: vi.fn() }))
vi.mock('@/lib/auth/access-window', () => ({ checkAccessWindowForUser: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

const acesso = {
  ok: true as const, user: {} as never, email: 'teste@example.test',
  allowedUser: { id: '10000000-0000-4000-8000-000000000001', email: 'teste@example.test', role: 'user', ativo: true },
  acessoTotal: false, moduleKey: 'pedidos_personalizados_novo' as const, origem: 'perfil' as const,
}
const deps: DependenciasDecorisi = {
  habilitado: () => true,
  carregarContexto: carregarContextoPedidosPersonalizados,
  criarRepositorio: vi.fn(),
}
const operacoes = ['referencias', 'criar', 'obter', 'atualizar', 'cotar', 'fechar'] as const
const negar = (status: number) => ({ ok: false as const, response: NextResponse.json({ ok: false }, { status }) })
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue(acesso)
  vi.mocked(requireModuleAccess).mockResolvedValue(acesso)
})

describe('Decorisi com contexto real: barreiras anteriores ao service role', () => {
  it.each(operacoes)('%s exige sessão ativa e não cria repositório sem autenticação', async (operacao) => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue(negar(401))
    const response = await executarApiDecorisi(new Request('https://app.test/api'), operacao, undefined, deps)
    expect(response.status).toBe(401)
    expect(requireAuthenticatedUser).toHaveBeenCalledWith({ requireAllowedUser: true, requireActive: true })
    expect(requireModuleAccess).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(deps.criarRepositorio).not.toHaveBeenCalled()
  })
  it.each(operacoes)('%s bloqueia falta de módulo antes do service role', async (operacao) => {
    vi.mocked(requireModuleAccess).mockResolvedValue(negar(403))
    const response = await executarApiDecorisi(new Request('https://app.test/api'), operacao, undefined, deps)
    expect(response.status).toBe(403)
    expect(vi.mocked(requireModuleAccess).mock.calls.map((c) => c[0])).toEqual(operacao === 'criar'
      ? ['pedidos_personalizados_novo'] : ['pedidos_personalizados_gestao', 'pedidos_personalizados_novo'])
    expect(checkAccessWindowForUser).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(deps.criarRepositorio).not.toHaveBeenCalled()
  })
  it.each(operacoes)('%s bloqueia janela encerrada antes do service role', async (operacao) => {
    vi.mocked(checkAccessWindowForUser).mockResolvedValue({ ok: false, permitido: false } as never)
    const response = await executarApiDecorisi(new Request('https://app.test/api'), operacao, undefined, deps)
    expect(response.status).toBe(403)
    expect((await response.json()).erro).toBe('FORA_DA_JANELA')
    expect(checkAccessWindowForUser).toHaveBeenCalledWith({ usuarioId: acesso.allowedUser.id, role: 'user' })
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(deps.criarRepositorio).not.toHaveBeenCalled()
  })
})
