import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET } from './route'
import { createServiceClient } from '@/lib/supabase/service'
import { carregarPerfilAtendimento, listarUnidadesDoContexto, requireAtendimentoPresencialFichaAccess } from '@/lib/atendimento-presencial/rascunhos'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/atendimento-presencial/rascunhos', () => ({
  carregarPerfilAtendimento: vi.fn(), listarUnidadesDoContexto: vi.fn(), requireAtendimentoPresencialFichaAccess: vi.fn(),
}))
const request = (unidade = 'marechal') => new Request(`http://localhost/api/atendimento-presencial/consultoras-recentes?unidadeId=${unidade}`)
function mockConsulta(paginas: Array<{ data: Array<{ consultora_nome: string }> | null; error: unknown }>) {
  const query = { select: vi.fn(), eq: vi.fn(), not: vi.fn(), order: vi.fn(), range: vi.fn() }
  for (const key of ['select', 'eq', 'not', 'order'] as const) query[key].mockReturnValue(query)
  query.range.mockImplementation(() => Promise.resolve(paginas.shift()))
  vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => query) } as never)
  return query
}
describe('sugestoes de consultoras com isolamento de login e unidade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAtendimentoPresencialFichaAccess).mockResolvedValue({ ok: true, allowedUser: { id: 'login-marechal' } } as never)
    vi.mocked(carregarPerfilAtendimento).mockResolvedValue('consultora')
    vi.mocked(listarUnidadesDoContexto).mockResolvedValue([{ id: 'marechal', nome: 'Marechal', chave: 'marechal' }])
  })
  it('consulta somente concluidos do login autenticado e da unidade autorizada', async () => {
    const query = mockConsulta([{ data: [{ consultora_nome: 'ZELIA' }, { consultora_nome: 'ANA' }], error: null }])
    const response = await GET(request())
    expect(await response.json()).toEqual({ ok: true, nomes: ['ZELIA', 'ANA'] })
    expect(query.eq.mock.calls).toEqual([['consultora_usuario_id', 'login-marechal'], ['unidade_id', 'marechal'], ['status', 'concluido']])
    expect(query.order).toHaveBeenCalledWith('concluido_em', { ascending: false, nullsFirst: false })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
  it('busca paginas adicionais quando cem repeticoes precedem outros nomes', async () => {
    const query = mockConsulta([
      { data: Array(100).fill({ consultora_nome: 'ANA' }), error: null },
      { data: ['ana', 'BIA', 'CARLA', 'DORA', 'EVA'].map((consultora_nome) => ({ consultora_nome })), error: null },
    ])
    expect(await (await GET(request())).json()).toEqual({ ok: true, nomes: ['ANA', 'BIA', 'CARLA', 'DORA'] })
    expect(query.range.mock.calls).toEqual([[0, 99], [100, 199]])
  })
  it('nao consulta atendimentos de outra unidade', async () => {
    const query = mockConsulta([])
    expect((await GET(request('portao'))).status).toBe(403)
    expect(query.select).not.toHaveBeenCalled()
  })
  it('preserva rejeicao de modulo/janela antes de consultar dados', async () => {
    vi.mocked(requireAtendimentoPresencialFichaAccess).mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) } as never)
    expect((await GET(request())).status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it('retorna lista vazia sem historico e falha operacional sem nomes parciais', async () => {
    mockConsulta([{ data: [], error: null }])
    expect(await (await GET(request())).json()).toEqual({ ok: true, nomes: [] })
    mockConsulta([{ data: null, error: { code: 'erro-sintetico' } }])
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await GET(request())).status).toBe(500)
    log.mockRestore()
  })
})
