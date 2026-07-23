import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'

const validarAcessoMock = vi.hoisted(() => vi.fn())
const pesquisarDatasV2Mock = vi.hoisted(() => vi.fn())
const buscarConfigMock = vi.hoisted(() => vi.fn())
const criarBuscarRotaMock = vi.hoisted(() => vi.fn())
const salvarProgressoMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/procurar-datas/api', () => ({
  validarAcessoProcurarDatas: validarAcessoMock,
  respostaErroProcurarDatas: vi.fn((error: unknown) =>
    NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'erro inesperado' },
      { status: 500 }
    )
  ),
}))

vi.mock('@/lib/procurar-datas/motor/pesquisar-datas-v2', () => ({
  pesquisarDatasV2: pesquisarDatasV2Mock,
}))

vi.mock('@/lib/procurar-datas/config-service', () => ({
  buscarConfiguracoesProcurarDatas: buscarConfigMock,
}))

vi.mock('@/lib/procurar-datas/motor/osrm-route-client-diagnostico', () => ({
  criarBuscarRotaOSRMRouteDiagnosticoV2: criarBuscarRotaMock,
}))

vi.mock('@/lib/procurar-datas/v2/progresso-compat-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/procurar-datas/v2/progresso-compat-store')>()
  return {
    ...real,
    salvarProgressoCompat: salvarProgressoMock,
  }
})

function criarRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/procurar-datas/v2/pesquisar-compat-async', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const payloadBase = {
  cep: '81830-020',
  enderecoCompleto: 'Rua Cornelius Pries, 669, Xaxim, Curitiba - PR',
  logradouro: 'Rua Cornelius Pries',
  numero: '669',
  bairro: 'Xaxim',
  cidade: 'Curitiba',
  uf: 'PR',
  dataInicial: '2026-08-14',
  tempoNecessario: '00:40',
  isRural: false,
  isCondominio: true,
  isEncomenda: false,
  tipoBerco: 'Berco padrao',
  comoda: 'Comoda padrao',
  roupeiro: '',
  poltrona: '',
  painel: '',
  destLat: -25.5091859,
  destLng: -49.267177,
}

const configMock = {
  planilhaDaAgenda: '',
  planilhaDeTempoDisponivel: '',
  planilhaDoCep: '',
  supabaseTable: '',
  diasPesquisaAgenda: 45,
  osrmBaseUrl: 'https://osrm.lebebe.cloud/',
  kmAdicionalMaxNaRotaM: 5000,
  kmMaximoNaSemanaM: 5000,
  kmMaximoNoSabadoM: 5000,
  kmAdicionalMaxNaRotaEspecialM: 8000,
  kmAdicionalMaxNaRotaPremiumM: 12000,
  kmMaxEntrePontosKm: 30,
  valorAdicionalRotaEspecial: 70,
  valorAdicionalRotaPremium: 120,
  horaMarcadaHorasAMais: 2,
  horaMarcadaValorAdicional: 80,
  equipe1Ativa: true,
  equipe2Ativa: false,
  enderecoDeposito: 'Deposito',
  enderecoCasaEqp1: '',
  enderecoCasaEqp2: '',
  latDeposito: -25.4876648,
  lngDeposito: -49.2692262,
  latCasaE1: -25.1,
  lngCasaE1: -49.1,
  latCasaE2: -25.2,
  lngCasaE2: -49.2,
  kmMaxViagem: 80,
  kmMaxValorFixo: 10,
  kmMaxLongaCidade: 25,
  kmMaxNaoViagem: 50,
  valorSemanaAte10km: 130,
  valorSabadoAte10km: 200,
  valorDiaApos25kmSemana: 50,
  valorDiaApos25kmSabado: 80,
  precoCondominioAdicional: 30,
  fatorMultiplicadorKmViagem: 8,
  multiplicadorKmNaoViagem: 12,
  tempoMaximoViagemSabadoMin: 60,
}

function saidaV2Ok() {
  return {
    ok: true,
    modo: 'v2-pesquisar-paralelo',
    resultadoFinal: {
      candidatosFinais: [
        {
          dataISO: '2026-08-14',
          equipe: 'EQUIPE 1',
          tipo: 'normal',
          rank: 1,
          elegivel: true,
          horaMarcada: false,
          kmAdicionalNaRotaM: 99999,
          origemKmAdicional: 'slot',
        },
      ],
      resumo: {
        totalRecebidos: 1,
        totalElegiveis: 1,
        totalRecortados: 1,
        normaisRecortados: 1,
        especiaisRecortados: 0,
        premiumsRecortados: 0,
        horaMarcadaRecortados: 0,
        maxNormaisAplicado: 3,
      },
      diasUsados: ['2026-08-14'],
    },
    diagnosticoMinimo: {
      osrmBaseUrlUsado: 'https://osrm.lebebe.cloud',
      osrmFallbackUsado: false,
      quantidadeSlotsComPontos: 0,
      quantidadeSlotsSemPontos: 1,
      slotsComKm: 1,
      slotsComFallbackHaversine: 0,
      cacheAgenda: { hashesConsultados: 0, hitsSupabase: 0, enderecosSemHash: 0 },
      avisos: [],
    },
  }
}

describe('POST /api/procurar-datas/v2/pesquisar-compat-async', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validarAcessoMock.mockResolvedValue({ response: null, auth: { authorized: true } })
    pesquisarDatasV2Mock.mockResolvedValue(saidaV2Ok())
    buscarConfigMock.mockResolvedValue({
      ok: true,
      config: configMock,
      origem: 'supabase',
      faltantesNoSupabase: [],
      usandoFallbackPlanilha: false,
      lido_em: '2026-06-23T00:00:00.000Z',
    })
    criarBuscarRotaMock.mockReturnValue(
      vi.fn().mockResolvedValue({ ok: true, distanciaM: 8000 })
    )
    salvarProgressoMock.mockResolvedValue(undefined)
  })

  it('retorna ok, clientToken e status done apos orquestrador concluir', async () => {
    const res = await POST(criarRequest(payloadBase))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(typeof json.clientToken).toBe('string')
    expect(json.clientToken.length).toBeGreaterThan(0)
    expect(json.status).toBe('done')
    expect(json.modo).toBe('v2-pesquisar-compat-async')
    expect(json.diagnosticoPerformanceV2).toBeUndefined()
  })

  it('com flag diagnostica retorna e salva diagnosticoPerformanceV2', async () => {
    const res = await POST(criarRequest({
      ...payloadBase,
      incluirDiagnosticoPerformanceV2: true,
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.diagnosticoPerformanceV2).toMatchObject({
      habilitado: true,
      versao: 2,
      fluxo: {
        postAguardaOrquestradorCompleto: true,
        pollingAguardaResultado: false,
      },
      tspMatriz: {
        usaOsrmTableMatriz: true,
        tspImplementado: false,
      },
    })
    expect(json.diagnosticoPerformanceV2.temposMs).toHaveProperty('orquestrador')
    expect(json.diagnosticoPerformanceV2.osrm.total.total).toBeGreaterThanOrEqual(1)
    expect(json.diagnosticoPerformanceV2.osrm.porTipo['deposito-destino'].total).toBe(1)

    const progressoDone = salvarProgressoMock.mock.calls[1][1]
    expect(progressoDone.diagnosticoPerformanceV2).toMatchObject({
      habilitado: true,
      versao: 2,
      temposMs: expect.objectContaining({
        orquestrador: expect.any(Number),
      }),
    })
  })

  it('com flag Santo Amaro retorna e salva diagnosticoResultadoTelaV2SantoAmaro', async () => {
    pesquisarDatasV2Mock.mockImplementation(async (_body: unknown, options?: { diagnosticoResultadoTelaV2SantoAmaro?: boolean }) => ({
      ...saidaV2Ok(),
      ...(options?.diagnosticoResultadoTelaV2SantoAmaro
        ? {
            diagnosticoResultadoTelaV2SantoAmaro: {
              executado: true,
              modo: 'diagnostico-resultado-tela-v2-santo-amaro',
              payloadExatoTelaEsperado: { dataInicial: '2026-06-26' },
            },
          }
        : {}),
    }))

    const res = await POST(criarRequest({
      ...payloadBase,
      dataInicial: '2026-06-26',
      usarDiagnosticoResultadoTelaV2SantoAmaro: true,
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.diagnosticoResultadoTelaV2SantoAmaro).toMatchObject({
      executado: true,
      modo: 'diagnostico-resultado-tela-v2-santo-amaro',
    })

    const progressoDone = salvarProgressoMock.mock.calls[1][1]
    expect(progressoDone.diagnosticoResultadoTelaV2SantoAmaro).toEqual(
      json.diagnosticoResultadoTelaV2SantoAmaro
    )
  })

  it('salva estado no Redis: primeiro queued, depois done com payload', async () => {
    await POST(criarRequest(payloadBase))

    expect(salvarProgressoMock).toHaveBeenCalledTimes(2)

    const primeiraChama = salvarProgressoMock.mock.calls[0]
    expect(primeiraChama[1]).toMatchObject({ status: 'queued' })

    const segundaChama = salvarProgressoMock.mock.calls[1]
    expect(segundaChama[1]).toMatchObject({ status: 'done' })
    expect(segundaChama[1].payload).toBeDefined()
    expect(Array.isArray(segundaChama[1].normais)).toBe(true)
    expect(Array.isArray(segundaChama[1].extras)).toBe(true)
  })

  it('usa clientToken do body quando fornecido', async () => {
    const body = { ...payloadBase, clientToken: 'meu-token-customizado' }
    const res = await POST(criarRequest(body))
    const json = await res.json()

    expect(json.clientToken).toBe('meu-token-customizado')
    expect(salvarProgressoMock.mock.calls[0][0]).toBe('meu-token-customizado')
  })

  it('gera clientToken automatico quando nao fornecido', async () => {
    const res = await POST(criarRequest(payloadBase))
    const json = await res.json()

    expect(typeof json.clientToken).toBe('string')
    expect(json.clientToken.length).toBeGreaterThan(10)
  })

  it('frete vem do payload/orquestrador, nao de kmAdicionalNaRotaM', async () => {
    await POST(criarRequest(payloadBase))

    const segundaChama = salvarProgressoMock.mock.calls[1]
    const progressoDone = segundaChama[1]
    const candidates = progressoDone.payload?.candidates ?? []
    if (candidates.length > 0) {
      expect(typeof candidates[0].frete).toBe('string')
    }
    expect(progressoDone.status).toBe('done')
  })

  it('salva status error no Redis e retorna erro controlado quando orquestrador lanca excecao', async () => {
    pesquisarDatasV2Mock.mockRejectedValue(new Error('OSRM timeout simulado'))

    const res = await POST(criarRequest(payloadBase))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.ok).toBe(false)
    expect(json.status).toBe('error')
    expect(typeof json.error).toBe('string')

    const chamadas = salvarProgressoMock.mock.calls
    const chamadaError = chamadas.find(
      (c: unknown[]) => (c[1] as { status: string }).status === 'error'
    )
    expect(chamadaError).toBeDefined()
    expect(chamadaError![1].status).toBe('error')
  })

  it('retorna acesso negado sem executar motor nem salvar Redis', async () => {
    validarAcessoMock.mockResolvedValue({
      response: NextResponse.json({ ok: false, error: 'Nao autorizado' }, { status: 401 }),
    })

    const res = await POST(criarRequest(payloadBase))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Nao autorizado')
    expect(pesquisarDatasV2Mock).not.toHaveBeenCalled()
    expect(salvarProgressoMock).not.toHaveBeenCalled()
  })
})
