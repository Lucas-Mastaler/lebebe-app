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
    range: vi.fn(() => chain),
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
      if (!queue || queue.length === 0) {
        if (table === 'atendimento_presencial_criancas' || table === 'atendimento_presencial_departamentos') {
          return builder({ data: [], error: null })
        }
        throw new Error(`Sem mock para tabela ${table}`)
      }
      return builder(queue.shift())
    }),
  } as never)
}

describe('api lista registros atendimento presencial', () => {
  it.each([false, true])('homologacao aparece apenas em consulta explicita: %s', async (explicita) => {
    mockSupabase({
      app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
      app_usuarios_unidades: [{ data: [], error: null }],
      atendimento_presencial_atendimentos: [{ data: [], error: null }, { data: [{ id: atendimentoId,
        consultora_nome: 'HOMOLOGACAO Lucas', consultora_usuario_id: usuarioId, unidade_id: unidadeId,
        versao_fluxo: 2, tipo_atendimento: 'nao_cliente', cliente_id: null, resultado_atendimento: null }], error: null }],
      usuarios_permitidos: [{ data: [], error: null }],
      app_unidades: [{ data: [], error: null }],
    })
    const response = await GET(new Request(`http://local${explicita ? '?consultora=HOMOLOGACAO%20Lucas' : ''}`))
    expect(response.status).toBe(200)
    expect((await response.json()).registros).toHaveLength(explicita ? 1 : 0)
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


  it('combina multisseleções com OR interno, datas e telefone antes de contar clientes únicos', async () => {
    const rows = [
      { id: 'a', iniciado_em: '2026-10-09T03:00Z' },
      { id: 'b', iniciado_em: '2026-10-10T02:59Z' },
      { id: 'c', iniciado_em: '2026-10-09T02:59Z' },
    ].map(row => ({ ...row, status: 'concluido', cliente_id: clienteId, consultora_nome: 'ANA', consultora_usuario_id: usuarioId, unidade_id: unidadeId, tipo_atendimento: 'cliente', resultado_atendimento: 'negociacao' }))
    const dep = builder({ data: [{ atendimento_id: 'a' }, { atendimento_id: 'b' }], error: null })
    const motivos = builder({ data: [{ atendimento_id: 'a' }], error: null })
    let consultas = 0
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn((table: string) => {
      if (table === 'app_usuarios_perfis') return builder({ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null })
      if (table === 'app_usuarios_unidades') return builder({ data: [{ app_unidades: { id: unidadeId, nome: 'Filial', ativo: true } }], error: null })
      if (table === 'atendimento_presencial_atendimentos') return builder({ data: consultas++ ? rows : [{ consultora_nome: 'ANA' }], error: null })
      if (table === 'atendimento_presencial_clientes') return builder({ data: [{ id: clienteId, nome: 'CLIENTE', telefone_informado: '(41) 99646-5656', telefone_normalizado: '41996465656' }], error: null })
      if (table === 'atendimento_presencial_departamentos') return dep
      if (table === 'atendimento_presencial_motivos') return motivos
      return builder({ data: [], error: null })
    }) } as never)
    const response = await GET(new Request('http://local?departamentos=moveis&departamentos=enxoval&motivos=virada_cartao&motivos=sem_medidas&atendimentoDe=2026-10-09&atendimentoAte=2026-10-09&telefoneCliente=41996465656&contato=com'))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.total).toBe(1)
    expect(json.clientesUnicos).toBe(1)
    expect(json.visitasNaoClientes).toBe(0)
    expect(json.registros.map((row: { id: string }) => row.id)).toEqual(['a'])
    expect(dep.in).toHaveBeenCalledWith('departamento', ['moveis', 'enxoval'])
    expect(motivos.in).toHaveBeenCalledWith('motivo', ['virada_cartao', 'sem_medidas'])
  })
  it('filtra parentesco da criança antes das contagens e inclui-o no cabeçalho', async () => {
    const rows = ['mae', 'pai'].map((_, index) => ({
      id: index ? 'b' : 'a', iniciado_em: '2026-10-20T12:00:00Z', status: 'concluido',
      cliente_id: clienteId, consultora_nome: 'ANA', consultora_usuario_id: usuarioId,
      unidade_id: unidadeId, tipo_atendimento: 'cliente', resultado_atendimento: 'sim',
    }))
    const parentescos = builder({ data: [{ atendimento_id: 'a' }], error: null })
    let consultasAtendimento = 0
    let consultasCriancas = 0
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn((table: string) => {
      if (table === 'app_usuarios_perfis') return builder({ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null })
      if (table === 'app_usuarios_unidades') return builder({ data: [{ app_unidades: { id: unidadeId, nome: 'Filial', ativo: true } }], error: null })
      if (table === 'atendimento_presencial_atendimentos') return builder({ data: consultasAtendimento++ ? rows : [{ consultora_nome: 'ANA' }], error: null })
      if (table === 'atendimento_presencial_criancas') return consultasCriancas++ === 0 ? parentescos : builder({ data: [{ atendimento_id: 'a', nome: 'Catarina', parentesco_vinculo: 'Mãe', nome_nao_informado: false, ordem: 1 }], error: null })
      if (table === 'atendimento_presencial_clientes') return builder({ data: [{ id: clienteId, nome: 'Cliente', telefone_informado: null, telefone_normalizado: null, telefone_normalizado_ddi: null }], error: null })
      if (table === 'usuarios_permitidos') return builder({ data: [{ id: usuarioId, email: 'ana@example.com' }], error: null })
      if (table === 'app_unidades') return builder({ data: [{ id: unidadeId, nome: 'Filial' }], error: null })
      return builder({ data: [], error: null })
    }) } as never)

    const response = await GET(new Request('http://local?parentescos=M%C3%A3e&parentescos=Pai'))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.total).toBe(1)
    expect(json.registros[0].id).toBe('a')
    expect(json.registros[0].criancasResumo).toEqual([{ nome: 'Catarina', parentesco: 'Mãe' }])
    expect(parentescos.in).toHaveBeenCalledWith('parentesco_vinculo', ['Mãe', 'Pai'])
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
            observacoes: 'Preferência por roupinhas neutras.',
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
      atendimento_presencial_criancas: [
        { data: [{ atendimento_id: atendimentoId, nome: 'Catarina', nome_nao_informado: false, ordem: 1 }], error: null },
      ],
      atendimento_presencial_departamentos: [
        { data: [{ atendimento_id: atendimentoId, departamento: 'ROUPINHAS', ordem: 1 }, { atendimento_id: atendimentoId, departamento: 'MOVEIS', ordem: 2 }], error: null },
      ],
    })

    const response = await GET(new Request('http://localhost/api/atendimento-presencial/atendimentos'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.registros[0]).toMatchObject({
      clienteId,
      clienteNome: 'Cliente Histórica',
      clienteTelefone: '(41) 99999-2222',
      criancasNomes: ['Catarina'],
      departamentos: ['ROUPINHAS', 'MOVEIS'],
      observacoes: 'Preferência por roupinhas neutras.',
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
    expect(atendimentoBuilder.ilike).toHaveBeenCalledWith('consultora_nome', 'ANA CLARA')
  })
  it('lista nao cliente com motivo proprio, sem resultado ou consulta de cliente ficticio', async () => {
    const chain = builder({ data: [{ id: atendimentoId, cliente_id: null, consultora_usuario_id: usuarioId,
      unidade_id: unidadeId, versao_fluxo: 2, tipo_atendimento: 'nao_cliente', motivo_visita: 'representante',
      resultado_atendimento: null, consultora_nome: 'Ana', concluido_em: '2026-10-15T12:00:00Z' }], error: null })
    const from = vi.fn((table: string) => {
      if (table === 'atendimento_presencial_atendimentos') return chain
      if (table === 'app_usuarios_perfis') return builder({ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null })
      if (table === 'app_usuarios_unidades') return builder({ data: [{ app_unidades: { id: unidadeId, chave: 'loja', nome: 'Loja', ativo: true } }], error: null })
      return builder({ data: [], error: null })
    })
    vi.mocked(createServiceClient).mockReturnValue({ from } as never)
    const response = await GET(new Request('http://local?consultora=Ana&unidadeId=' + unidadeId))
    expect(response.status).toBe(200)
    expect((await response.json()).registros[0]).toMatchObject({ clienteId: null, clienteNome: 'Não cliente',
      versaoFluxo: 2, tipoAtendimento: 'nao_cliente', motivoVisita: 'representante', resultadoAtendimento: null })
    expect(from).not.toHaveBeenCalledWith('atendimento_presencial_clientes')
    expect(chain.eq).toHaveBeenCalledWith('consultora_usuario_id', usuarioId)
    expect(chain.eq).toHaveBeenCalledWith('unidade_id', unidadeId)
    expect(chain.ilike).toHaveBeenCalledWith('consultora_nome', 'ANA')
    expect(chain.select).toHaveBeenCalledWith('*')
  })

  it('exclui registros sem virada quando o filtro de virada esta ativo', async () => {
    mockSupabase({
      app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
      app_usuarios_unidades: [{ data: [], error: null }],
      atendimento_presencial_atendimentos: [{ data: [], error: null }, { data: [{ id: atendimentoId, versao_fluxo: 2,
        tipo_atendimento: 'nao_cliente', cliente_id: null, resultado_atendimento: null }], error: null }],
    })
    const response = await GET(new Request('http://local?viradaCartaoDe=01/01'))
    expect(response.status).toBe(200)
    expect((await response.json()).registros).toEqual([])
  })

  it.each(['', 'sim', 'negociacao', 'nao'])('situação %s combina filtros e preserva conclusão e unidade', async (situacao) => {
    const chain = builder({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn((table: string) => {
      if (table === 'app_usuarios_perfis') return builder({ data: { app_perfis_acesso: { chave: 'supervisora_loja', ativo: true } }, error: null })
      if (table === 'app_usuarios_unidades') return builder({ data: [{ app_unidades: { id: unidadeId, chave: 'loja', nome: 'Loja', ativo: true } }], error: null })
      if (table === 'atendimento_presencial_clientes') return builder({ data: [{ id: clienteId }], error: null })
      return chain
    }) } as never)
    const response = await GET(new Request('http://local?situacaoVenda=' + situacao + '&clienteNome=Ana&consultora=Maria&unidadeId=' + unidadeId))
    expect(response.status).toBe(200)
    expect(chain.eq).toHaveBeenCalledWith('status', 'concluido')
    expect(chain.in).toHaveBeenCalledWith('unidade_id', [unidadeId])
    expect(chain.eq).toHaveBeenCalledWith('unidade_id', unidadeId)
    expect(chain.in).toHaveBeenCalledWith('cliente_id', [clienteId])
    expect(chain.ilike).toHaveBeenCalledWith('consultora_nome', 'MARIA')
    if (situacao) expect(chain.eq).toHaveBeenCalledWith('resultado_atendimento', situacao)
    else expect(chain.eq).not.toHaveBeenCalledWith('resultado_atendimento', expect.anything())
  })

  it.each(['sim', 'negociacao', 'nao', null])('lista resultado %s inclusive legado sem situação com paginação', async (resultado) => {
    mockSupabase({
      app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }],
      app_usuarios_unidades: [{ data: [], error: null }],
      atendimento_presencial_atendimentos: [{ data: [], error: null }, { data: Array.from({ length: 41 }, (_, i) => ({
        id: String(i), cliente_id: null, consultora_usuario_id: usuarioId, unidade_id: unidadeId,
        resultado_atendimento: resultado, status: 'concluido', concluido_em: '2026-10-19T12:00:00Z',
      })), error: null }],
      usuarios_permitidos: [{ data: [], error: null }], app_unidades: [{ data: [], error: null }],
    })
    const response = await GET(new Request('http://local?page=2'))
    const json = await response.json()
    expect(json.total).toBe(41)
    expect(json.page).toBe(2)
    expect(json.registros.length).toBe(Math.min(json.pageSize, 41 - json.pageSize))
    expect(json.registros.every((r: { resultadoAtendimento: string | null }) => r.resultadoAtendimento === resultado)).toBe(true)
  })

  it('rejeita situação desconhecida', async () => {
    mockSupabase({ app_usuarios_perfis: [{ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null }], app_usuarios_unidades: [{ data: [], error: null }] })
    expect((await GET(new Request('http://local?situacaoVenda=invalida'))).status).toBe(400)
  })

  it('conta e pagina além do primeiro lote do Supabase', async () => {
    const rows = Array.from({ length: 1005 }, (_, i) => ({ id: String(i), cliente_id: null, consultora_usuario_id: usuarioId, unidade_id: unidadeId, resultado_atendimento: 'negociacao', status: 'concluido' }))
    let inicio = 0, fim = 499
    const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), order: vi.fn(() => chain),
      range: vi.fn((de: number, ate: number) => { inicio = de; fim = ate; return chain }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows.slice(inicio, fim + 1), error: null }).then(resolve) }
    let chamadas = 0
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn((table: string) => {
      if (table === 'app_usuarios_perfis') return builder({ data: { app_perfis_acesso: { chave: 'consultora', ativo: true } }, error: null })
      if (table === 'atendimento_presencial_atendimentos' && chamadas++ > 0) return chain
      return builder({ data: [], error: null })
    }) } as never)
    const json = await (await GET(new Request('http://local?situacaoVenda=negociacao&page=51'))).json()
    expect(json.total).toBe(1005)
    expect(json.page).toBe(51)
    expect(json.registros).toHaveLength(5)
    expect(chain.range.mock.calls).toEqual([[0,499],[500,999],[1000,1499]])
    expect(chain.eq).toHaveBeenCalledWith('resultado_atendimento', 'negociacao')
  })

})
