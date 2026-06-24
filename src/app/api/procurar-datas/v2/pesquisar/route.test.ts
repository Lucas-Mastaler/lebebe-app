import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'

const validarAcessoMock = vi.hoisted(() => vi.fn())
const pesquisarDatasV2Mock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/procurar-datas/api', () => ({
  validarAcessoProcurarDatas: validarAcessoMock,
  respostaErroProcurarDatas: vi.fn((error: unknown) =>
    NextResponse.json(
      { ok: false, erro: error instanceof Error ? error.message : 'erro inesperado' },
      { status: 500 }
    )
  ),
}))

vi.mock('@/lib/procurar-datas/motor/pesquisar-datas-v2', () => ({
  pesquisarDatasV2: pesquisarDatasV2Mock,
}))

function criarRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/procurar-datas/v2/pesquisar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/procurar-datas/v2/pesquisar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validarAcessoMock.mockResolvedValue({ response: null, user: { id: 'user-test' } })
    pesquisarDatasV2Mock.mockResolvedValue({
      ok: true,
      modo: 'v2-pesquisar-paralelo',
      resultadoFinal: {
        candidatosFinais: [],
        resumo: {
          totalRecebidos: 0,
          totalElegiveis: 0,
          totalRecortados: 0,
          normaisRecortados: 0,
          especiaisRecortados: 0,
          premiumsRecortados: 0,
          horaMarcadaRecortados: 0,
          maxNormaisAplicado: 3,
        },
        diasUsados: [],
      },
      diagnosticoMinimo: {
        osrmBaseUrlUsado: 'https://osrm.lebebe.cloud',
        osrmFallbackUsado: false,
        quantidadeSlotsComPontos: 0,
        quantidadeSlotsSemPontos: 0,
        slotsComKm: 0,
        slotsComFallbackHaversine: 0,
        cacheAgenda: {
          hashesConsultados: 0,
          hitsSupabase: 0,
          enderecosSemHash: 0,
        },
        avisos: [],
      },
    })
  })

  it('encaminha o POST autorizado para o motor v2 paralelo e retorna 200 quando ok', async () => {
    const body = {
      dataInicial: '2026-07-10',
      tempoNecessario: '00:40',
      destLat: -25.769705,
      destLng: -49.325586,
    }

    const res = await POST(criarRequest(body))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.modo).toBe('v2-pesquisar-paralelo')
    expect(pesquisarDatasV2Mock).toHaveBeenCalledTimes(1)
    expect(pesquisarDatasV2Mock).toHaveBeenCalledWith(body)
  })

  it('retorna a resposta de acesso negado sem executar o motor v2', async () => {
    validarAcessoMock.mockResolvedValue({
      response: NextResponse.json({ ok: false, erro: 'nao autorizado' }, { status: 401 }),
    })

    const res = await POST(criarRequest({ dataInicial: '2026-07-10' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.erro).toBe('nao autorizado')
    expect(pesquisarDatasV2Mock).not.toHaveBeenCalled()
  })
})
