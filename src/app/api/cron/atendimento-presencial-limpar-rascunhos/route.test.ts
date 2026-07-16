import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { createServiceClient } from '@/lib/supabase/service'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

function request(auth?: string) {
  return new NextRequest('http://local/api/cron/atendimento-presencial-limpar-rascunhos', {
    headers: auth ? { authorization: auth } : undefined,
  })
}

function deleteBuilder(result: unknown) {
  const chain = {
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    select: vi.fn(() => Promise.resolve(result)),
  }
  return chain
}

describe('cron limpeza rascunhos atendimento presencial', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('rejeita quando CRON_SECRET nao esta configurado', async () => {
    vi.stubEnv('CRON_SECRET', '')

    const response = await GET(request())

    expect(response.status).toBe(500)
  })

  it('rejeita segredo invalido', async () => {
    vi.stubEnv('CRON_SECRET', 'segredo')

    const response = await GET(request('Bearer outro'))

    expect(response.status).toBe(401)
  })

  it('exclui somente rascunhos vencidos e retorna quantidade', async () => {
    vi.stubEnv('CRON_SECRET', 'segredo')
    const builder = deleteBuilder({ data: [{ id: 'r1' }, { id: 'r2' }], error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => builder) } as never)

    const response = await GET(request('Bearer segredo'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.totalExcluidos).toBe(2)
    expect(builder.eq).toHaveBeenCalledWith('status', 'rascunho')
    expect(builder.lt).toHaveBeenCalledWith('expira_em', expect.any(String))
  })

  it('mantem filtro de status antes de expira_em para nao excluir concluidos expirados', async () => {
    vi.stubEnv('CRON_SECRET', 'segredo')
    const builder = deleteBuilder({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => builder) } as never)

    await GET(request('Bearer segredo'))

    expect(builder.eq).toHaveBeenCalledWith('status', 'rascunho')
    expect(builder.lt).toHaveBeenCalledWith('expira_em', expect.any(String))
    expect(builder.eq).not.toHaveBeenCalledWith('status', 'concluido')
  })
})
