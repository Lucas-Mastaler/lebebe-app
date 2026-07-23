import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'
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

const clienteRow = {
  id: 'cliente-1',
  nome: 'Mariana Souza',
  telefone_informado: '(41) 98414-8660',
  telefone_normalizado: '41984148660',
  telefone_normalizado_ddi: '5541984148660',
  parentesco: 'mae',
  parentesco_outro: null,
  status: 'ativo',
  version: 1,
  created_at: '2026-07-15T10:00:00.000Z',
  updated_at: '2026-07-15T10:00:00.000Z',
}

function makeSelectBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    or: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => result),
    maybeSingle: vi.fn(() => result),
    single: vi.fn(() => result),
  }
  return builder
}

function makeInsertBuilder(result: unknown) {
  const builder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(() => result),
  }
  return builder
}

describe('api atendimento presencial clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAtendimentoPresencialClientesAccess).mockResolvedValue(authOk)
  })

  it('retorna resposta de bloqueio quando o modulo nao autoriza', async () => {
    vi.mocked(requireAtendimentoPresencialClientesAccess).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ ok: false, message: 'Acesso negado' }, { status: 403 }),
    })

    const response = await GET(new Request('http://local/api/atendimento-presencial/clientes?q=ana'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ ok: false, message: 'Acesso negado' })
  })

  it('busca cliente por telefone normalizado', async () => {
    const builder = makeSelectBuilder({ data: [clienteRow], error: null, count: 1 })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => builder) } as never)

    const response = await GET(
      new Request('http://local/api/atendimento-presencial/clientes?telefone=(41)%2098414-8660')
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.clientes[0].telefoneFormatado).toBe('(41) 98414-8660')
    expect(json.clientes[0].correspondenciaExataTelefone).toBe(true)
    expect(builder.or).toHaveBeenCalledWith(
      'telefone_normalizado.ilike.%41984148660%,telefone_normalizado_ddi.ilike.%41984148660%'
    )
  })

  it('busca cliente por trecho de telefone', async () => {
    const builder = makeSelectBuilder({ data: [clienteRow], error: null, count: 1 })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => builder) } as never)

    const response = await GET(
      new Request('http://local/api/atendimento-presencial/clientes?q=8660')
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.clientes[0].id).toBe('cliente-1')
    expect(builder.or).toHaveBeenCalledWith(
      'telefone_normalizado.ilike.%8660%,telefone_normalizado_ddi.ilike.%8660%'
    )
  })

  it('busca cliente por multiplos termos do nome', async () => {
    const builder = makeSelectBuilder({ data: [clienteRow], error: null, count: 1 })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => builder) } as never)

    const response = await GET(
      new Request('http://local/api/atendimento-presencial/clientes?q=Lu%20Ma')
    )

    expect(response.status).toBe(200)
    expect(builder.ilike).toHaveBeenCalledWith('nome', '%Lu%')
    expect(builder.ilike).toHaveBeenCalledWith('nome', '%Ma%')
  })

  it('lista clientes sem termo inicial com limite maximo de 20', async () => {
    const builder = makeSelectBuilder({ data: [clienteRow], error: null, count: 1 })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => builder) } as never)

    const response = await GET(
      new Request('http://local/api/atendimento-presencial/clientes?page=1&pageSize=50')
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.meta.pageSize).toBe(20)
    expect(builder.range).toHaveBeenCalledWith(0, 19)
  })

  it('lista clientes com select base quando colunas de origem ainda nao existem', async () => {
    const builderComOrigem = makeSelectBuilder({
      data: null,
      error: {
        code: '42703',
        message: 'column atendimento_presencial_clientes.origem_consultora_nome does not exist',
      },
      count: null,
    })
    const builderBase = makeSelectBuilder({ data: [clienteRow], error: null, count: 1 })
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn()
        .mockReturnValueOnce(builderComOrigem)
        .mockReturnValueOnce(builderBase),
    } as never)

    const response = await GET(
      new Request('http://local/api/atendimento-presencial/clientes?page=1&pageSize=20')
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.clientes[0].id).toBe('cliente-1')
    expect(json.consultoras).toEqual([])
    expect(builderBase.select).toHaveBeenCalledWith(
      'id, nome, telefone_informado, telefone_normalizado, telefone_normalizado_ddi, parentesco, parentesco_outro, status, version, created_at, updated_at',
      { count: 'exact' }
    )
  })

  it('filtra por consultora de origem', async () => {
    const builder = makeSelectBuilder({ data: [clienteRow], error: null, count: 1 })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => builder) } as never)

    const response = await GET(
      new Request('http://local/api/atendimento-presencial/clientes?consultoraOrigem=Ana%20Clara')
    )

    expect(response.status).toBe(200)
    expect(builder.ilike).toHaveBeenCalledWith('origem_consultora_nome', 'Ana Clara')
  })

  it('escapa curingas em busca por nome', async () => {
    const builder = makeSelectBuilder({ data: [], error: null, count: 0 })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => builder) } as never)

    const response = await GET(
      new Request('http://local/api/atendimento-presencial/clientes?q=Lu%25%20Ma_')
    )

    expect(response.status).toBe(200)
    expect(builder.ilike).toHaveBeenCalledWith('nome', '%Lu\\%%')
    expect(builder.ilike).toHaveBeenCalledWith('nome', '%Ma\\_%')
  })

  it('nao consulta banco quando busca contem somente simbolos', async () => {
    const from = vi.fn()
    vi.mocked(createServiceClient).mockReturnValue({ from } as never)

    const response = await GET(
      new Request('http://local/api/atendimento-presencial/clientes?q=---')
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.clientes).toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it('cria cliente sem telefone', async () => {
    const insertBuilder = makeInsertBuilder({ data: { ...clienteRow, telefone_informado: null, telefone_normalizado: null, telefone_normalizado_ddi: null }, error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => insertBuilder) } as never)

    const response = await POST(
      new Request('http://local/api/atendimento-presencial/clientes', {
        method: 'POST',
        body: JSON.stringify({ nome: 'Mariana Souza', parentesco: 'mae' }),
      })
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.clienteExistente).toBe(false)
  })

  it('retorna cliente existente quando telefone ja esta cadastrado', async () => {
    const selectBuilder = makeSelectBuilder({ data: clienteRow, error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => selectBuilder) } as never)

    const response = await POST(
      new Request('http://local/api/atendimento-presencial/clientes', {
        method: 'POST',
        body: JSON.stringify({ nome: 'Outra Cliente', telefone: '41984148660', parentesco: 'tia' }),
      })
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.clienteExistente).toBe(true)
    expect(json.cliente.id).toBe('cliente-1')
  })

  it('valida parentesco outro com complemento obrigatorio', async () => {
    const response = await POST(
      new Request('http://local/api/atendimento-presencial/clientes', {
        method: 'POST',
        body: JSON.stringify({ nome: 'Mariana Souza', parentesco: 'outro' }),
      })
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      ok: false,
      field: 'parentescoOutro',
    })
  })
})
