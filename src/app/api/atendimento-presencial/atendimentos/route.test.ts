import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
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

function builder(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function mockSupabase(queues: Record<string, unknown[]>) {
  vi.mocked(createServiceClient).mockReturnValue({
    from: vi.fn((table: string) => {
      const queue = queues[table]
      if (!queue || queue.length === 0) throw new Error(`Sem mock para tabela ${table}`)
      return builder(queue.shift())
    }),
  } as never)
}

describe('api lista registros atendimento presencial', () => {
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

  it('lista cliente vinculada por cliente_id sem filtrar status ativo', async () => {
    mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null },
      ],
      app_usuarios_unidades: [
        { data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }], error: null },
      ],
      atendimento_presencial_atendimentos: [
        {
          data: [{ consultora_nome: 'Ana Clara' }],
          error: null,
        },
        {
          data: [{
            id: atendimentoId,
            cliente_id: clienteId,
            consultora_usuario_id: usuarioId,
            unidade_id: unidadeId,
            status: 'concluido',
            draft_client_id: '123e4567-e89b-12d3-a456-426614174005',
            dados_rascunho: { schema: 'atendimento_presencial_concluido_v1' },
            resultado_atendimento: 'nao',
            numero_lancamento: null,
            virada_cartao_dia: null,
            virada_cartao_mes: null,
            consultora_nome: 'Ana Clara',
            concluido_em: '2026-07-16T12:00:00.000Z',
            iniciado_em: '2026-07-16T11:00:00.000Z',
            ultima_atividade_em: '2026-07-16T12:00:00.000Z',
            expira_em: '2026-07-21T12:00:00.000Z',
            version: 4,
            criado_por: usuarioId,
            atualizado_por: usuarioId,
            created_at: '2026-07-16T11:00:00.000Z',
            updated_at: '2026-07-16T12:00:00.000Z',
          }],
          error: null,
        },
      ],
      atendimento_presencial_clientes: [
        {
          data: [{
            id: clienteId,
            nome: 'Cliente Histórica',
            telefone_informado: '(41) 99999-2222',
            parentesco: 'mae',
            parentesco_outro: null,
            status: 'inativo',
          }],
          error: null,
        },
      ],
      usuarios_permitidos: [
        { data: [{ id: usuarioId, email: 'consultora@example.com' }], error: null },
      ],
      app_unidades: [
        { data: [{ id: unidadeId, nome: 'Bigorrilho' }], error: null },
      ],
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.registros[0]).toMatchObject({
      clienteId,
      clienteNome: 'Cliente Histórica',
      clienteTelefone: '(41) 99999-2222',
    })
  })

  it('combina filtro por nome do cliente e consultora do atendimento', async () => {
    const atendimentoBuilder = builder({ data: [], error: null })
    const clienteBuilder = builder({ data: [{ id: clienteId }], error: null })
    const from = vi.fn((table: string) => {
      if (table === 'atendimento_presencial_atendimentos') return atendimentoBuilder
      if (table === 'atendimento_presencial_clientes') return clienteBuilder
      if (table === 'app_usuarios_perfis') {
        return builder({ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null })
      }
      if (table === 'app_usuarios_unidades') {
        return builder({ data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }], error: null })
      }
      return builder({ data: [], error: null })
    })
    vi.mocked(createServiceClient).mockReturnValue({ from } as never)

    const response = await GET(
      new Request('http://local/api/atendimento-presencial/atendimentos?clienteNome=Cliente&consultora=Ana%20Clara')
    )

    expect(response.status).toBe(200)
    expect(clienteBuilder.ilike).toHaveBeenCalledWith('nome', '%Cliente%')
    expect(atendimentoBuilder.in).toHaveBeenCalledWith('cliente_id', [clienteId])
    expect(atendimentoBuilder.ilike).toHaveBeenCalledWith('consultora_nome', 'Ana Clara')
  })
})
