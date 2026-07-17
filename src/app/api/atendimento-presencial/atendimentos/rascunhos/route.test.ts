import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { GET, POST } from './route'
import { createServiceClient } from '@/lib/supabase/service'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/auth/module-access', () => ({
  requireModuleAccess: vi.fn(),
}))

vi.mock('@/lib/auth/access-window', () => ({
  checkAccessWindowForUser: vi.fn(),
}))

const usuarioId = '123e4567-e89b-12d3-a456-426614174001'
const unidadeId = '123e4567-e89b-12d3-a456-426614174002'
const draftClientId = '123e4567-e89b-12d3-a456-426614174003'
const rascunhoId = '123e4567-e89b-12d3-a456-426614174004'
const consultoraId = '123e4567-e89b-12d3-a456-426614174005'
const perfilConsultoraId = '123e4567-e89b-12d3-a456-426614174006'

const authOk = {
  ok: true as const,
  user: {} as never,
  email: 'consultora@example.com',
  allowedUser: {
    id: usuarioId,
    email: 'consultora@example.com',
    role: 'user',
    ativo: true,
  },
  acessoTotal: false,
  moduleKey: 'atendimento_presencial_ficha' as const,
  origem: 'perfil' as const,
}

const windowOk = {
  ok: true as const,
  permitido: true as const,
  motivo: 'dentro_da_janela' as const,
  tipoJanelaAtual: 'seg_sex' as const,
  agoraLocal: '15/07/2026 10:00:00 BRT',
  janelaAplicada: null,
}

const rascunhoRow = {
  id: rascunhoId,
  cliente_id: null,
  consultora_usuario_id: usuarioId,
  unidade_id: unidadeId,
  status: 'rascunho',
  draft_client_id: draftClientId,
  dados_rascunho: {},
  iniciado_em: '2026-07-15T12:00:00.000Z',
  ultima_atividade_em: '2026-07-15T12:00:00.000Z',
  expira_em: '2026-07-20T12:00:00.000Z',
  version: 1,
  criado_por: usuarioId,
  atualizado_por: usuarioId,
  created_at: '2026-07-15T12:00:00.000Z',
  updated_at: '2026-07-15T12:00:00.000Z',
}

function builder(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function mockSupabase(queues: Record<string, unknown[]>) {
  const from = vi.fn((table: string) => {
    const queue = queues[table]
    if (!queue || queue.length === 0) {
      throw new Error(`Sem mock para tabela ${table}`)
    }
    return builder(queue.shift())
  })
  vi.mocked(createServiceClient).mockReturnValue({ from } as never)
  return { from }
}

describe('api rascunhos atendimento presencial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireModuleAccess).mockResolvedValue(authOk)
    vi.mocked(checkAccessWindowForUser).mockResolvedValue(windowOk)
  })

  it('bloqueia quando modulo nao autoriza', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ ok: false, message: 'Acesso negado' }, { status: 403 }),
    })

    const response = await GET()
    expect(response.status).toBe(403)
  })

  it('cria rascunho para consultora com uma unidade', async () => {
    mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null },
      ],
      app_usuarios_unidades: [
        {
          data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }],
          error: null,
        },
      ],
      atendimento_presencial_atendimentos: [
        { data: null, error: null },
        { data: rascunhoRow, error: null },
      ],
    })

    const response = await POST(new Request('http://local', {
      method: 'POST',
      body: JSON.stringify({ draftClientId, dadosRascunho: { notaTecnica: 'teste' } }),
    }))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.rascunho.draftClientId).toBe(draftClientId)
  })

  it('retorna rascunho existente para POST repetido', async () => {
    mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null },
      ],
      app_usuarios_unidades: [
        {
          data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }],
          error: null,
        },
      ],
      atendimento_presencial_atendimentos: [
        { data: rascunhoRow, error: null },
      ],
    })

    const response = await POST(new Request('http://local', {
      method: 'POST',
      body: JSON.stringify({ draftClientId, unidadeId }),
    }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.idempotente).toBe(true)
  })

  it('rejeita consultora tentando adulterar responsavel', async () => {
    mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null },
      ],
      app_usuarios_unidades: [
        {
          data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }],
          error: null,
        },
      ],
    })

    const response = await POST(new Request('http://local', {
      method: 'POST',
      body: JSON.stringify({
        draftClientId,
        unidadeId,
        consultoraUsuarioId: '123e4567-e89b-12d3-a456-426614174099',
      }),
    }))

    expect(response.status).toBe(403)
  })

  it('lista consultoras disponiveis com unidades vinculadas no contexto gerencial', async () => {
    mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'gestao', ativo: true } }, error: null },
        { data: [{ usuario_id: consultoraId }], error: null },
      ],
      app_usuarios_unidades: [
        {
          data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }],
          error: null,
        },
        { data: [{ usuario_id: consultoraId, unidade_id: unidadeId }], error: null },
      ],
      atendimento_presencial_atendimentos: [
        { data: [], error: null },
      ],
      app_perfis_acesso: [
        { data: { id: perfilConsultoraId }, error: null },
      ],
      usuarios_permitidos: [
        { data: [{ id: consultoraId, email: 'consultora.loja@example.com' }], error: null },
      ],
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.consultorasDisponiveis).toEqual([
      {
        id: consultoraId,
        email: 'consultora.loja@example.com',
        nome: 'consultora.loja@example.com',
        unidadeIds: [unidadeId],
      },
    ])
  })

  it('enriquece rascunhos com nomes em consultas batch e usa fallbacks', async () => {
    const clienteId = '123e4567-e89b-12d3-a456-426614174007'
    const segundoRascunho = {
      ...rascunhoRow,
      id: '123e4567-e89b-12d3-a456-426614174008',
      cliente_id: clienteId,
      consultora_usuario_id: consultoraId,
    }
    const from = mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null },
      ],
      app_usuarios_unidades: [
        {
          data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }],
          error: null,
        },
      ],
      atendimento_presencial_atendimentos: [
        { data: [rascunhoRow, segundoRascunho], error: null },
      ],
      atendimento_presencial_clientes: [
        { data: [{ id: clienteId, nome: 'Mariana Souza' }], error: null },
      ],
      usuarios_permitidos: [
        { data: [{ id: consultoraId, email: 'consultora@example.com' }], error: null },
      ],
    }).from

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.rascunhos).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: rascunhoId,
        clienteNome: null,
        consultoraNome: null,
      }),
      expect.objectContaining({
        id: segundoRascunho.id,
        clienteNome: 'Mariana Souza',
        consultoraNome: 'consultora@example.com',
      }),
    ]))
    expect(from.mock.calls.filter(([table]) => table === 'atendimento_presencial_clientes')).toHaveLength(1)
    expect(from.mock.calls.filter(([table]) => table === 'usuarios_permitidos')).toHaveLength(1)
  })

  it('rejeita consultora sem vinculo com a unidade informada', async () => {
    mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'gestao', ativo: true } }, error: null },
        { data: { id: 'perfil-vinculo' }, error: null },
      ],
      app_usuarios_unidades: [
        {
          data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }],
          error: null,
        },
        { data: null, error: null },
      ],
      usuarios_permitidos: [
        { data: { id: consultoraId, ativo: true }, error: null },
      ],
      app_perfis_acesso: [
        { data: { id: perfilConsultoraId }, error: null },
      ],
    })

    const response = await POST(new Request('http://local', {
      method: 'POST',
      body: JSON.stringify({
        draftClientId,
        unidadeId,
        consultoraUsuarioId: consultoraId,
        dadosRascunho: { notaTecnica: 'teste' },
      }),
    }))
    const json = await response.json()

    expect(response.status).toBe(422)
    expect(json).toMatchObject({ ok: false, message: 'Consultora nao vinculada a unidade', field: 'consultoraUsuarioId' })
  })
})
