import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAtendimentoPresencialHistoricoAccess } from '@/lib/atendimento-presencial/api-auth'
import { carregarPerfilAtendimento, listarUnidadesDoContexto } from '@/lib/atendimento-presencial/rascunhos'
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/atendimento-presencial/api-auth', () => ({ requireAtendimentoPresencialHistoricoAccess: vi.fn() }))
vi.mock('@/lib/atendimento-presencial/rascunhos', async original => ({ ...await original<object>(), carregarPerfilAtendimento: vi.fn(), listarUnidadesDoContexto: vi.fn() }))
vi.mock('@/lib/pedidos-personalizados/server/contexto', () => ({ carregarContextoPedidosPersonalizados: vi.fn(async () => ({ ok: false })) }))
const id = '10000000-0000-4000-8000-000000000001'
const unidade = '10000000-0000-4000-8000-000000000002'
function setup() {
  const rpc = vi.fn().mockResolvedValue({ data: { vendas: [{ documentoId: 'sgi-id', origemAssociacao: 'prancheta' }], diagnosticos: { associado: 1 } }, error: null })
  const chains: Array<{ in: ReturnType<typeof vi.fn> }> = []
  const from = vi.fn((table: string) => {
    const result = { data: table === 'atendimento_presencial_clientes' ? { id, telefone_informado: null, telefone_normalizado: null, telefone_normalizado_ddi: null } : [], error: null }
    const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), in: vi.fn(() => chain), neq: vi.fn(() => chain), order: vi.fn(() => chain), limit: vi.fn(async () => result), maybeSingle: vi.fn(async () => result) }
    chains.push(chain)
    return chain
  })
  vi.mocked(createServiceClient).mockReturnValue({ from, rpc } as never)
  return { rpc, from, chains }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(requireAtendimentoPresencialHistoricoAccess).mockResolvedValue({ ok: true, allowedUser: { id: 'usuario', role: 'user' } } as never)
  vi.mocked(carregarPerfilAtendimento).mockResolvedValue('consultora')
  vi.mocked(listarUnidadesDoContexto).mockResolvedValue([{ id: unidade, chave: 'bigorrilho', nome: 'Bigorrilho' }])
})
describe('histórico SGI de clientes', () => {
  it('inclui venda sem telefone e ignora escopo forjado na URL', async () => {
    const { rpc, chains } = setup()
    const r = await GET(new Request('http://local?perfil=superadmin&unidadeId=outra'), { params: Promise.resolve({ id }) })
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ telefoneDisponivel: false, vendas: [{ documentoId: 'sgi-id' }], diagnosticosSgi: { associado: 1 } })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('atendimento_presencial_resolver_vendas_sgi', expect.objectContaining({ p_perfil: 'consultora', p_unidades: [unidade], p_usuario_id: 'usuario', p_variacoes_telefone: [] }))
    expect(chains[1].in).toHaveBeenCalledWith('unidade_id',[unidade])
  })
  it('nega antes de usar cliente de serviço', async () => {
    vi.mocked(requireAtendimentoPresencialHistoricoAccess).mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) } as never)
    expect((await GET(new Request('http://local'), { params: Promise.resolve({ id }) })).status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it('sem unidade permite histórico comercial e mantém atendimentos restritos', async () => {
    const { rpc, chains } = setup()
    vi.mocked(carregarPerfilAtendimento).mockResolvedValue('gestao')
    vi.mocked(listarUnidadesDoContexto).mockResolvedValue([])
    const r = await GET(new Request('http://local'), { params: Promise.resolve({ id }) })
    expect(await r.json()).toMatchObject({ vendas: [{ documentoId: 'sgi-id' }], atendimentos: [] })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('atendimento_presencial_resolver_vendas_sgi', expect.objectContaining({ p_perfil: 'gestao', p_unidades: [], p_atendimento_id: null }))
    expect(chains[1].in).toHaveBeenCalledWith('unidade_id', [])
  })
})
