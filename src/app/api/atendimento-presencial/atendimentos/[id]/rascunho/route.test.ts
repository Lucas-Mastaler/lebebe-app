import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from './route'
import { createServiceClient } from '@/lib/supabase/service'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { migrarFichaDadosRascunho } from '@/lib/atendimento-presencial/ficha-schema'

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
const rascunhoId = '123e4567-e89b-12d3-a456-426614174004'
const clienteId = '123e4567-e89b-12d3-a456-426614174005'

const rascunhoRow = {
  id: rascunhoId,
  cliente_id: null,
  consultora_usuario_id: usuarioId,
  unidade_id: unidadeId,
  status: 'rascunho',
  draft_client_id: '123e4567-e89b-12d3-a456-426614174003',
  dados_rascunho: { notaTecnica: 'atual' },
  iniciado_em: '2026-07-15T12:00:00.000Z',
  ultima_atividade_em: '2026-07-15T12:00:00.000Z',
  expira_em: '2099-07-20T12:00:00.000Z',
  version: 2,
  criado_por: usuarioId,
  atualizado_por: usuarioId,
  created_at: '2026-07-15T12:00:00.000Z',
  updated_at: '2026-07-15T12:00:00.000Z',
}

function builder(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    update: vi.fn(() => chain),
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
      if (!queue || queue.length === 0) throw new Error(`Sem mock para tabela ${table}`)
      return builder(queue.shift())
    })
  vi.mocked(createServiceClient).mockReturnValue({ from } as never)
  return from
}

describe('api rascunho por id', () => {
  it('bloqueia aba antiga antes de apagar quantidade e venda', async () => {
    const from = mockSupabase({
      app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
      app_usuarios_unidades: [{ data: [{ app_unidades: { id: unidadeId, ativo: true } }], error: null }],
      atendimento_presencial_atendimentos: [{ data: { ...rascunhoRow, dados_rascunho: { versaoProdutos: 2, produtosInteresse: [{ descricao: 'BERÇO', quantidade: 2, vendido: true }] } }, error: null }],
    })
    const response = await PATCH(new Request('http://local', { method: 'PATCH', body: JSON.stringify({ version: 2, dadosRascunho: { produtosInteresse: ['BERÇO'] } }) }), { params: Promise.resolve({ id: rascunhoId }) })
    expect(response.status).toBe(422)
    expect((await response.json()).message).toContain('Atualize a página')
    expect(from.mock.calls.filter(([table]) => table === 'atendimento_presencial_atendimentos')).toHaveLength(1)
  })
  it('autosave mantém metadados de produto já estruturado mesmo com ativação desligada', async () => {
    const dadosRascunho = migrarFichaDadosRascunho({ versaoProdutos: 2, produtosInteresse: [{ descricao: 'BERÇO', quantidade: 3, vendido: true }] })
    mockSupabase({
      app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
      app_usuarios_unidades: [{ data: [{ app_unidades: { id: unidadeId, ativo: true } }], error: null }],
      atendimento_presencial_atendimentos: [{ data: { ...rascunhoRow, dados_rascunho: dadosRascunho }, error: null }, { data: { ...rascunhoRow, version: 3, dados_rascunho: dadosRascunho }, error: null }],
    })
    const response = await PATCH(new Request('http://local', { method: 'PATCH', body: JSON.stringify({ version: 2, dadosRascunho }) }), { params: Promise.resolve({ id: rascunhoId }) })
    expect(response.status).toBe(200)
    expect((await response.json()).rascunho.dadosRascunho.produtosInteresse).toEqual(dadosRascunho.produtosInteresse)
  })
  it('preserva contrato v2 e ramo comercial oculto no autosave', async () => {
    const dadosRascunho = migrarFichaDadosRascunho({ versaoFluxo: 2, tipoAtendimento: 'nao_cliente', motivoVisita: 'outros',
      resultadoAtendimento: 'negociacao', motivosResultado: ['preco'], observacaoNaoFechamento: 'Retornar' })
    mockSupabase({
      app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
      app_usuarios_unidades: [{ data: [{ app_unidades: { id: unidadeId, ativo: true } }], error: null }],
      atendimento_presencial_atendimentos: [
        { data: rascunhoRow, error: null }, { data: { ...rascunhoRow, version: 3, dados_rascunho: dadosRascunho }, error: null },
      ],
    })
    const response = await PATCH(new Request('http://local', { method: 'PATCH', body: JSON.stringify({ version: 2, dadosRascunho }) }),
      { params: Promise.resolve({ id: rascunhoId }) })
    expect(response.status).toBe(200)
    expect((await response.json()).rascunho.dadosRascunho).toEqual(dadosRascunho)
  })
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
      moduleKey: 'atendimento_presencial_ficha',
      origem: 'perfil',
    })
    vi.mocked(checkAccessWindowForUser).mockResolvedValue({
      ok: true,
      permitido: true,
      motivo: 'dentro_da_janela',
      tipoJanelaAtual: 'seg_sex',
      agoraLocal: '15/07/2026 10:00:00 BRT',
      janelaAplicada: null,
    })
  })

  it('retorna 409 quando update condicional por version nao encontra linha', async () => {
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
        { data: null, error: null },
        { data: rascunhoRow, error: null },
      ],
    })

    const response = await PATCH(new Request('http://local', {
      method: 'PATCH',
      body: JSON.stringify({ version: 1, dadosRascunho: { notaTecnica: 'novo' } }),
    }), { params: Promise.resolve({ id: rascunhoId }) })
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.ok).toBe(false)
    expect(json.rascunho.version).toBe(2)
  })

  it('envia nome sexo data e entradas intermediarias ao JSONB e os devolve na resposta', async () => {
    const dados = migrarFichaDadosRascunho({
      consultoraNome: 'Ana Clara',
      criancas: [{ id: 'crianca-teste', situacao: 'gestacao', nome: 'Maria Clara', sexo: 'menina', dataPrevistaNascimento: '2027-02-15' }],
      entradasFormulario: {
        novoCliente: { nome: 'Cadastro pendente', telefone: '', parentesco: '', parentescoOutro: '' },
        dataPrevistaInputs: { outra: '15/02' }, viradaCartaoInput: '', produtoDigitado: 'Berco', numeroLancamento: '123', telefonePendente: null,
      },
    })
    const from = mockSupabase({
      app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
      app_usuarios_unidades: [{ data: [{ app_unidades: { id: unidadeId, chave: 'teste', nome: 'Teste', ativo: true } }], error: null }],
      atendimento_presencial_atendimentos: [
        { data: rascunhoRow, error: null },
        { data: { ...rascunhoRow, dados_rascunho: dados, version: 3 }, error: null },
      ],
    })
    const response = await PATCH(new Request('http://local', { method: 'PATCH', body: JSON.stringify({ version: 2, dadosRascunho: dados }) }), { params: Promise.resolve({ id: rascunhoId }) })
    expect(response.status).toBe(200)
    const updateQuery = from.mock.results.map((result) => result.value).find((query) => query.update.mock.calls.length)
    expect(updateQuery?.update).toHaveBeenCalledWith(expect.objectContaining({ dados_rascunho: dados }))
    expect((await response.json()).rascunho.dadosRascunho).toEqual(dados)
    expect(from.mock.calls.every(([table]) => table !== 'atendimento_presencial_clientes')).toBe(true)
  })

  it('atualiza cliente_id quando cliente ativa e selecionada', async () => {
    const atualizado = { ...rascunhoRow, cliente_id: clienteId, version: 3 }
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
        { data: atualizado, error: null },
      ],
      atendimento_presencial_clientes: [
        { data: { id: clienteId }, error: null },
      ],
    })

    const response = await PATCH(new Request('http://local', {
      method: 'PATCH',
      body: JSON.stringify({
        version: 2,
        clienteId,
        dadosRascunho: {
          criancas: [],
          departamentos: ['p_pesada'],
          produtosInteresse: ['Carrinho Salsa 4'],
          motivosResultado: [],
          etapaAtual: 'interesses',
        },
      }),
    }), { params: Promise.resolve({ id: rascunhoId }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.rascunho.clienteId).toBe(clienteId)
    expect(json.rascunho.dadosRascunho.etapaAtual).toBe('ficha')
    expect(json.rascunho.dadosRascunho).not.toHaveProperty('clienteId')
  })
})
