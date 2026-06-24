import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'

const validarAcessoMock = vi.hoisted(() => vi.fn())
const pesquisarDatasV2Mock = vi.hoisted(() => vi.fn())
const buscarConfigMock = vi.hoisted(() => vi.fn())
const criarBuscarRotaMock = vi.hoisted(() => vi.fn())

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

function criarRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/procurar-datas/v2/pesquisar-compat', {
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
      cacheAgenda: {
        hashesConsultados: 0,
        hitsSupabase: 0,
        enderecosSemHash: 0,
      },
      avisos: [],
    },
  }
}

describe('POST /api/procurar-datas/v2/pesquisar-compat', () => {
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
  })

  it('executa rota autorizada com dependencias reais injetadas no orquestrador', async () => {
    const res = await POST(criarRequest(payloadBase))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.modo).toBe('v2-pesquisar-compat')
    expect(json.payload.candidates).toHaveLength(1)
    expect(json.payload.candidates[0]).toMatchObject({
      date: '2026-08-14',
      frete: 'R$ 200',
      tipo: 'normal',
    })
    expect(json.diagnosticoPayloadLegado).toMatchObject({
      fretesMontados: 1,
      freteOrigem: 'dist-km-deposito-destino',
    })
    expect(pesquisarDatasV2Mock).toHaveBeenCalledWith(payloadBase)
    expect(buscarConfigMock).toHaveBeenCalledTimes(1)
    expect(criarBuscarRotaMock).toHaveBeenCalledWith({
      baseUrl: 'https://osrm.lebebe.cloud',
      timeoutMs: 10000,
    })
  })

  it('retorna acesso negado sem executar motor nem config', async () => {
    validarAcessoMock.mockResolvedValue({
      response: NextResponse.json({ ok: false, error: 'Nao autorizado' }, { status: 401 }),
    })

    const res = await POST(criarRequest(payloadBase))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Nao autorizado')
    expect(pesquisarDatasV2Mock).not.toHaveBeenCalled()
    expect(buscarConfigMock).not.toHaveBeenCalled()
  })
})
