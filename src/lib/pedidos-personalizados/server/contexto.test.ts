import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'
import { carregarContextoPedidosPersonalizados } from './contexto'

vi.mock('@/lib/auth/module-access', () => ({ requireModuleAccess: vi.fn() }))
vi.mock('@/lib/auth/api-auth', () => ({ requireAuthenticatedUser: vi.fn() }))
vi.mock('@/lib/auth/access-window', () => ({ checkAccessWindowForUser: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

const USUARIO_ID = '10000000-0000-4000-8000-000000000001'

function resposta(status: number) {
  return NextResponse.json({ ok: false }, { status })
}

function acesso(role = 'user') {
  return {
    ok: true as const,
    user: {} as never,
    email: 'tecnico@example.com',
    allowedUser: { id: USUARIO_ID, email: 'tecnico@example.com', role, ativo: true },
    acessoTotal: role === 'superadmin',
    moduleKey: 'pedidos_personalizados_novo' as const,
    origem: role === 'superadmin' ? 'superadmin' as const : 'perfil' as const,
  }
}

function builder(resultado: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(resultado)),
  }
  return chain
}

describe('contexto e escopo de pedidos personalizados', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: true,
      user: {} as never,
      email: 'tecnico@example.com',
      allowedUser: { id: USUARIO_ID, email: 'tecnico@example.com', role: 'user', ativo: true },
    })
    vi.mocked(checkAccessWindowForUser).mockResolvedValue({
      ok: true,
      permitido: true,
      motivo: 'dentro_da_janela',
      tipoJanelaAtual: 'seg_sex',
      agoraLocal: 'agora',
      janelaAplicada: null,
    })
  })

  it('preserva 401 sem testar o segundo módulo', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: false, response: resposta(401) })
    const resultado = await carregarContextoPedidosPersonalizados(['pedidos_personalizados_novo', 'pedidos_personalizados_gestao'])
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.response.status).toBe(401)
    expect(requireModuleAccess).not.toHaveBeenCalled()
  })

  it('preserva 403 para usuário permitido inativo', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: false, response: resposta(403) })
    const resultado = await carregarContextoPedidosPersonalizados(['pedidos_personalizados_novo'])
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.response.status).toBe(403)
    expect(requireModuleAccess).not.toHaveBeenCalled()
  })

  it('nega usuário sem nenhum dos dois módulos', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValue({ ok: false, response: resposta(403) })
    const resultado = await carregarContextoPedidosPersonalizados(['pedidos_personalizados_novo', 'pedidos_personalizados_gestao'])
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.response.status).toBe(403)
    expect(requireModuleAccess).toHaveBeenCalledTimes(2)
  })

  it('aceita usuário com apenas o módulo novo', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce(acesso())
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => builder({ data: [], error: null })),
    } as never)
    const resultado = await carregarContextoPedidosPersonalizados(['pedidos_personalizados_novo', 'pedidos_personalizados_gestao'])
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.contexto.moduloAutorizado).toBe('pedidos_personalizados_novo')
    expect(requireModuleAccess).toHaveBeenCalledTimes(1)
  })

  it('aceita usuário com apenas o módulo de gestão', async () => {
    vi.mocked(requireModuleAccess)
      .mockResolvedValueOnce({ ok: false, response: resposta(403) })
      .mockResolvedValueOnce({ ...acesso(), moduleKey: 'pedidos_personalizados_gestao' })
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => builder({ data: [], error: null })),
    } as never)
    const resultado = await carregarContextoPedidosPersonalizados(['pedidos_personalizados_novo', 'pedidos_personalizados_gestao'])
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.contexto.moduloAutorizado).toBe('pedidos_personalizados_gestao')
    expect(requireModuleAccess).toHaveBeenNthCalledWith(2, 'pedidos_personalizados_gestao')
  })

  it('filtra pos_venda e mantém uma ou várias unidades do usuário', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValue(acesso())
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => builder({
        data: [
          { app_unidades: { id: '1', chave: 'bigorrilho', nome: 'BIGORRILHO', ativo: true } },
          { app_unidades: { id: '2', chave: 'portao', nome: 'PORTAO', ativo: true } },
          { app_unidades: { id: '3', chave: 'pos_venda', nome: 'POS VENDA', ativo: true } },
          { app_unidades: { id: '4', chave: 'feira', nome: 'FEIRA', ativo: false } },
        ],
        error: null,
      })),
    } as never)
    const resultado = await carregarContextoPedidosPersonalizados(['pedidos_personalizados_novo'])
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.contexto.unidades.map((unidade) => unidade.chave)).toEqual(['bigorrilho', 'portao'])
      expect(resultado.contexto.unidades[1].nomeExibicao).toBe('PORTÃO')
    }
  })

  it('superadmin recebe somente as quatro unidades do módulo', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValue(acesso('superadmin'))
    const from = vi.fn(() => builder({
      data: [
        { id: '1', chave: 'bigorrilho', nome: 'BIGORRILHO', ativo: true },
        { id: '2', chave: 'portao', nome: 'PORTAO', ativo: true },
        { id: '3', chave: 'marechal', nome: 'MARECHAL', ativo: true },
        { id: '4', chave: 'feira', nome: 'FEIRA', ativo: true },
      ],
      error: null,
    }))
    vi.mocked(createServiceClient).mockReturnValue({ from } as never)
    const resultado = await carregarContextoPedidosPersonalizados(['pedidos_personalizados_gestao'])
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.contexto.unidades).toHaveLength(4)
    expect(from).toHaveBeenCalledWith('app_unidades')
  })

  it('bloqueia fora da janela e não cria service role', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValue(acesso())
    vi.mocked(checkAccessWindowForUser).mockResolvedValue({
      ok: false,
      permitido: false,
      motivo: 'fora_da_janela',
      tipoJanelaAtual: 'seg_sex',
      agoraLocal: 'agora',
      janelaAplicada: null,
    })
    const resultado = await carregarContextoPedidosPersonalizados(['pedidos_personalizados_novo'])
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.response.status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
