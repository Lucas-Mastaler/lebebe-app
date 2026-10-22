import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { requireAtendimentoPresencialHistoricoAccess } from './api-auth'
import { NextResponse } from 'next/server'

vi.mock('@/lib/auth/module-access', () => ({ requireModuleAccess: vi.fn() }))
vi.mock('@/lib/auth/access-window', () => ({ checkAccessWindowForUser: vi.fn() }))
const permitido = { ok: true, allowedUser: { id: 'usuario', role: 'user' } }
beforeEach(() => vi.resetAllMocks())
describe('acesso contextual ao histórico', () => {
  it.each(['atendimento_presencial_clientes','atendimento_presencial_registros','atendimento_presencial_ficha'])('aceita somente acesso existente a %s', async modulo => {
    vi.mocked(requireModuleAccess).mockImplementation(async chave => (chave === modulo ? permitido : { ok: false, response: new NextResponse(null, { status: 403 }) }) as never)
    vi.mocked(checkAccessWindowForUser).mockResolvedValue({ ok: true } as never)
    expect((await requireAtendimentoPresencialHistoricoAccess()).ok).toBe(true)
    expect(checkAccessWindowForUser).toHaveBeenCalledWith({ usuarioId: 'usuario', role: 'user' })
  })
  it('sem módulo não chega à janela nem concede acesso', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValue({ ok: false, response: new NextResponse(null, { status: 403 }) } as never)
    const r = await requireAtendimentoPresencialHistoricoAccess()
    expect(r.ok).toBe(false)
    expect(checkAccessWindowForUser).not.toHaveBeenCalled()
  })
  it('fora da janela não tenta contornar por outro módulo', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValue(permitido as never)
    vi.mocked(checkAccessWindowForUser).mockResolvedValue({ ok: false } as never)
    const r = await requireAtendimentoPresencialHistoricoAccess()
    expect(r.ok).toBe(false)
    expect(requireModuleAccess).toHaveBeenCalledTimes(1)
  })
  it('preserva 401 e não repete autenticação sem sessão', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValue({ ok: false, response: new NextResponse(null, { status: 401 }) } as never)
    const r = await requireAtendimentoPresencialHistoricoAccess()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
    expect(requireModuleAccess).toHaveBeenCalledTimes(1)
  })
})
