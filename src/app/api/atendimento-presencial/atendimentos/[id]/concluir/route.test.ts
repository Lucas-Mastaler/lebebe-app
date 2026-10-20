import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
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
const atendimentoId = '123e4567-e89b-12d3-a456-426614174003'
const clienteId = '123e4567-e89b-12d3-a456-426614174004'

const rowRascunho = {
  id: atendimentoId,
  cliente_id: clienteId,
  consultora_usuario_id: usuarioId,
  unidade_id: unidadeId,
  status: 'rascunho',
  draft_client_id: '123e4567-e89b-12d3-a456-426614174005',
  dados_rascunho: {
    criancas: [],
    departamentos: ['p_pesada'],
    produtosInteresse: ['Carrinho'],
    consultoraNome: 'Ana',
    resultadoAtendimento: 'sim',
    motivosResultado: ['preco'],
    etapaAtual: 'revisao',
  },
  iniciado_em: '2026-07-15T12:00:00.000Z',
  ultima_atividade_em: '2026-07-15T12:00:00.000Z',
  expira_em: '2099-07-20T12:00:00.000Z',
  version: 3,
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
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function mockSupabase(queues: Record<string, unknown[]>, rpcResult: unknown) {
  const rpc = vi.fn(() => Promise.resolve(rpcResult))
  const from = vi.fn((table: string) => {
    const queue = queues[table]
    if (!queue || queue.length === 0) throw new Error(`Sem mock para tabela ${table}`)
    return builder(queue.shift())
  })
  vi.mocked(createServiceClient).mockReturnValue({ from, rpc } as never)
  return { from, rpc }
}

describe('api concluir atendimento presencial', () => {
  it.each([
    { atendimentoId: clienteId, version: 3, clienteId, solicitadoERecusado: true },
    { atendimentoId, version: 2, clienteId, solicitadoERecusado: true },
    { atendimentoId, version: 3, clienteId, solicitadoERecusado: false },
    { atendimentoId, version: 3, clienteId, solicitadoERecusado: true, naoSolicitadoClienteAusente: true },
  ])('rejeita confirmação de telefone fora desta tentativa %j', async confirmacaoTelefone => {
    const response = await POST(new Request('http://local', {method:'POST',body:JSON.stringify({version:3,confirmacaoTelefone})}),{params:Promise.resolve({id:atendimentoId})})
    expect(response.status).toBe(422)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it.each([
    { solicitadoERecusado: true },
    { naoSolicitadoClienteAusente: true },
  ])('aceita somente um desfecho de telefone vinculado a este atendimento %j', async desfecho => {
    const rascunho = { ...rowRascunho, dados_rascunho: { ...rowRascunho.dados_rascunho, versaoFluxo: 2, tipoAtendimento: 'cliente' } }
    const { rpc } = mockSupabase({
      app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
      app_usuarios_unidades: [{ data: [{ app_unidades: { id: unidadeId, ativo: true } }], error: null }],
      atendimento_presencial_atendimentos: [
        { data: rascunho, error: null },
        { data: { ...rascunho, status: 'concluido', version: 4, versao_fluxo: 2, tipo_atendimento: 'cliente' }, error: null },
      ],
    }, { data: [{ id: atendimentoId, version: 4 }], error: null })
    const confirmacaoTelefone = { atendimentoId, version: 3, clienteId, ...desfecho }
    const response = await POST(new Request('http://local', {
      method: 'POST', body: JSON.stringify({ version: 3, numeroLancamento: 22, confirmacaoTelefone }),
    }), { params: Promise.resolve({ id: atendimentoId }) })
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('atendimento_presencial_concluir', expect.objectContaining({ p_confirmacao_telefone: confirmacaoTelefone }))
  })
  it('erro SQL de recusa obrigatória não vira sucesso nem limpa o rascunho', async()=>{
    mockSupabase({app_usuarios_perfis:[{data:{app_perfis_acesso:{chave:'consultora',ativo:true}},error:null}],app_usuarios_unidades:[{data:[{app_unidades:{id:unidadeId,ativo:true}}],error:null}],atendimento_presencial_atendimentos:[{data:rowRascunho,error:null}]},{data:null,error:{code:'23514',message:'telefone_recusa_obrigatoria'}})
    const response=await POST(new Request('http://local',{method:'POST',body:JSON.stringify({version:3,numeroLancamento:22})}),{params:Promise.resolve({id:atendimentoId})})
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ok:false,field:'telefoneRecusa'})
  })
  it.each(['cliente', 'nao_cliente'])('conclui v2 %s apos confirmar persistencia', async (tipoAtendimento) => {
    const rascunho = { ...rowRascunho, cliente_id: tipoAtendimento === 'cliente' ? clienteId : null,
      dados_rascunho: tipoAtendimento === 'cliente'
        ? { ...rowRascunho.dados_rascunho, versaoFluxo: 2, tipoAtendimento }
        : { versaoFluxo: 2, tipoAtendimento, motivoVisita: 'outros', consultoraNome: 'Ana' } }
    const { rpc } = mockSupabase({
      app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
      app_usuarios_unidades: [{ data: [{ app_unidades: { id: unidadeId, ativo: true } }], error: null }],
      atendimento_presencial_atendimentos: [{ data: rascunho, error: null },
        { data: { ...rascunho, status: 'concluido', version: 4, versao_fluxo: 2, tipo_atendimento: tipoAtendimento }, error: null }],
    }, { data: null, error: null })
    const response = await POST(new Request('http://local', {
      method: 'POST', body: JSON.stringify({ version: 3, numeroLancamento: 22 }),
    }), { params: Promise.resolve({ id: atendimentoId }) })
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('atendimento_presencial_concluir', expect.objectContaining({
      p_numero_lancamento: tipoAtendimento === 'cliente' ? 22 : null,
    }))
  })
  it.each([
    { status: 'rascunho', version: 4 },
    { status: 'concluido', version: 3 },
    { status: 'concluido', version: 4, id: clienteId },
  ])('nao declara sucesso com persistencia inconsistente %j', async (resultado) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockSupabase({
        app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
        app_usuarios_unidades: [{ data: [{ app_unidades: { id: unidadeId, ativo: true } }], error: null }],
        atendimento_presencial_atendimentos: [{ data: rowRascunho, error: null },
          { data: { ...rowRascunho, ...resultado }, error: null }],
      }, { data: null, error: null })
      const response = await POST(new Request('http://local', { method: 'POST',
        body: JSON.stringify({ version: 3, numeroLancamento: 22 }),
      }), { params: Promise.resolve({ id: atendimentoId }) })
      expect(response.status).toBe(500)
      expect(await response.json()).toMatchObject({ ok: false })
    } finally { log.mockRestore() }
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

  it.each([22, 225, 2234, 34566, 1, 999999])('repassa lancamento %s do payload para RPC sem corte', async (numero) => {
    const concluido = {
      ...rowRascunho,
      status: 'concluido',
      resultado_atendimento: 'sim',
      numero_lancamento: numero,
      concluido_em: '2026-07-16T12:00:00.000Z',
      version: 4,
    }
    const supabase = mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null },
      ],
      app_usuarios_unidades: [
        { data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }], error: null },
      ],
      atendimento_presencial_atendimentos: [
        { data: rowRascunho, error: null },
        { data: concluido, error: null },
      ],
    }, { data: [{ id: atendimentoId, version: 4 }], error: null })

    const response = await POST(new Request('http://local', {
      method: 'POST',
      body: JSON.stringify({ version: 3, numeroLancamento: String(numero) }),
    }), { params: Promise.resolve({ id: atendimentoId }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.atendimento.numeroLancamento).toBe(numero)
    expect(supabase.rpc).toHaveBeenCalledWith('atendimento_presencial_concluir', expect.objectContaining({
      p_atendimento_id: atendimentoId,
      p_expected_version: 3,
      p_usuario_id: usuarioId,
      p_numero_lancamento: numero,
    }))
    expect(supabase.rpc).not.toHaveBeenCalledWith('atendimento_presencial_concluir', expect.objectContaining({
      p_perfil: expect.any(String),
    }))
    expect(supabase.rpc).not.toHaveBeenCalledWith('atendimento_presencial_concluir', expect.objectContaining({
      p_role: expect.any(String),
    }))
  })

  it.each([
    ['', 'Informe o numero do lancamento.'],
    ['1000000', 'O numero do lancamento deve estar entre 1 e 999999.'],
    ['22.5', 'Use somente digitos para informar um numero inteiro de lancamento.'],
  ])('retorna erro especifico de lancamento %s antes de chamar RPC', async (numero, message) => {
    const supabase = mockSupabase({
      app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
      app_usuarios_unidades: [{ data: [{ app_unidades: { id: unidadeId, chave: 'sintetica', nome: 'Sintetica', ativo: true } }], error: null }],
      atendimento_presencial_atendimentos: [{ data: rowRascunho, error: null }],
    }, { data: null, error: null })
    const response = await POST(new Request('http://local', {
      method: 'POST', body: JSON.stringify({ version: 3, numeroLancamento: numero }),
    }), { params: Promise.resolve({ id: atendimentoId }) })
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ ok: false, field: 'numeroLancamento', message })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('retorna 409 quando a rpc indica conflito de versao', async () => {
    mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null },
      ],
      app_usuarios_unidades: [
        { data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }], error: null },
      ],
      atendimento_presencial_atendimentos: [
        { data: rowRascunho, error: null },
      ],
    }, { data: null, error: { code: 'P0003', message: 'version_conflict' } })

    const response = await POST(new Request('http://local', {
      method: 'POST',
      body: JSON.stringify({ version: 3, numeroLancamento: '123' }),
    }), { params: Promise.resolve({ id: atendimentoId }) })
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json).toMatchObject({ ok: false, message: 'Conflito de versao' })
  })

  it('nao apresenta incompatibilidade SQL como falta de campos obrigatorios', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockSupabase({
        app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
        app_usuarios_unidades: [{ data: [{ app_unidades: { id: unidadeId, chave: 'sintetica', nome: 'Sintetica', ativo: true } }], error: null }],
        atendimento_presencial_atendimentos: [{ data: rowRascunho, error: null }],
      }, { data: null, error: { code: '23514', message: 'dados_rascunho_chave_invalida' } })
      const response = await POST(new Request('http://local', {
        method: 'POST', body: JSON.stringify({ version: 3, numeroLancamento: '256' }),
      }), { params: Promise.resolve({ id: atendimentoId }) })
      expect(response.status).toBe(500)
      expect(await response.json()).toMatchObject({ ok: false,
        message: 'Nao foi possivel finalizar por uma incompatibilidade no salvamento. Seus dados foram preservados.' })
      expect(log).toHaveBeenCalledWith('[ATENDIMENTO PRESENCIAL CONCLUIR] Contrato SQL incompativel com os campos do rascunho')
    } finally {
      log.mockRestore()
    }
  })

  it('nao repassa numero de lancamento quando resultado nao exige lancamento', async () => {
    const rowSemFechamento = {
      ...rowRascunho,
      dados_rascunho: {
        ...rowRascunho.dados_rascunho,
        consultoraNome: 'Ana',
        resultadoAtendimento: 'nao',
        motivosResultado: ['virada_cartao'],
        viradaCartaoDia: 20,
        viradaCartaoMes: 7,
      },
    }
    const concluido = {
      ...rowSemFechamento,
      status: 'concluido',
      resultado_atendimento: 'nao',
      numero_lancamento: null,
      concluido_em: '2026-07-16T12:00:00.000Z',
      version: 4,
    }
    const supabase = mockSupabase({
      app_usuarios_perfis: [
        { data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null },
      ],
      app_usuarios_unidades: [
        { data: [{ app_unidades: { id: unidadeId, chave: 'bigorrilho', nome: 'Bigorrilho', ativo: true } }], error: null },
      ],
      atendimento_presencial_atendimentos: [
        { data: rowSemFechamento, error: null },
        { data: concluido, error: null },
      ],
    }, { data: [{ id: atendimentoId, version: 4 }], error: null })

    const response = await POST(new Request('http://local', {
      method: 'POST',
      body: JSON.stringify({ version: 3, numeroLancamento: '123' }),
    }), { params: Promise.resolve({ id: atendimentoId }) })

    expect(response.status).toBe(200)
    expect(supabase.rpc).toHaveBeenCalledWith('atendimento_presencial_concluir', expect.objectContaining({
      p_numero_lancamento: null,
    }))
  })
})
