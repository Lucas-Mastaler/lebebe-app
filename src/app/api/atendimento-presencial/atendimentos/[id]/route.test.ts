import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PATCH } from './route'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'

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
const atendimentoId = '123e4567-e89b-12d3-a456-426614174003'
const clienteId = '123e4567-e89b-12d3-a456-426614174004'

const atendimentoConcluido = {
  id: atendimentoId,
  cliente_id: clienteId,
  consultora_usuario_id: usuarioId,
  unidade_id: unidadeId,
  status: 'concluido',
  draft_client_id: '123e4567-e89b-12d3-a456-426614174005',
  dados_rascunho: { schema: 'atendimento_presencial_concluido_v1' },
  resultado_atendimento: 'nao',
  motivo_outro: null,
  observacoes: 'Preferencia por móveis claros.\nRetornar após almoço.',
  numero_lancamento: null,
  virada_cartao_dia: 15,
  virada_cartao_mes: 8,
  concluido_em: '2026-07-16T12:00:00.000Z',
  iniciado_em: '2026-07-16T11:00:00.000Z',
  ultima_atividade_em: '2026-07-16T12:00:00.000Z',
  expira_em: '2026-07-21T12:00:00.000Z',
  version: 4,
  criado_por: usuarioId,
  atualizado_por: usuarioId,
  created_at: '2026-07-16T11:00:00.000Z',
  updated_at: '2026-07-16T12:00:00.000Z',
}

function builder(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function mockSupabase(queues: Record<string, unknown[]>, rpcResult?: unknown) {
  const rpc = vi.fn(() => Promise.resolve(rpcResult ?? { data: null, error: null }))
  vi.mocked(createServiceClient).mockReturnValue({
    from: vi.fn((table: string) => {
      const queue = queues[table]
      if (!queue || queue.length === 0) throw new Error(`Sem mock para tabela ${table}`)
      return builder(queue.shift())
    }),
    rpc,
  } as never)
  return { rpc }
}

const payloadEdicaoValido = {
  version: 4,
  clienteId,
  dadosRascunho: {
    criancas: [
      {
        id: 'crianca-local-1',
        situacao: 'ja_nasceu',
        idadeUnidade: 'meses',
        idadeValor: 6,
        nomeNaoInformado: true,
        sexo: 'menina',
      },
    ],
    departamentos: ['moveis'],
    produtosInteresse: ['Berco'],
    resultadoAtendimento: 'nao',
    motivosResultado: ['virada_cartao'],
    viradaCartaoDia: 15,
    viradaCartaoMes: 8,
    observacoes: 'Nova observacao',
  },
  numeroLancamento: null,
}

function filasContextoEPatch(row = atendimentoConcluido) {
  return {
    app_usuarios_perfis: [
      { data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null },
    ],
    app_usuarios_unidades: [
      { data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }], error: null },
    ],
    atendimento_presencial_atendimentos: [
      { data: row, error: null },
    ],
  }
}

describe('api detalhe de registro atendimento presencial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireModuleAccess).mockResolvedValue({
      ok: true,
      user: {} as never,
      email: 'consultora@example.com',
      allowedUser: {
        id: usuarioId,
        email: 'consultora@example.com',
        role: 'user',
        ativo: true,
      },
      acessoTotal: false,
      moduleKey: 'atendimento_presencial_registros',
      origem: 'perfil',
    })
    vi.mocked(checkAccessWindowForUser).mockResolvedValue({
      ok: true,
      permitido: true,
      motivo: 'dentro_da_janela',
      tipoJanelaAtual: 'seg_sex',
      agoraLocal: '16/07/2026 10:00:00 BRT',
      janelaAplicada: null,
    })
  })

  it('retorna cliente vinculada e observacoes finais sem depender de dados_rascunho', async () => {
    mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null },
      ],
      app_usuarios_unidades: [
        { data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }], error: null },
      ],
      atendimento_presencial_atendimentos: [
        { data: atendimentoConcluido, error: null },
      ],
      atendimento_presencial_clientes: [
        {
          data: {
            id: clienteId,
            nome: 'Cliente Histórica',
            telefone_informado: '(41) 99999-1111',
            parentesco: 'mae',
            parentesco_outro: null,
          },
          error: null,
        },
      ],
      atendimento_presencial_criancas: [{ data: [], error: null }],
      atendimento_presencial_departamentos: [{ data: [], error: null }],
      atendimento_presencial_produtos_interesse: [{ data: [], error: null }],
      atendimento_presencial_motivos: [{ data: [], error: null }],
      atendimento_presencial_historico: [{ data: [], error: null }],
    })

    const response = await GET(new Request('http://local'), { params: Promise.resolve({ id: atendimentoId }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.cliente).toMatchObject({
      id: clienteId,
      nome: 'Cliente Histórica',
      telefone: '(41) 99999-1111',
    })
    expect(json.atendimento.observacoes).toBe('Preferencia por móveis claros.\nRetornar após almoço.')
    expect(json.atendimento.dadosRascunho).not.toHaveProperty('observacoes')
  })

  it('edita atendimento concluido via RPC dedicada com versao esperada', async () => {
    const { rpc } = mockSupabase(filasContextoEPatch(), {
      data: [{ id: atendimentoId, version: 5 }],
      error: null,
    })

    const response = await PATCH(new Request('http://local', {
      method: 'PATCH',
      body: JSON.stringify(payloadEdicaoValido),
    }), { params: Promise.resolve({ id: atendimentoId }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({ ok: true, id: atendimentoId, version: 5 })
    expect(rpc).toHaveBeenCalledWith('atendimento_presencial_editar_concluido', {
      p_atendimento_id: atendimentoId,
      p_expected_version: 4,
      p_usuario_id: usuarioId,
      p_dados: expect.objectContaining({
        clienteId,
        resultadoAtendimento: 'nao',
        viradaCartaoDia: 15,
        viradaCartaoMes: 8,
      }),
      p_numero_lancamento: null,
    })
  })

  it('bloqueia edicao quando a versao local esta desatualizada antes da RPC', async () => {
    const { rpc } = mockSupabase(filasContextoEPatch({ ...atendimentoConcluido, version: 5 }))

    const response = await PATCH(new Request('http://local', {
      method: 'PATCH',
      body: JSON.stringify(payloadEdicaoValido),
    }), { params: Promise.resolve({ id: atendimentoId }) })
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('retorna sucesso controlado quando a RPC sinaliza nenhuma_alteracao', async () => {
    mockSupabase(filasContextoEPatch(), {
      data: null,
      error: { code: 'P0001', message: 'nenhuma_alteracao' },
    })

    const response = await PATCH(new Request('http://local', {
      method: 'PATCH',
      body: JSON.stringify(payloadEdicaoValido),
    }), { params: Promise.resolve({ id: atendimentoId }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({ ok: true, semAlteracoes: true })
  })
})
