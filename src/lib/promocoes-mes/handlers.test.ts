import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireModuleAccess = vi.hoisted(() => vi.fn())
const createServiceClient = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/module-access', () => ({ requireModuleAccess }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient }))

import { atualizar, criar, excluir, listarAdmin, obter, reconciliar, vigentes } from './handlers'

const negado = () => ({ ok: false, response: NextResponse.json({ ok: false, message: 'Acesso negado' }, { status: 403 }) })
const ID = '11111111-1111-4111-8111-111111111111'

describe('permissões da API de promoções', () => {
  beforeEach(() => {
    requireModuleAccess.mockReset()
    createServiceClient.mockReset()
    requireModuleAccess.mockResolvedValue(negado())
  })

  it('bloqueia toda a administração sem o módulo promocoes_mes e nem toca o banco', async () => {
    const req = new Request('http://x', { method: 'POST' })
    const respostas = await Promise.all([listarAdmin(), criar(req), obter(ID), atualizar(req, ID), excluir(ID), reconciliar(true)])
    expect(respostas.map((r) => r.status)).toEqual([403, 403, 403, 403, 403, 403])
    expect(requireModuleAccess.mock.calls.every(([chave]) => chave === 'promocoes_mes')).toBe(true)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('a consulta de vigentes exige acesso à Prancheta (não ao módulo admin)', async () => {
    expect((await vigentes()).status).toBe(403)
    expect(requireModuleAccess).toHaveBeenCalledWith('atendimento_presencial_ficha')
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('id inválido vira 404 sem consultar o banco', async () => {
    requireModuleAccess.mockResolvedValue({ ok: true, email: 'g@x.com' })
    expect((await obter('abc')).status).toBe(404)
    expect((await excluir('abc')).status).toBe(404)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
