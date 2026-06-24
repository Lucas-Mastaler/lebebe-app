import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET } from './route'
import type { ProgressoPesquisa } from '@/lib/procurar-datas/contratos'

const validarAcessoMock = vi.hoisted(() => vi.fn())
const buscarProgressoMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/procurar-datas/api', () => ({
  validarAcessoProcurarDatas: validarAcessoMock,
  respostaErroProcurarDatas: vi.fn((error: unknown) =>
    NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'erro inesperado' },
      { status: 500 }
    )
  ),
}))

vi.mock('@/lib/procurar-datas/v2/progresso-compat-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/procurar-datas/v2/progresso-compat-store')>()
  return {
    ...real,
    buscarProgressoCompat: buscarProgressoMock,
  }
})

function criarGETRequest(clientToken?: string): NextRequest {
  const url = clientToken
    ? `http://localhost/api/procurar-datas/v2/progresso-compat?clientToken=${encodeURIComponent(clientToken)}`
    : 'http://localhost/api/procurar-datas/v2/progresso-compat'
  return new NextRequest(url, { method: 'GET' })
}

const progressoDoneFixture: ProgressoPesquisa = {
  status: 'done',
  clientToken: 'tok-k13',
  normais: [
    {
      rank: 1,
      dateISO: '2026-08-14T03:00:00.000Z',
      date: '2026-08-14',
      dateDM: '14/08',
      weekday: 'Quinta',
      daysLeftTxt: '52 d',
      encomenda: 'Não',
      frete: 'R$ 200',
      team: 'EQUIPE 1',
      tipo: 'normal',
      isExtra: false,
      avisoHoraMarcada: '',
    } as unknown as ProgressoPesquisa['normais'][0],
  ],
  extras: [],
  payload: {
    ok: true,
    cep: '81830-020',
    tempo: '00:40',
    label: 'Xaxim - Curitiba',
    address: 'Rua Cornelius Pries, 669, Xaxim, Curitiba, PR',
    addressShort: 'Rua Cornelius Pries, 669, Xaxim, Curitiba, PR',
    startFromISO: '2026-08-14',
    startFromDM: '14/08',
    isRural: false,
    isCondominio: true,
    params: '',
    candidates: [],
    searchTime: '3.2',
  },
  timestamp: 1700000000000,
  startedAt: '2026-08-14T10:00:00.000Z',
  finishedAt: '2026-08-14T10:00:03.200Z',
  durationMs: 3200,
}

describe('GET /api/procurar-datas/v2/progresso-compat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validarAcessoMock.mockResolvedValue({ response: null, auth: { authorized: true } })
  })

  it('retorna progress done com payload quando token existe no Redis', async () => {
    buscarProgressoMock.mockResolvedValue(progressoDoneFixture)

    const res = await GET(criarGETRequest('tok-k13'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.progress.status).toBe('done')
    expect(json.progress.clientToken).toBe('tok-k13')
    expect(json.progress.normais).toHaveLength(1)
    expect(json.progress.extras).toHaveLength(0)
    expect(json.progress.payload).toBeDefined()
    expect(json.progress.payload.candidates).toBeDefined()
    expect(json.progress.durationMs).toBe(3200)
  })

  it('retorna waiting quando token nao existe no Redis', async () => {
    buscarProgressoMock.mockResolvedValue(null)

    const res = await GET(criarGETRequest('tok-inexistente'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.progress.status).toBe('waiting')
    expect(json.progress.normais).toEqual([])
    expect(json.progress.extras).toEqual([])
    expect(json.progress.clientToken).toBeUndefined()
  })

  it('retorna erro 400 quando clientToken ausente na query', async () => {
    const res = await GET(criarGETRequest())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(typeof json.error).toBe('string')
    expect(buscarProgressoMock).not.toHaveBeenCalled()
  })

  it('nao chama orquestrador no GET — apenas le do Redis', async () => {
    buscarProgressoMock.mockResolvedValue(progressoDoneFixture)

    await GET(criarGETRequest('tok-k13'))

    expect(buscarProgressoMock).toHaveBeenCalledWith('tok-k13')
    expect(buscarProgressoMock).toHaveBeenCalledTimes(1)
  })

  it('retorna acesso negado sem consultar Redis', async () => {
    validarAcessoMock.mockResolvedValue({
      response: NextResponse.json({ ok: false, error: 'Nao autorizado' }, { status: 401 }),
    })

    const res = await GET(criarGETRequest('tok-k13'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Nao autorizado')
    expect(buscarProgressoMock).not.toHaveBeenCalled()
  })

  it('retorna progress error quando Redis contem status error', async () => {
    const progressoError: ProgressoPesquisa = {
      status: 'error',
      clientToken: 'tok-err',
      normais: [],
      extras: [],
      error: 'OSRM timeout',
      timestamp: Date.now(),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 500,
    }
    buscarProgressoMock.mockResolvedValue(progressoError)

    const res = await GET(criarGETRequest('tok-err'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.progress.status).toBe('error')
    expect(json.progress.error).toBe('OSRM timeout')
  })
})
