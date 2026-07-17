import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PATCH } from './route'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAtendimentoPresencialClientesAccess } from '@/lib/atendimento-presencial/api-auth'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/atendimento-presencial/api-auth', () => ({
  requireAtendimentoPresencialClientesAccess: vi.fn(),
}))

const authOk = {
  ok: true as const,
  user: {} as never,
  email: 'user@example.com',
  allowedUser: {
    id: 'usuario-1',
    email: 'user@example.com',
    role: 'user',
    ativo: true,
  },
  acessoTotal: false,
  moduleKey: 'atendimento_presencial_clientes' as const,
  origem: 'perfil' as const,
  windowAccess: {
    ok: true as const,
    permitido: true as const,
    motivo: 'dentro_da_janela' as const,
    tipoJanelaAtual: 'seg_sex' as const,
    agoraLocal: '15/07/2026 10:00:00 BRT',
    janelaAplicada: null,
  },
}

function makeBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    update: vi.fn(() => builder),
    maybeSingle: vi.fn(() => result),
  }
  return builder
}

describe('api atendimento presencial clientes por id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAtendimentoPresencialClientesAccess).mockResolvedValue(authOk)
  })

  it('bloqueia quando o modulo nao autoriza', async () => {
    vi.mocked(requireAtendimentoPresencialClientesAccess).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ ok: false, message: 'Acesso negado' }, { status: 403 }),
    })

    const response = await GET(new Request('http://local'), { params: Promise.resolve({ id: 'cliente-1' }) })

    expect(response.status).toBe(403)
  })

  it('retorna cliente existente por id', async () => {
    const builder = makeBuilder({
      data: {
        id: 'cliente-1',
        nome: 'Mariana Souza',
        telefone_informado: null,
        telefone_normalizado: null,
        telefone_normalizado_ddi: null,
        parentesco: 'mae',
        parentesco_outro: null,
        status: 'ativo',
        version: 1,
        created_at: '2026-07-15T10:00:00.000Z',
        updated_at: '2026-07-15T10:00:00.000Z',
      },
      error: null,
    })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => builder) } as never)

    const response = await GET(new Request('http://local'), { params: Promise.resolve({ id: 'cliente-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.cliente.id).toBe('cliente-1')
  })

  it('retorna 404 para id inexistente', async () => {
    const builder = makeBuilder({ data: null, error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => builder) } as never)

    const response = await GET(new Request('http://local'), { params: Promise.resolve({ id: 'cliente-x' }) })

    expect(response.status).toBe(404)
  })

  it('atualiza telefone e reflete a versao retornada', async () => {
    const atualizado = {
      id: 'cliente-1',
      nome: 'Mariana Souza',
      telefone_informado: '(41) 99999-9999',
      telefone_normalizado: '41999999999',
      telefone_normalizado_ddi: '5541999999999',
      parentesco: 'mae',
      parentesco_outro: null,
      status: 'ativo',
      version: 2,
      created_at: '2026-07-15T10:00:00.000Z',
      updated_at: '2026-07-15T10:01:00.000Z',
    }
    const duplicateBuilder = makeBuilder({ data: null, error: null })
    const updateBuilder = makeBuilder({ data: atualizado, error: null })
    const from = vi.fn()
      .mockReturnValueOnce(duplicateBuilder)
      .mockReturnValueOnce(updateBuilder)
    vi.mocked(createServiceClient).mockReturnValue({ from } as never)

    const response = await PATCH(
      new Request('http://local', {
        method: 'PATCH',
        body: JSON.stringify({ telefone: '(41) 99999-9999', version: 1 }),
      }),
      { params: Promise.resolve({ id: 'cliente-1' }) }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.cliente.version).toBe(2)
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      telefone_normalizado: '41999999999',
      telefone_normalizado_ddi: '5541999999999',
    }))
  })

  it('permite limpar o telefone', async () => {
    const atualizado = {
      id: 'cliente-1',
      nome: 'Mariana Souza',
      telefone_informado: null,
      telefone_normalizado: null,
      telefone_normalizado_ddi: null,
      parentesco: 'mae',
      parentesco_outro: null,
      status: 'ativo',
      version: 2,
      created_at: '2026-07-15T10:00:00.000Z',
      updated_at: '2026-07-15T10:01:00.000Z',
    }
    const updateBuilder = makeBuilder({ data: atualizado, error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => updateBuilder) } as never)

    const response = await PATCH(
      new Request('http://local', {
        method: 'PATCH',
        body: JSON.stringify({ telefone: null, version: 1 }),
      }),
      { params: Promise.resolve({ id: 'cliente-1' }) }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.cliente.telefone).toBeNull()
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      telefone_informado: null,
      telefone_normalizado: null,
      telefone_normalizado_ddi: null,
    }))
  })

  it('rejeita telefone duplicado em outra cliente', async () => {
    const duplicateBuilder = makeBuilder({ data: { id: 'cliente-2' }, error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => duplicateBuilder) } as never)

    const response = await PATCH(
      new Request('http://local', {
        method: 'PATCH',
        body: JSON.stringify({ telefone: '(41) 99999-9999', version: 1 }),
      }),
      { params: Promise.resolve({ id: 'cliente-1' }) }
    )
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.message).toBe('Telefone ja cadastrado em outra cliente')
  })

  it('retorna conflito quando a versao nao corresponde', async () => {
    const duplicateBuilder = makeBuilder({ data: null, error: null })
    const updateBuilder = makeBuilder({ data: null, error: null })
    const currentBuilder = makeBuilder({
      data: {
        id: 'cliente-1',
        nome: 'Mariana Souza',
        telefone_informado: null,
        telefone_normalizado: null,
        telefone_normalizado_ddi: null,
        parentesco: 'mae',
        parentesco_outro: null,
        status: 'ativo',
        version: 3,
        created_at: '2026-07-15T10:00:00.000Z',
        updated_at: '2026-07-15T10:02:00.000Z',
      },
      error: null,
    })
    const from = vi.fn()
      .mockReturnValueOnce(duplicateBuilder)
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(currentBuilder)
    vi.mocked(createServiceClient).mockReturnValue({ from } as never)

    const response = await PATCH(
      new Request('http://local', {
        method: 'PATCH',
        body: JSON.stringify({ telefone: '(41) 99999-9999', version: 1 }),
      }),
      { params: Promise.resolve({ id: 'cliente-1' }) }
    )
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.cliente.version).toBe(3)
  })

  it('rejeita telefone invalido', async () => {
    const response = await PATCH(
      new Request('http://local', {
        method: 'PATCH',
        body: JSON.stringify({ telefone: '123', version: 1 }),
      }),
      { params: Promise.resolve({ id: 'cliente-1' }) }
    )

    expect(response.status).toBe(422)
    expect((await response.json()).field).toBe('telefone')
  })
})
