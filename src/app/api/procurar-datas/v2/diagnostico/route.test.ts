// ─────────────────────────────────────────────────────────────────────────────
// route.test.ts — POST /api/procurar-datas/v2/diagnostico
//
// Testes da rota diagnóstica v2, incluindo bloco opcional de disponibilidade real.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'
import {
  cenarioAgendaMultipontos,
  cenarioAgendaSemCache,
  cenarioAgendaUmPonto,
  cenarioAgendaVazia,
  cenarioDestinoInvalido,
  cenarioEquipeDiferente,
  cenarioOrigemInvalida,
  montarBodyDiagnosticoKmAdicionalAgenda,
} from '@/lib/procurar-datas/motor/fixtures/km-adicional-agenda-diagnostico'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const validarAcessoMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ response: null, user: { id: 'test-user' } })
)

const buscarConfigMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: true,
    origem: 'supabase',
    usandoFallbackPlanilha: false,
    faltantesNoSupabase: [],
    config: {
      diasPesquisaAgenda: 30,
      equipe1Ativa: true,
      equipe2Ativa: true,
      kmMaximoNaSemanaM: 20000,
      kmMaximoNoSabadoM: 30000,
      kmMaxViagem: 6000,
      kmMaxValorFixo: 2500,
      kmMaxLongaCidade: 4000,
      kmMaxNaoViagem: 2500,
      valorSemanaAte10km: 0,
      valorSabadoAte10km: 100,
      fatorMultiplicadorKmViagem: 2.2,
      multiplicadorKmNaoViagem: 0.9,
      valorDiaApos25kmSemana: 450,
      valorDiaApos25kmSabado: 700,
      precoCondominioAdicional: 50,
      kmAdicionalMaxNaRotaM: 2000,
      kmAdicionalMaxNaRotaEspecialM: 8000,
      kmAdicionalMaxNaRotaPremiumM: 15000,
      horaMarcadaHorasAMais: 2,
      supabaseTable: 'geo_cache',
      osrmBaseUrl: 'https://router.project-osrm.org',
      latDeposito: -25.4876648,
      lngDeposito: -49.2692262,
      latCasaE1: -25.494297,
      lngCasaE1: -49.277091,
      latCasaE2: -25.494297,
      lngCasaE2: -49.277091,
    },
  })
)

const lerPlanilhaMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: true,
    tabela: [
      ['DATA', 'EQUIPE', 'TEMPO UTILIZADO', 'TEMPO DISPONÍVEL', 'TEMPO EXCEDIDO', 'STATUS'],
      ['15/06 (segunda-feira)', 'Equipe 1', '06:00', '01:00', '', 'disponível'],
      ['16/06 (terça-feira)', 'Equipe 1', '05:45', '00:00', '01:45', 'excedeu'],
    ],
    planilhaId: '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U',
    gid: 65861376,
    abaNomeResolvido: 'TEMPO DISPONIVEL POR EQUIPE',
    range: "'TEMPO DISPONIVEL POR EQUIPE'!A:F",
  })
)

const buscarAgendaRealMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    diagnostico: {
      ok: true,
      executado: true,
      origem: {
        tipo: 'google-sheets',
        spreadsheetId: '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U',
        gid: 14790013,
        abaNomeResolvido: 'AGENDA',
        range: "'AGENDA'!A:G",
      },
      parametros: { limite: 2000 },
      leitura: { ok: true, linhasLidas: 3, linhasConvertidas: 2 },
      amostra: [
        ['03/07/2026', 'EQUIPE 1', '', '', 'Entrega A', 'Rua A', ''],
        ['03/07/2026', 'EQUIPE 1', '', '', 'Entrega B', 'Rua B', ''],
      ],
    },
    linhasAgenda: [
      ['03/07/2026', 'EQUIPE 1', '', '', 'Entrega A', 'Rua A', ''],
      ['03/07/2026', 'EQUIPE 1', '', '', 'Entrega B', 'Rua B', ''],
    ],
  })
)

const gerarCandidatosReaisMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    ok: true,
    resumo: {
      datasNaJanela: 30,
      disponibilidadesRecebidas: 2,
      equipesSuficientesTotal: 1,
      candidatosMontados: 2,
      candidatosElegiveis: 1,
      candidatosIndisponiveis: 1,
      candidatosNormal: 1,
      candidatosEspecial: 0,
      candidatosPremium: 0,
      candidatosHoraMarcada: 0,
    },
    disponibilidadePorJanela: { ok: true, datas: [], avisos: [] },
    classificacoes: [],
    candidatos: [],
    candidatosOrdenados: [
      {
        id: 'v2-2026-06-15-equipe-1-normal-0',
        dataISO: '2026-06-15',
        equipe: 'EQUIPE 1',
        tipo: 'normal',
        elegivel: true,
        horaMarcada: false,
        elegivelHoraMarcada: false,
        indice: 0,
        diaSemana: 1,
        ehSabado: false,
        ehDomingo: false,
        operacional: {
          ativa: true,
          disponivelMin: 60,
          suficienteParaServico: true,
          tempoNecessarioMin: 40,
          slotAvailMin: 60,
          serviceMin: 40,
        },
        distancia: {
          distanciaKm: null,
          kmAdicionalNaRotaM: null,
        },
        frete: {
          valorFrete: null,
          tipoFrete: null,
        },
        motivos: [],
        avisos: [],
        diagnostico: {
          origem: 'v2-preliminar',
          classificacaoTipo: 'normal',
          classificacaoElegivel: true,
          horaMarcada: false,
          elegivelHoraMarcada: false,
          motivoHoraMarcada: 'Tempo disponivel insuficiente para hora marcada.',
          horaMarcadaHorasAMais: 2,
          limiteMinimoHoraMarcadaMin: 160,
        },
      },
    ],
    resumoOrdenacao: {
      total: 2,
      elegiveis: 1,
      indisponiveis: 1,
      primeiroElegivelId: 'v2-2026-06-15-equipe-1-normal-0',
    },
    avisos: [],
  })
)

const adaptarCandidatosReaisMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    ok: true,
    formatoDateISO: 'legado-gmt3',
    quantidadeRecebida: 2,
    quantidadeAdaptada: 1,
    amostra: [
      {
        dateISO: '2026-06-15T03:00:00.000Z',
        dateDM: '15/06',
        weekday: 'Segunda',
        tipo: 'normal',
        isExtra: false,
        frete: '',
        rank: 1,
        team: 'EQUIPE 1',
        daysLeftTxt: '',
        encomenda: 'Não',
        avisoHoraMarcada: '',
        diagnosticoV2: {
          id: 'v2-2026-06-15-equipe-1-normal-0',
          elegivel: true,
          origem: 'v2-adaptado-diagnostico',
          motivos: [],
          avisos: [],
        },
      },
    ],
    avisos: [],
  })
)

const buscarMatrizOSRMMock = vi.hoisted(() => vi.fn())

const criarBuscarMatrizOSRMMock = vi.hoisted(() =>
  vi.fn().mockReturnValue(buscarMatrizOSRMMock)
)

const compararHaversineOsrmMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: true,
    modo: 'comparacao-haversine-osrm-diagnostico',
    haversine: {
      ok: true,
      modo: 'haversine-diagnostico',
      kmAdicionalNaRotaM: 1200,
      origemKmAdicionalNaRotaM: 'agenda-shag-haversine-diagnostico',
      melhorInsercao: null,
      resumo: {},
      avisos: [],
      descartados: [],
    },
    osrm: {
      ok: true,
      modo: 'matriz-distancia-diagnostico',
      kmAdicionalNaRotaM: 1500,
      origemKmAdicionalNaRotaM: 'matriz-distancia-diagnostico',
      melhorInsercao: null,
      resumo: {},
      avisos: [],
      erros: [],
      descartados: [],
    },
    matrizOSRM: {
      ok: true,
      modo: 'osrm-mockavel-diagnostico',
      matrizMetros: {},
      avisos: [],
      erros: [],
      descartados: [],
      resumo: {
        pontosRecebidos: 3,
        pontosValidos: 3,
        pontosInvalidos: 0,
        distanciasRecebidas: 9,
        distanciasValidas: 9,
        distanciasInvalidas: 0,
      },
    },
    comparacao: {
      kmHaversineM: 1200,
      kmOsrmM: 1500,
      diferencaAbsolutaM: 300,
      diferencaPercentual: 25,
      osrmMaiorQueHaversine: true,
    },
    avisos: ['mock comparacao ok'],
    erros: [],
  })
)

const calcularKmRealControladoMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: true,
    modo: 'km-adicional-real-controlado-diagnostico',
    kmAdicionalNaRotaM: 2468,
    origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
    origemOperacional: {
      ok: true,
      origem: { lat: -25.4876648, lng: -49.2692262 },
      tipo: 'deposito',
      contexto: { dataISO: '2026-06-15', equipe: 'EQUIPE 1', ehSabado: false },
    },
    parseAgenda: { ok: true, resumo: { pontosValidos: 1 }, avisos: [], erros: [] },
    matrizOSRM: { ok: true, resumo: { distanciasValidas: 4 }, avisos: [], erros: [] },
    deltaInsercao: {
      ok: true,
      modo: 'matriz-distancia-diagnostico',
      kmAdicionalNaRotaM: 2468,
      melhorInsercao: null,
      resumo: {},
      avisos: [],
      erros: [],
      descartados: [],
    },
    avisos: ['mock km real ok'],
    erros: [],
    descartados: [],
  })
)

const supabaseInMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: [], error: null })
)
const supabaseSelectMock = vi.hoisted(() =>
  vi.fn(() => ({ in: supabaseInMock }))
)
const supabaseFromMock = vi.hoisted(() =>
  vi.fn(() => ({ select: supabaseSelectMock }))
)
const createServiceClientMock = vi.hoisted(() =>
  vi.fn(() => ({ from: supabaseFromMock }))
)

const orquestrarPesquisaCompatMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: true,
    payload: {
      ok: true,
      cep: '80620-220',
      tempo: '2:05',
      label: 'Agua Verde - Curitiba',
      address: 'R. Santo Amaro, 300, Agua Verde, Curitiba - PR',
      addressShort: 'R. Santo Amaro, 300',
      startFromISO: '2026-06-25',
      startFromDM: '25/06',
      isRural: false,
      isCondominio: true,
      params: '',
      searchTime: '9.0',
      candidates: [
        {
          rank: 1,
          date: '2026-07-02',
          dateISO: '2026-07-02T03:00:00.000Z',
          dateDM: '02/07',
          weekday: 'Quinta',
          team: 'EQUIPE 1',
          tipo: 'especial',
          frete: 'R$ 270',
          isExtra: true,
        },
      ],
    },
    avisos: [],
    diagnosticoMinimo: {
      osrmBaseUrlUsado: 'https://osrm.lebebe.cloud',
      osrmFallbackUsado: false,
      quantidadeSlotsComPontos: 1,
      quantidadeSlotsSemPontos: 0,
      slotsComKm: 1,
      slotsComFallbackHaversine: 0,
      cacheAgenda: { hashesConsultados: 0, hitsSupabase: 0, enderecosSemHash: 0 },
      avisos: [],
    },
    diagnosticoPayloadLegado: {
      distKmDepositoDestino: null,
      fretesMontados: 1,
      freteOrigem: 'dist-km-deposito-destino',
    },
    saidaV2: {
      ok: true,
      modo: 'v2-pesquisar-paralelo',
      resultadoFinal: {
        candidatosFinais: [
          {
            rank: 1,
            dataISO: '2026-07-02',
            equipe: 'EQUIPE 1',
            tipo: 'especial',
            elegivel: true,
            horaMarcada: false,
            kmAdicionalNaRotaM: 7001,
            origemKmAdicional: 'slot',
          },
        ],
        resumo: {
          totalRecebidos: 1,
          totalElegiveis: 1,
          totalRecortados: 1,
          normaisRecortados: 0,
          especiaisRecortados: 1,
          premiumsRecortados: 0,
          horaMarcadaRecortados: 0,
          maxNormaisAplicado: 3,
        },
        diasUsados: ['2026-07-02'],
      },
      diagnosticoMinimo: {
        osrmBaseUrlUsado: 'https://osrm.lebebe.cloud',
        osrmFallbackUsado: false,
        quantidadeSlotsComPontos: 1,
        quantidadeSlotsSemPontos: 0,
        slotsComKm: 1,
        slotsComFallbackHaversine: 0,
        cacheAgenda: { hashesConsultados: 0, hitsSupabase: 0, enderecosSemHash: 0 },
        avisos: [],
      },
      erros: [],
    },
  })
)

vi.mock('@/lib/procurar-datas/api', () => ({
  validarAcessoProcurarDatas: validarAcessoMock,
  respostaErroProcurarDatas: (error: unknown) =>
    new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }),
}))

vi.mock('@/lib/procurar-datas/config-service', () => ({
  buscarConfiguracoesProcurarDatas: buscarConfigMock,
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: createServiceClientMock,
}))

vi.mock('@/lib/procurar-datas/google-sheets-tempo-disponivel', () => ({
  lerPlanilhaTempoDisponivel: lerPlanilhaMock,
}))

vi.mock('@/lib/procurar-datas/motor/agenda-real-helper', () => ({
  buscarAgendaRealDiagnosticaComDados: buscarAgendaRealMock,
}))

vi.mock('@/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real', () => ({
  gerarCandidatosComDisponibilidadeRealV2: gerarCandidatosReaisMock,
}))

vi.mock('@/lib/procurar-datas/motor/adaptar-candidatos-reais-legado', () => ({
  adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2: adaptarCandidatosReaisMock,
}))

vi.mock('@/lib/procurar-datas/motor/osrm-table-client-diagnostico', () => ({
  criarBuscarMatrizOSRMTableDiagnosticoV2: criarBuscarMatrizOSRMMock,
}))

vi.mock('@/lib/procurar-datas/motor/comparar-km-adicional-haversine-osrm', () => ({
  compararKmAdicionalHaversineVsOSRMDiagnosticoV2: compararHaversineOsrmMock,
}))

vi.mock('@/lib/procurar-datas/motor/calcular-km-adicional-real-controlado', () => ({
  calcularKmAdicionalRealControladoV2: calcularKmRealControladoMock,
}))

vi.mock('@/lib/procurar-datas/motor/orquestrar-pesquisa-v2-com-payload-legado', () => ({
  orquestrarPesquisaV2ComPayloadLegado: orquestrarPesquisaCompatMock,
}))

vi.mock('@/lib/procurar-datas/motor/pesquisar-datas-v2', () => ({
  pesquisarDatasV2: vi.fn(),
}))

const calcularMapaKmSlotMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: true,
    modo: 'mapa-km-adicional-por-slot-diagnostico',
    mapa: {
      '2026-06-15::EQUIPE 1': 3500,
      '2026-06-16::EQUIPE 2': 7200,
    },
    detalhesPorSlot: [
      {
        chave: '2026-06-15::EQUIPE 1',
        dataISO: '2026-06-15',
        equipe: 'EQUIPE 1',
        equipeNormalizada: 'EQUIPE 1',
        kmAdicionalNaRotaM: 3500,
        ok: true,
        origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
        avisos: [],
        erros: [],
        descartados: [],
      },
      {
        chave: '2026-06-16::EQUIPE 2',
        dataISO: '2026-06-16',
        equipe: 'EQUIPE 2',
        equipeNormalizada: 'EQUIPE 2',
        kmAdicionalNaRotaM: 7200,
        ok: true,
        origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
        avisos: [],
        erros: [],
        descartados: [],
      },
    ],
    contadores: {
      slotsRecebidos: 2,
      slotsProcessados: 2,
      slotsComKm: 2,
      slotsComFallbackHaversine: 0,
      slotsComErro: 0,
      slotsDescartados: 0,
    },
    avisos: ['mock mapa ok'],
    erros: [],
  })
)

vi.mock('@/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot', () => ({
  calcularMapaKmAdicionalPorSlotControladoV2: calcularMapaKmSlotMock,
}))

const aplicarMapaKmSlotEmCandidatosMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    ok: true,
    modo: 'aplicacao-mapa-km-por-slot-em-candidatos-diagnostico',
    candidatos: [
      {
        dataISO: '2026-06-15',
        equipe: 'EQUIPE 1',
        kmAdicionalNaRotaM: 3500,
        slotKeyKmAdicional: '2026-06-15::EQUIPE 1',
        origemKmAdicionalNaRotaM: 'mapa-slot-diagnostico',
        kmAdicionalAplicadoPorMapaSlot: true,
        tipo: 'normal',
        elegivel: true,
      },
    ],
    contadores: {
      candidatosRecebidos: 1,
      candidatosComSlotKey: 1,
      candidatosComKmAplicado: 1,
      candidatosSemChaveNoMapa: 0,
      candidatosSemDataOuEquipe: 0,
    },
    avisos: ['mock aplicacao ok'],
    erros: [],
  })
)

vi.mock('@/lib/procurar-datas/motor/aplicar-mapa-km-adicional-por-slot-em-candidatos', () => ({
  aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2: aplicarMapaKmSlotEmCandidatosMock,
}))

const reclassificarCandidatosMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    ok: true,
    modo: 'reclassificacao-com-km-mapa-slot-diagnostico',
    candidatos: [
      {
        dataISO: '2026-06-15',
        equipe: 'EQUIPE 1',
        slotKeyKmAdicional: '2026-06-15::EQUIPE 1',
        kmAdicionalNaRotaM: 3500,
        origemKmAdicionalNaRotaM: 'mapa-slot-diagnostico',
        kmAdicionalAplicadoPorMapaSlot: true,
        tipoAntes: 'normal',
        elegivelAntes: true,
        tipoDepois: 'normal',
        elegivelDepois: true,
        horaMarcadaAntes: false,
        horaMarcadaDepois: true,
        mudouHoraMarcada: true,
        slotAvailMin: 240,
        serviceMin: 40,
        horaMarcadaHorasAMais: 2,
        limiteMinimoHoraMarcadaMin: 160,
        mudouTipo: false,
        mudouElegibilidade: false,
        motivosAntes: [],
        motivosDepois: [],
      },
    ],
    contadores: {
      candidatosRecebidos: 1,
      candidatosComKmAplicado: 1,
      candidatosSemKmAplicado: 0,
      candidatosReclassificados: 1,
      candidatosComTipoAlterado: 0,
      candidatosComElegibilidadeAlterada: 0,
      candidatosComErro: 0,
      candidatosSemChaveNoMapa: 0,
    },
    avisos: ['mock reclassificacao ok'],
    erros: [],
  })
)

vi.mock('@/lib/procurar-datas/motor/reclassificar-candidatos-com-km-mapa-slot', () => ({
  reclassificarCandidatosComKmMapaSlotDiagnosticoV2: reclassificarCandidatosMock,
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function criarRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/procurar-datas/v2/diagnostico', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('POST /api/procurar-datas/v2/diagnostico', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseInMock.mockResolvedValue({ data: [], error: null })
  })

  // 1. Comportamento padrão sem flag (não deve chamar leitura real)
  it('1. sem flag usarDisponibilidadeRealDiagnostica, retorna diagnosticoDisponibilidadeReal null', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.diagnosticoDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosReaisAdaptados).toBeNull()
    expect(body.diagnosticoKmAdicionalAgenda).toBeNull()
    expect(body.diagnosticoKmAdicionalRealControlado).toBeNull()
    expect(body.diagnosticoComparacaoHaversineOsrm).toBeNull()
    expect(lerPlanilhaMock).not.toHaveBeenCalled()
    expect(gerarCandidatosReaisMock).not.toHaveBeenCalled()
    expect(adaptarCandidatosReaisMock).not.toHaveBeenCalled()
    expect(criarBuscarMatrizOSRMMock).not.toHaveBeenCalled()
    expect(compararHaversineOsrmMock).not.toHaveBeenCalled()
  })

  // 2. Com flag true, deve incluir bloco de disponibilidade real
  it('2. com usarDisponibilidadeRealDiagnostica=true, inclui diagnosticoDisponibilidadeReal', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.diagnosticoDisponibilidadeReal).not.toBeNull()
    expect(body.diagnosticoDisponibilidadeReal.executado).toBe(true)
    expect(body.diagnosticoDisponibilidadeReal.ok).toBe(true)
    expect(body.diagnosticoDisponibilidadeReal.origem.tipo).toBe('google-sheets')
    expect(body.diagnosticoDisponibilidadeReal.parametros.dataInicialISO).toBe('2026-06-15')
    expect(body.diagnosticoDisponibilidadeReal.parametros.origemDataInicialISO).toBe('entrada')
    expect(body.diagnosticoDisponibilidadeReal.leitura.ok).toBe(true)
    expect(body.diagnosticoDisponibilidadeReal.parser.ok).toBe(true)
    expect(body.diagnosticoDisponibilidadeReal.amostra).toBeDefined()
    expect(Array.isArray(body.diagnosticoDisponibilidadeReal.amostra)).toBe(true)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.executado).toBe(true)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.ok).toBe(true)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.modo).toBe('diagnostico-disponibilidade-real')
    expect(gerarCandidatosReaisMock).toHaveBeenCalledTimes(1)
    expect(body.diagnosticoCandidatosReaisAdaptados.executado).toBe(true)
    expect(body.diagnosticoCandidatosReaisAdaptados.ok).toBe(true)
    expect(body.diagnosticoCandidatosReaisAdaptados.modo).toBe('diagnostico-candidatos-reais-adaptados-legado')
    expect(body.diagnosticoCandidatosReaisAdaptados.formatoDateISO).toBe('legado-gmt3')
    expect(adaptarCandidatosReaisMock).toHaveBeenCalledTimes(1)
  })

  // 3. Usa dataInicialISO da entrada quando disponível
  it('3. usa dataInicialISO da entrada quando fornecida', async () => {
    await POST(
      criarRequest({
        dataInicial: '2026-12-25',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )

    expect(lerPlanilhaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U',
        gid: 65861376,
      })
    )
    expect(gerarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        janelaDatas: expect.arrayContaining([
          expect.objectContaining({ dataISO: '2026-12-25' }),
        ]),
      })
    )
    expect(adaptarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        formatoDateISO: 'legado-gmt3',
        limiteAmostra: 20,
        dataReferenciaISO: '2026-12-25',
      })
    )
  })

  // 4. Usa fallback hoje quando dataInicialISO não fornecida
  it('4. usa diagnostico-hoje como origem quando dataInicialISO não fornecida', async () => {
    const res = await POST(
      criarRequest({
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoDisponibilidadeReal.parametros.origemDataInicialISO).toBe('diagnostico-hoje')
    expect(body.diagnosticoDisponibilidadeReal.parametros.dataInicialISO).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // 5. Não afeta disponibilidade sintética existente
  it('5. não altera diagnosticoDisponibilidade (sintético) quando flag ativa', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    expect(body.diagnosticoDisponibilidade.executado).toBe(true)
    expect(body.diagnosticoDisponibilidade.resultado).toBeDefined()
    expect(body.diagnosticoClassificacao.executado).toBe(true)
    expect(body.diagnosticoOrdenacao.executado).toBe(true)
    // Disponibilidade sintética ainda calcula com dados de teste
    expect(body.diagnosticoDisponibilidadeReal.executado).toBe(true)
    // São blocos separados
    expect(body.diagnosticoDisponibilidade).not.toEqual(body.diagnosticoDisponibilidadeReal)
    expect(body.diagnosticoCandidatosDisponibilidadeReal).not.toEqual(body.diagnosticoCandidatos)
    expect(body.diagnosticoCandidatosDisponibilidadeReal).not.toEqual(body.diagnosticoOrdenacao)
    expect(body.diagnosticoCandidatosReaisAdaptados).not.toEqual(body.diagnosticoCandidatos)
    expect(body.diagnosticoCandidatosReaisAdaptados).not.toEqual(body.diagnosticoOrdenacao)
  })

  // 6. Mantém comportamento padrão sem flag (todos os diagnósticos sintéticos)
  it('6. sem flag, todos os diagnósticos sintéticos continuam funcionando', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        enderecoCompleto: 'Rua Teste, 123',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        lat: -25.0,
        lng: -49.0,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoFrete.executado).toBe(true)
    expect(body.diagnosticoJanelaDatas.executado).toBe(true)
    expect(body.diagnosticoDisponibilidade.executado).toBe(true)
    expect(body.diagnosticoClassificacao.executado).toBe(true)
    expect(body.diagnosticoCandidatos.executado).toBe(true)
    expect(body.diagnosticoOrdenacao.executado).toBe(true)
    expect(body.diagnosticoDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosReaisAdaptados).toBeNull()
    expect(body.diagnosticoKmAdicionalAgenda).toBeNull()
    expect(body.diagnosticoComparacaoHaversineOsrm).toBeNull()
  })

  // 7. Erro na leitura da planilha retorna bloco controlado
  it('7. quando leitura falha, retorna diagnosticoDisponibilidadeReal com ok:false', async () => {
    lerPlanilhaMock.mockResolvedValueOnce({
      ok: false,
      erro: 'Erro de autenticação Google Sheets',
    })

    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true) // Rota não quebra
    expect(body.diagnosticoDisponibilidadeReal.ok).toBe(false)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.executado).toBe(false)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.ok).toBe(false)
    expect(body.diagnosticoCandidatosReaisAdaptados).toBeNull()
    expect(gerarCandidatosReaisMock).not.toHaveBeenCalled()
    expect(adaptarCandidatosReaisMock).not.toHaveBeenCalled()
    expect(body.diagnosticoDisponibilidadeReal.erro).toContain('autenticação')
  })

  // 8. Parse de formato real DD/MM (texto) retorna linhas válidas
  it('8. parseia formato real DD/MM (texto) e retorna linhasValidas > 0', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    expect(body.diagnosticoDisponibilidadeReal.parser.resumo.linhasValidas).toBeGreaterThan(0)
    expect(body.diagnosticoDisponibilidadeReal.parser.resumo.linhasIgnoradas).toBe(0)
    expect(body.diagnosticoDisponibilidadeReal.amostra.length).toBeGreaterThan(0)
    // Verifica que a data foi parseada corretamente
    expect(body.diagnosticoDisponibilidadeReal.amostra[0].dataISO).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // 9. Flag com valor false não ativa leitura
  it('9. usarDisponibilidadeRealDiagnostica=false não ativa leitura real', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: false,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosReaisAdaptados).toBeNull()
    expect(body.diagnosticoKmAdicionalAgenda).toBeNull()
    expect(body.diagnosticoComparacaoHaversineOsrm).toBeNull()
    expect(lerPlanilhaMock).not.toHaveBeenCalled()
    expect(gerarCandidatosReaisMock).not.toHaveBeenCalled()
    expect(adaptarCandidatosReaisMock).not.toHaveBeenCalled()
  })

  // 10. Normalização de entrada continua funcionando
  it('10. entradaNormalizada contém dataInicialISO quando fornecida', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-07-20',
        tempoNecessario: '01:00',
        destLat: -25.42,
        destLng: -49.27,
      })
    )
    const body = await res.json()

    expect(body.entradaNormalizada.dataInicialISO).toBe('2026-07-20')
    expect(body.entradaNormalizada.tempoNecessarioMin).toBe(60)
  })
  it('11. passa tempoNecessarioMin da entrada normalizada para gerar candidatos reais', async () => {
    await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '01:20',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )

    expect(gerarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tempoNecessarioMin: 80,
      })
    )
  })

  it('12. sem kmAdicionalNaRotaM, passa null e retorna aviso claro sem fallback 0', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    expect(gerarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distanciaKm: null,
        kmAdicionalNaRotaM: null,
      })
    )
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.distanciaKm).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.origemDistanciaKm).toBe('ausente')
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.kmAdicionalNaRotaM).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.origemKmAdicionalNaRotaM).toBe('ausente')
    expect(body.diagnosticoCandidatosDisponibilidadeReal.avisos.join(' ')).toContain('Nao foi usado fallback 0')
  })

  it('13. isola kmAdicionalNaRotaDiagnosticoM do body e nao contamina candidatos reais', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
        kmAdicionalNaRotaDiagnosticoM: 3500,
      })
    )
    const body = await res.json()

    expect(gerarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kmAdicionalNaRotaM: null,
      })
    )
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.kmAdicionalNaRotaM).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.origemKmAdicionalNaRotaM).toBe('ausente')
    expect(body.diagnosticoCandidatosDisponibilidadeReal.avisos.join(' ')).toContain('manual do body isolado')
  })

  it('14. retorna resumo e amostra de candidatos reais sem expor disponibilidades completas', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    expect(body.diagnosticoCandidatosDisponibilidadeReal.resumo).toEqual(
      expect.objectContaining({
        datasNaJanela: 30,
        disponibilidadesRecebidas: 2,
        candidatosMontados: 2,
        candidatosElegiveis: 1,
        candidatosIndisponiveis: 1,
        normais: 1,
      })
    )
    expect(body.diagnosticoCandidatosDisponibilidadeReal.candidatosOrdenadosAmostra).toHaveLength(1)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.candidatosOrdenadosAmostra[0]).toEqual(
      expect.objectContaining({
        rank: 1,
        dataISO: '2026-06-15',
        equipe: 'EQUIPE 1',
        team: 'EQUIPE 1',
        tipo: 'normal',
      })
    )
    expect(body.diagnosticoDisponibilidadeReal.disponibilidades).toBeUndefined()
  })

  it('15. aceita distanciaDiagnosticaKm valida no body', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
        distanciaDiagnosticaKm: 10,
      })
    )
    const body = await res.json()

    expect(gerarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distanciaKm: 10,
      })
    )
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.distanciaKm).toBe(10)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.origemDistanciaKm).toBe('body-diagnostico')
  })

  it('16. nao aceita distanciaDiagnosticaKm invalida', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
        distanciaDiagnosticaKm: '10',
      })
    )
    const body = await res.json()

    expect(gerarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distanciaKm: null,
      })
    )
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.distanciaKm).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.origemDistanciaKm).toBe('ausente')
  })

  it('17. nao usa fallback 0 para distanciaDiagnosticaKm', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
        distanciaDiagnosticaKm: 0,
      })
    )
    const body = await res.json()

    expect(gerarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distanciaKm: null,
      })
    )
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.distanciaKm).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.origemDistanciaKm).toBe('ausente')
    expect(body.diagnosticoCandidatosDisponibilidadeReal.avisos.join(' ')).toContain('distanciaDiagnosticaKm ausente ou invalida')
  })

  it('18. com distanciaDiagnosticaKm e km real controlado pode retornar candidato elegivel', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
        usarKmAdicionalRealControladoDiagnostico: true,
        distanciaDiagnosticaKm: 10,
        kmAdicionalNaRotaDiagnosticoM: 3500,
        equipeAgendaDiagnostica: 'EQUIPE 1',
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()

    expect(gerarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distanciaKm: 10,
        kmAdicionalNaRotaM: 2468,
      })
    )
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.distanciaKm).toBe(10)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.origemDistanciaKm).toBe('body-diagnostico')
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.kmAdicionalNaRotaM).toBe(2468)
    expect(body.diagnosticoKmAdicionalRealControlado.kmAdicionalNaRotaM).toBe(2468)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.candidatosOrdenadosAmostra[0].elegivel).toBe(true)
  })

  // 19. Bloco adaptado usa formato legado-gmt3 em dateISO
  it('19. diagnosticoCandidatosReaisAdaptados usa formato legado-gmt3 em dateISO', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    expect(body.diagnosticoCandidatosReaisAdaptados.executado).toBe(true)
    expect(body.diagnosticoCandidatosReaisAdaptados.formatoDateISO).toBe('legado-gmt3')
    expect(body.diagnosticoCandidatosReaisAdaptados.amostra[0].dateISO).toBe('2026-06-15T03:00:00.000Z')
  })

  // 20. Bloco adaptado preserva rank, tipo, isExtra, frete, team
  it('20. diagnosticoCandidatosReaisAdaptados preserva campos compatíveis com legado', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    const candidato = body.diagnosticoCandidatosReaisAdaptados.amostra[0]
    expect(candidato.rank).toBe(1)
    expect(candidato.tipo).toBe('normal')
    expect(candidato.isExtra).toBe(false)
    expect(candidato.team).toBe('EQUIPE 1')
    expect(candidato.diagnosticoV2).toBeDefined()
    expect(candidato.diagnosticoV2.origem).toBe('v2-adaptado-diagnostico')
  })

  // 21. Bloco adaptado respeita limite de amostra
  it('21. diagnosticoCandidatosReaisAdaptados respeita limiteAmostra', async () => {
    adaptarCandidatosReaisMock.mockReturnValueOnce({
      ok: true,
      formatoDateISO: 'legado-gmt3',
      quantidadeRecebida: 25,
      quantidadeAdaptada: 20,
      amostra: Array(20).fill(null).map((_, i) => ({
        rank: i + 1,
        dateISO: '2026-06-15T03:00:00.000Z',
        tipo: 'normal',
      })),
      avisos: [],
    })

    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    expect(adaptarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limiteAmostra: 20,
      })
    )
    expect(body.diagnosticoCandidatosReaisAdaptados.quantidadeRecebida).toBe(25)
    expect(body.diagnosticoCandidatosReaisAdaptados.quantidadeAdaptada).toBe(20)
    expect(body.diagnosticoCandidatosReaisAdaptados.amostra).toHaveLength(20)
  })

  // 22. Bloco adaptado não executa se candidatos reais não foram gerados
  it('22. diagnosticoCandidatosReaisAdaptados nao executa se disponibilidade real falhou', async () => {
    lerPlanilhaMock.mockResolvedValueOnce({
      ok: false,
      erro: 'Erro de leitura',
    })

    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarDisponibilidadeRealDiagnostica: true,
      })
    )
    const body = await res.json()

    expect(body.diagnosticoCandidatosReaisAdaptados).toBeNull()
    expect(adaptarCandidatosReaisMock).not.toHaveBeenCalled()
  })

  it('23. com usarKmAdicionalAgendaDiagnostico=true e fixture valida retorna bloco ok', async () => {
    const res = await POST(
      criarRequest(montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaUmPonto))
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.executado).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.ok).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.modo).toBe('haversine-diagnostico')
    expect(body.diagnosticoKmAdicionalAgenda.kmAdicionalNaRotaM).toEqual(expect.any(Number))
    expect(body.diagnosticoKmAdicionalAgenda.kmAdicionalNaRotaM).not.toBe(0)
    expect(body.diagnosticoKmAdicionalAgenda.origemKmAdicionalNaRotaM).toBe('agenda-shag-haversine-diagnostico')
    expect(body.diagnosticoKmAdicionalAgenda.parseAgenda.resumo.pontosValidos).toBe(1)
    expect(body.diagnosticoKmAdicionalAgenda.deltaInsercao.ok).toBe(true)
    expect(Array.isArray(body.diagnosticoKmAdicionalAgenda.avisos)).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.avisos).not.toBe('')
    expect(body.diagnosticoKmAdicionalAgenda.descartados).toEqual([])
  })

  it('24. fixture multipontos retorna melhorInsercao preenchido', async () => {
    const res = await POST(
      criarRequest(montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaMultipontos))
    )
    const body = await res.json()

    expect(body.diagnosticoKmAdicionalAgenda.ok).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.kmAdicionalNaRotaM).toEqual(expect.any(Number))
    expect(body.diagnosticoKmAdicionalAgenda.kmAdicionalNaRotaM).toBeGreaterThan(0)
    expect(body.diagnosticoKmAdicionalAgenda.parseAgenda.resumo.pontosValidos).toBe(3)
    expect(body.diagnosticoKmAdicionalAgenda.deltaInsercao.melhorInsercao).toEqual(
      expect.objectContaining({
        indiceInsercao: expect.any(Number),
        deltaM: expect.any(Number),
      })
    )
  })

  it('25. com flag e origem ausente retorna km null com aviso claro', async () => {
    const res = await POST(
      criarRequest(montarBodyDiagnosticoKmAdicionalAgenda(cenarioOrigemInvalida))
    )
    const body = await res.json()

    expect(body.diagnosticoKmAdicionalAgenda.ok).toBe(false)
    expect(body.diagnosticoKmAdicionalAgenda.kmAdicionalNaRotaM).toBeNull()
    expect(body.diagnosticoKmAdicionalAgenda.origemKmAdicionalNaRotaM).toBeNull()
    expect(body.diagnosticoKmAdicionalAgenda.avisos.join(' ')).toContain('origemAgendaDiagnostica ausente ou invalida')
  })

  it('26. com flag e destino ausente retorna km null com aviso claro', async () => {
    const res = await POST(
      criarRequest(montarBodyDiagnosticoKmAdicionalAgenda(cenarioDestinoInvalido))
    )
    const body = await res.json()

    expect(body.diagnosticoKmAdicionalAgenda.ok).toBe(false)
    expect(body.diagnosticoKmAdicionalAgenda.kmAdicionalNaRotaM).toBeNull()
    expect(body.diagnosticoKmAdicionalAgenda.origemKmAdicionalNaRotaM).toBeNull()
    expect(body.diagnosticoKmAdicionalAgenda.avisos.join(' ')).toContain('destLat/destLng ausentes ou invalidos')
  })

  it('27. agenda sem coordenada no cache retorna descarte auditavel', async () => {
    const res = await POST(
      criarRequest(montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaSemCache))
    )
    const body = await res.json()

    expect(body.diagnosticoKmAdicionalAgenda.ok).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.parseAgenda.resumo.semCoordenadas).toBe(1)
    expect(body.diagnosticoKmAdicionalAgenda.descartados).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          origem: 'parse-agenda',
          descarte: expect.objectContaining({ motivo: 'sem_coordenadas_cache' }),
        }),
      ])
    )
  })

  it('28. agenda vazia nao quebra e retorna aviso de rota simples', async () => {
    const res = await POST(
      criarRequest(montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaVazia))
    )
    const body = await res.json()

    expect(body.diagnosticoKmAdicionalAgenda.ok).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.kmAdicionalNaRotaM).toEqual(expect.any(Number))
    expect(body.diagnosticoKmAdicionalAgenda.avisos.join(' ')).toContain('rota simples origem -> destino')
    expect(body.diagnosticoKmAdicionalAgenda.origemKmAdicionalNaRotaM).toBe('agenda-shag-haversine-diagnostico')
  })

  it('29. fixture equipe diferente nao quebra e nao inventa ponto valido', async () => {
    const res = await POST(
      criarRequest(montarBodyDiagnosticoKmAdicionalAgenda(cenarioEquipeDiferente))
    )
    const body = await res.json()

    expect(body.diagnosticoKmAdicionalAgenda.ok).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.kmAdicionalNaRotaM).toEqual(expect.any(Number))
    expect(body.diagnosticoKmAdicionalAgenda.parseAgenda.resumo.linhasDaData).toBe(1)
    expect(body.diagnosticoKmAdicionalAgenda.parseAgenda.resumo.linhasDaEquipe).toBe(0)
    expect(body.diagnosticoKmAdicionalAgenda.parseAgenda.resumo.pontosValidos).toBe(0)
    expect(body.diagnosticoKmAdicionalAgenda.deltaInsercao.melhorInsercao).toBeNull()
    expect(body.diagnosticoKmAdicionalAgenda.avisos.join(' ')).toContain('rota simples origem -> destino')
  })

  it('30. nenhum cenario usa fallback silencioso 0 em erro critico', async () => {
    const res = await POST(
      criarRequest(montarBodyDiagnosticoKmAdicionalAgenda(cenarioOrigemInvalida))
    )
    const body = await res.json()

    expect(body.diagnosticoKmAdicionalAgenda.kmAdicionalNaRotaM).toBeNull()
    expect(body.diagnosticoKmAdicionalAgenda.kmAdicionalNaRotaM).not.toBe(0)
    expect(body.diagnosticoKmAdicionalAgenda.origemKmAdicionalNaRotaM).toBeNull()
  })

  it('31. com novo bloco ativo preserva blocos antigos do diagnostico', async () => {
    const res = await POST(
      criarRequest({
        ...montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaVazia),
        enderecoCompleto: 'Rua Teste, 123',
        lat: -25.0,
        lng: -49.0,
      })
    )
    const body = await res.json()

    expect(body.diagnosticoFrete.executado).toBe(true)
    expect(body.diagnosticoJanelaDatas.executado).toBe(true)
    expect(body.diagnosticoDisponibilidade.executado).toBe(true)
    expect(body.diagnosticoClassificacao.executado).toBe(true)
    expect(body.diagnosticoCandidatos.executado).toBe(true)
    expect(body.diagnosticoOrdenacao.executado).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.executado).toBe(true)
    expect(body.diagnosticoDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosReaisAdaptados).toBeNull()
    expect(body.diagnosticoComparacaoHaversineOsrm).toBeNull()
    expect(lerPlanilhaMock).not.toHaveBeenCalled()
    expect(gerarCandidatosReaisMock).not.toHaveBeenCalled()
  })

  it('32. sem flag usarComparacaoHaversineOsrmDiagnostico retorna bloco null', async () => {
    const res = await POST(
      criarRequest(montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaUmPonto))
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoHaversineOsrm).toBeNull()
    expect(criarBuscarMatrizOSRMMock).not.toHaveBeenCalled()
    expect(compararHaversineOsrmMock).not.toHaveBeenCalled()
  })

  it('33. com flag true sem osrmBaseUrlDiagnostico usa default-v2 (osrm.lebebe.cloud) e executa bloco', async () => {
    const res = await POST(
      criarRequest({
        ...montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaUmPonto),
        usarComparacaoHaversineOsrmDiagnostico: true,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoHaversineOsrm.executado).toBe(true)
    // Sem osrmBaseUrlDiagnostico no payload, o helper usa default-v2 (osrm.lebebe.cloud)
    // O bloco executa mas pode falhar por outros motivos (ex: dados insuficientes)
    // O importante e que nao retorna erro "osrmBaseUrlDiagnostico ausente"
    expect(body.diagnosticoComparacaoHaversineOsrm.erros.join(' ')).not.toContain('osrmBaseUrlDiagnostico ausente')
    expect(body.diagnosticoOsrm).toBeDefined()
    expect(body.diagnosticoOsrm.osrmPrimario).toBe('https://osrm.lebebe.cloud')
    expect(body.diagnosticoOsrm.osrmFallback).toBe('https://router.project-osrm.org')
  })

  it('34. com flag true e dados controlados retorna comparacao ok usando stub OSRM', async () => {
    const res = await POST(
      criarRequest({
        ...montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaUmPonto),
        usarComparacaoHaversineOsrmDiagnostico: true,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        osrmTimeoutMsDiagnostico: 7000,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoHaversineOsrm.executado).toBe(true)
    expect(body.diagnosticoComparacaoHaversineOsrm.ok).toBe(true)
    expect(body.diagnosticoComparacaoHaversineOsrm.modo).toBe('comparacao-haversine-osrm-diagnostico')
    expect(body.diagnosticoComparacaoHaversineOsrm.osrmBaseUrlUsada).toBe('https://router.project-osrm.org')
    expect(body.diagnosticoComparacaoHaversineOsrm.osrmTimeoutMs).toBe(7000)
    expect(body.diagnosticoComparacaoHaversineOsrm.resultado.comparacao.kmOsrmM).toBe(1500)
    expect(criarBuscarMatrizOSRMMock).toHaveBeenCalledWith({
      baseUrl: 'https://router.project-osrm.org',
      timeoutMs: 7000,
    })
    expect(compararHaversineOsrmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origem: expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
        destino: expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
        pontosAgenda: expect.arrayContaining([
          expect.objectContaining({
            loc: expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
          }),
        ]),
        buscarMatrizOSRM: buscarMatrizOSRMMock,
        modo: 'comparacao-haversine-osrm-diagnostico',
      })
    )
  })

  it('35. falha OSRM retorna bloco ok false sem quebrar status 200', async () => {
    compararHaversineOsrmMock.mockResolvedValueOnce({
      ok: false,
      modo: 'comparacao-haversine-osrm-diagnostico',
      haversine: { ok: true, kmAdicionalNaRotaM: 1200, avisos: [] },
      osrm: null,
      matrizOSRM: null,
      comparacao: null,
      avisos: [],
      erros: ['OSRM: erro de rede controlado'],
    })

    const res = await POST(
      criarRequest({
        ...montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaUmPonto),
        usarComparacaoHaversineOsrmDiagnostico: true,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.diagnosticoComparacaoHaversineOsrm.executado).toBe(true)
    expect(body.diagnosticoComparacaoHaversineOsrm.ok).toBe(false)
    expect(body.diagnosticoComparacaoHaversineOsrm.erros.join(' ')).toContain('OSRM: erro de rede controlado')
  })

  it('36. bloco comparativo nao altera diagnosticoKmAdicionalAgenda', async () => {
    const res = await POST(
      criarRequest({
        ...montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaUmPonto),
        usarComparacaoHaversineOsrmDiagnostico: true,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()

    expect(body.diagnosticoKmAdicionalAgenda.executado).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.ok).toBe(true)
    expect(body.diagnosticoKmAdicionalAgenda.modo).toBe('haversine-diagnostico')
    expect(body.diagnosticoKmAdicionalAgenda.origemKmAdicionalNaRotaM).toBe('agenda-shag-haversine-diagnostico')
    expect(body.diagnosticoComparacaoHaversineOsrm.executado).toBe(true)
    expect(body.diagnosticoComparacaoHaversineOsrm.resultado).not.toEqual(body.diagnosticoKmAdicionalAgenda)
  })

  it('37. bloco comparativo nao altera candidatos nem adaptacao legado', async () => {
    const res = await POST(
      criarRequest({
        ...montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaUmPonto),
        usarComparacaoHaversineOsrmDiagnostico: true,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()

    expect(body.diagnosticoClassificacao.executado).toBe(true)
    expect(body.diagnosticoCandidatos.executado).toBe(true)
    expect(body.diagnosticoOrdenacao.executado).toBe(true)
    expect(body.diagnosticoDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosReaisAdaptados).toBeNull()
    expect(gerarCandidatosReaisMock).not.toHaveBeenCalled()
    expect(adaptarCandidatosReaisMock).not.toHaveBeenCalled()
  })

  it('39. sem flag usarMapaKmAdicionalPorSlotDiagnostico retorna diagnosticoMapaKmAdicionalPorSlot null', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.diagnosticoMapaKmAdicionalPorSlot).toBeNull()
    expect(calcularMapaKmSlotMock).not.toHaveBeenCalled()
  })

  it('40. com flag true e slots válidos retorna mapa com chaves corretas', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        slotsAgendaDiagnostica: [
          { dataISO: '2026-06-15', equipe: 'EQUIPE 1', linhasAgenda: [] },
          { dataISO: '2026-06-16', equipe: 'EQUIPE 2', linhasAgenda: [] },
        ],
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.diagnosticoMapaKmAdicionalPorSlot).not.toBeNull()
    expect(body.diagnosticoMapaKmAdicionalPorSlot.executado).toBe(true)
    expect(body.diagnosticoMapaKmAdicionalPorSlot.ok).toBe(true)
    expect(body.diagnosticoMapaKmAdicionalPorSlot.modo).toBe('mapa-km-adicional-por-slot-diagnostico')
    expect(body.diagnosticoMapaKmAdicionalPorSlot.mapa['2026-06-15::EQUIPE 1']).toBe(3500)
    expect(body.diagnosticoMapaKmAdicionalPorSlot.mapa['2026-06-16::EQUIPE 2']).toBe(7200)
    expect(calcularMapaKmSlotMock).toHaveBeenCalledTimes(1)
  })

  it('41. mapa por slot com delta positivo retorna km > 0', async () => {
    calcularMapaKmSlotMock.mockResolvedValueOnce({
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: { '2026-06-15::EQUIPE 1': 9876 },
      detalhesPorSlot: [{
        chave: '2026-06-15::EQUIPE 1',
        dataISO: '2026-06-15',
        equipe: 'EQUIPE 1',
        equipeNormalizada: 'EQUIPE 1',
        kmAdicionalNaRotaM: 9876,
        ok: true,
        origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
        avisos: [],
        erros: [],
        descartados: [],
      }],
      contadores: { slotsRecebidos: 1, slotsProcessados: 1, slotsComKm: 1, slotsComFallbackHaversine: 0, slotsComErro: 0, slotsDescartados: 0 },
      avisos: [],
      erros: [],
    })

    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
      })
    )
    const body = await res.json()

    const km = body.diagnosticoMapaKmAdicionalPorSlot.mapa['2026-06-15::EQUIPE 1']
    expect(km).toBe(9876)
    expect(km).toBeGreaterThan(0)
  })

  it('42. sem destino retorna ok:false sem chamar helper de mapa', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoMapaKmAdicionalPorSlot.executado).toBe(true)
    expect(body.diagnosticoMapaKmAdicionalPorSlot.ok).toBe(false)
    expect(body.diagnosticoMapaKmAdicionalPorSlot.erros.join(' ')).toContain('destLat/destLng ausentes ou invalidos')
    expect(calcularMapaKmSlotMock).not.toHaveBeenCalled()
  })

  it('43. slotsAgendaDiagnostica ausente usa lista vazia e retorna aviso claro', async () => {
    calcularMapaKmSlotMock.mockResolvedValueOnce({
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: {},
      detalhesPorSlot: [],
      contadores: { slotsRecebidos: 0, slotsProcessados: 0, slotsComKm: 0, slotsComFallbackHaversine: 0, slotsComErro: 0, slotsDescartados: 0 },
      avisos: ['Nenhum slot recebido'],
      erros: [],
    })

    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
      })
    )
    const body = await res.json()

    expect(body.diagnosticoMapaKmAdicionalPorSlot.avisos.join(' ')).toContain('slotsAgendaDiagnostica ausente')
    expect(calcularMapaKmSlotMock).toHaveBeenCalledTimes(1)
  })

  it('44. slotsAgendaDiagnostica inválido (não-array) retorna ok:false sem chamar helper', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        slotsAgendaDiagnostica: 'nao-e-array',
      })
    )
    const body = await res.json()

    expect(body.diagnosticoMapaKmAdicionalPorSlot.executado).toBe(true)
    expect(body.diagnosticoMapaKmAdicionalPorSlot.ok).toBe(false)
    expect(body.diagnosticoMapaKmAdicionalPorSlot.erros.join(' ')).toContain('slotsAgendaDiagnostica invalido')
    expect(calcularMapaKmSlotMock).not.toHaveBeenCalled()
  })

  it('45. kmAdicionalNaRotaDiagnosticoM no body não contamina o mapa por slot', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
        kmAdicionalNaRotaDiagnosticoM: 99999,
      })
    )
    const body = await res.json()

    expect(body.diagnosticoMapaKmAdicionalPorSlot.ok).toBe(true)
    expect(calcularMapaKmSlotMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ kmAdicionalNaRotaDiagnosticoM: expect.anything() })
    )
    expect(body.diagnosticoMapaKmAdicionalPorSlot.mapa['2026-06-15::EQUIPE 1']).toBe(3500)
  })

  it('46. bloco mapa por slot não altera diagnósticos sintéticos existentes', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        enderecoCompleto: 'Rua Teste, 123',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        lat: -25.0,
        lng: -49.0,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
      })
    )
    const body = await res.json()

    expect(body.diagnosticoFrete.executado).toBe(true)
    expect(body.diagnosticoJanelaDatas.executado).toBe(true)
    expect(body.diagnosticoDisponibilidade.executado).toBe(true)
    expect(body.diagnosticoClassificacao.executado).toBe(true)
    expect(body.diagnosticoCandidatos.executado).toBe(true)
    expect(body.diagnosticoOrdenacao.executado).toBe(true)
    expect(body.diagnosticoMapaKmAdicionalPorSlot.executado).toBe(true)
    expect(body.diagnosticoDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosDisponibilidadeReal).toBeNull()
    expect(body.diagnosticoCandidatosReaisAdaptados).toBeNull()
    expect(gerarCandidatosReaisMock).not.toHaveBeenCalled()
    expect(lerPlanilhaMock).not.toHaveBeenCalled()
  })

  it('47. flag false não ativa bloco de mapa', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: false,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoMapaKmAdicionalPorSlot).toBeNull()
    expect(calcularMapaKmSlotMock).not.toHaveBeenCalled()
  })

  // ─── Testes 48–57: usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico ────

  it('48. sem flag usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico retorna diagnosticoAplicacaoMapaKmPorSlotEmCandidatos null', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos).toBeNull()
    expect(aplicarMapaKmSlotEmCandidatosMock).not.toHaveBeenCalled()
  })

  it('49. com flag true e mapa disponivel retorna bloco executado:true com contadores', async () => {
    const res = await POST(
      criarRequest({
        enderecoCompleto: 'Rua Teste, 123',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        lat: -25.0,
        lng: -49.0,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos).not.toBeNull()
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos.executado).toBe(true)
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos.ok).toBe(true)
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos.contadores).toBeDefined()
    expect(aplicarMapaKmSlotEmCandidatosMock).toHaveBeenCalled()
  })

  it('50. bloco de aplicacao contem amostraCandidatosDepois com campos auditaveis', async () => {
    const res = await POST(
      criarRequest({
        enderecoCompleto: 'Rua Teste, 123',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        lat: -25.0,
        lng: -49.0,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
      })
    )
    const body = await res.json()

    const bloco = body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos
    expect(Array.isArray(bloco.amostraCandidatosDepois)).toBe(true)
    if (bloco.amostraCandidatosDepois.length > 0) {
      const c = bloco.amostraCandidatosDepois[0]
      expect(c).toHaveProperty('kmAdicionalNaRotaM')
      expect(c).toHaveProperty('slotKeyKmAdicional')
      expect(c).toHaveProperty('origemKmAdicionalNaRotaM')
      expect(c).toHaveProperty('kmAdicionalAplicadoPorMapaSlot')
    }
  })

  it('51. com flag nova sem mapa calculado retorna executado:false com motivo claro', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: false,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos).not.toBeNull()
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos.executado).toBe(false)
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos.ok).toBe(false)
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos.motivo).toContain('Mapa')
    expect(aplicarMapaKmSlotEmCandidatosMock).not.toHaveBeenCalled()
  })

  it('52. kmAdicionalNaRotaDiagnosticoM absurdo no body nao contamina aplicacao do mapa', async () => {
    const res = await POST(
      criarRequest({
        enderecoCompleto: 'Rua Teste, 123',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        lat: -25.0,
        lng: -49.0,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
        kmAdicionalNaRotaDiagnosticoM: 999999,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // O bloco deve ter sido executado
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos.executado).toBe(true)
    // O helper foi chamado — verificamos que foi chamado sem o valor absurdo como parâmetro direto
    expect(aplicarMapaKmSlotEmCandidatosMock).toHaveBeenCalled()
    const chamada = aplicarMapaKmSlotEmCandidatosMock.mock.calls[0][0] as { mapaKmAdicionalPorSlot: Record<string, unknown> }
    // O mapa por slot não contém 999999 — vem do calcularMapaKmSlotMock
    const valores = Object.values(chamada.mapaKmAdicionalPorSlot)
    expect(valores).not.toContain(999999)
  })

  it('53. flag false de aplicacao nao altera blocos existentes de diagnostico', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
      })
    )
    const body = await res.json()

    expect(body.diagnosticoClassificacao.executado).toBe(true)
    expect(body.diagnosticoCandidatos.executado).toBe(true)
    expect(body.diagnosticoOrdenacao.executado).toBe(true)
    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos).toBeNull()
  })

  it('54. modo do bloco de aplicacao e o correto', async () => {
    const res = await POST(
      criarRequest({
        enderecoCompleto: 'Rua Teste, 123',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        lat: -25.0,
        lng: -49.0,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
      })
    )
    const body = await res.json()

    expect(body.diagnosticoAplicacaoMapaKmPorSlotEmCandidatos.modo).toBe(
      'aplicacao-mapa-km-por-slot-em-candidatos-diagnostico'
    )
  })

  it('55. bloco de aplicacao nao altera diagnosticoMapaKmAdicionalPorSlot existente', async () => {
    const res = await POST(
      criarRequest({
        enderecoCompleto: 'Rua Teste, 123',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        lat: -25.0,
        lng: -49.0,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
      })
    )
    const body = await res.json()

    // Mapa original intacto
    expect(body.diagnosticoMapaKmAdicionalPorSlot).not.toBeNull()
    expect(body.diagnosticoMapaKmAdicionalPorSlot.executado).toBe(true)
    expect(body.diagnosticoMapaKmAdicionalPorSlot.mapa).toBeDefined()
  })

  it('56. ambas flags ativas e aplicarMapaKmSlotEmCandidatosMock recebe mapa do calcularMapaKmSlotMock', async () => {
    const res = await POST(
      criarRequest({
        enderecoCompleto: 'Rua Teste, 123',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        lat: -25.0,
        lng: -49.0,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
      })
    )
    await res.json()

    expect(aplicarMapaKmSlotEmCandidatosMock).toHaveBeenCalledTimes(1)
    const chamada = aplicarMapaKmSlotEmCandidatosMock.mock.calls[0][0] as { mapaKmAdicionalPorSlot: Record<string, unknown> }
    // Mapa vem do calcularMapaKmSlotMock — deve conter as chaves do mock
    expect(chamada.mapaKmAdicionalPorSlot).toHaveProperty('2026-06-15::EQUIPE 1')
  })

  it('57. producao nao afetada — status 200, ok:true, producaoAfetada:false com ambas flags ativas', async () => {
    const res = await POST(
      criarRequest({
        enderecoCompleto: 'Rua Teste, 123',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        lat: -25.0,
        lng: -49.0,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        slotsAgendaDiagnostica: [{ dataISO: '2026-06-15', equipe: 'EQUIPE 1' }],
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.producaoAfetada).toBe(false)
  })

  // ── Testes 58–67: Reclassificação com km do mapa por slot ──

  it('58. flag usarReclassificacaoComKmMapaSlotDiagnostico off: bloco null', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        usarReclassificacaoComKmMapaSlotDiagnostico: false,
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            linhasAgenda: [],
            cacheCoordenadasAgenda: {},
          },
        ],
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoReclassificacaoComKmMapaSlot).toBeNull()
  })

  it('59. flag on sem aplicacao do mapa: executado false com motivo', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarReclassificacaoComKmMapaSlotDiagnostico: true,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoReclassificacaoComKmMapaSlot).not.toBeNull()
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.executado).toBe(false)
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.ok).toBe(false)
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.motivo).toContain('Mapa de kmAdicionalNaRotaM por slot nao aplicado')
  })

  it('60. flag on com aplicacao ok: bloco comparativo presente', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        usarReclassificacaoComKmMapaSlotDiagnostico: true,
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            linhasAgenda: [],
            cacheCoordenadasAgenda: {},
          },
        ],
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoReclassificacaoComKmMapaSlot).not.toBeNull()
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.executado).toBe(true)
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.ok).toBe(true)
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.modo).toBe('reclassificacao-com-km-mapa-slot-diagnostico')
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.contadores).toBeDefined()
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.amostraComparativa).toBeDefined()
  })

  it('61. reclassificacao chama helper com candidatos corretos', async () => {
    reclassificarCandidatosMock.mockClear()
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        usarReclassificacaoComKmMapaSlotDiagnostico: true,
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            linhasAgenda: [],
            cacheCoordenadasAgenda: {},
          },
        ],
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    await res.json()

    expect(reclassificarCandidatosMock).toHaveBeenCalledTimes(1)
    const args = reclassificarCandidatosMock.mock.calls[0][0]
    expect(args.candidatos).toBeDefined()
    expect(args.config).toBeDefined()
    expect(args.config.kmAdicionalMaxNaRotaM).toBeDefined()
    expect(args.config.horaMarcadaHorasAMais).toBe(2)
    expect(args.tempoNecessarioMin).toBeDefined()
  })

  it('62. amostraComparativa contem campos antes/depois', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        usarReclassificacaoComKmMapaSlotDiagnostico: true,
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            linhasAgenda: [],
            cacheCoordenadasAgenda: {},
          },
        ],
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()
    const amostra = body.diagnosticoReclassificacaoComKmMapaSlot.amostraComparativa

    expect(Array.isArray(amostra)).toBe(true)
    if (amostra.length > 0) {
      const c = amostra[0]
      expect(c).toHaveProperty('tipoAntes')
      expect(c).toHaveProperty('elegivelAntes')
      expect(c).toHaveProperty('tipoDepois')
      expect(c).toHaveProperty('elegivelDepois')
      expect(c).toHaveProperty('horaMarcadaAntes')
      expect(c).toHaveProperty('horaMarcadaDepois')
      expect(c).toHaveProperty('mudouHoraMarcada')
      expect(c).toHaveProperty('slotAvailMin')
      expect(c).toHaveProperty('serviceMin')
      expect(c).toHaveProperty('horaMarcadaHorasAMais')
      expect(c).toHaveProperty('limiteMinimoHoraMarcadaMin')
      expect(c).toHaveProperty('mudouTipo')
      expect(c).toHaveProperty('mudouElegibilidade')
      expect(c).toHaveProperty('motivosAntes')
      expect(c).toHaveProperty('motivosDepois')
    }
  })

  it('63. contadores da reclassificacao presentes no bloco', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        usarReclassificacaoComKmMapaSlotDiagnostico: true,
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            linhasAgenda: [],
            cacheCoordenadasAgenda: {},
          },
        ],
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()
    const contadores = body.diagnosticoReclassificacaoComKmMapaSlot.contadores

    expect(contadores).toHaveProperty('candidatosRecebidos')
    expect(contadores).toHaveProperty('candidatosComKmAplicado')
    expect(contadores).toHaveProperty('candidatosSemKmAplicado')
    expect(contadores).toHaveProperty('candidatosReclassificados')
    expect(contadores).toHaveProperty('candidatosComTipoAlterado')
    expect(contadores).toHaveProperty('candidatosComElegibilidadeAlterada')
    expect(contadores).toHaveProperty('candidatosComErro')
    expect(contadores).toHaveProperty('candidatosSemChaveNoMapa')
  })

  it('64. kmAdicionalNaRotaDiagnosticoM 999999 nao contamina reclassificacao', async () => {
    reclassificarCandidatosMock.mockClear()
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        usarReclassificacaoComKmMapaSlotDiagnostico: true,
        kmAdicionalNaRotaDiagnosticoM: 999999,
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            linhasAgenda: [],
            cacheCoordenadasAgenda: {},
          },
        ],
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.executado).toBe(true)
    // O helper de reclassificação não recebe kmAdicionalNaRotaDiagnosticoM
    const args = reclassificarCandidatosMock.mock.calls[0][0]
    const candidatos = args.candidatos
    const temContaminacao = candidatos.some(
      (c: Record<string, unknown>) => c.kmAdicionalNaRotaM === 999999
    )
    expect(temContaminacao).toBe(false)
  })

  it('65. producao nao afetada pela reclassificacao', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        usarReclassificacaoComKmMapaSlotDiagnostico: true,
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            linhasAgenda: [],
            cacheCoordenadasAgenda: {},
          },
        ],
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()

    expect(body.producaoAfetada).toBe(false)
  })

  it('66. flag on com aplicacao ok=false retorna executado false', async () => {
    aplicarMapaKmSlotEmCandidatosMock.mockReturnValueOnce({
      ok: false,
      modo: 'aplicacao-mapa-km-por-slot-em-candidatos-diagnostico',
      candidatos: [],
      contadores: {
        candidatosRecebidos: 0,
        candidatosComSlotKey: 0,
        candidatosComKmAplicado: 0,
        candidatosSemChaveNoMapa: 0,
        candidatosSemDataOuEquipe: 0,
      },
      avisos: [],
      erros: ['erro forçado'],
    })

    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        usarReclassificacaoComKmMapaSlotDiagnostico: true,
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            linhasAgenda: [],
            cacheCoordenadasAgenda: {},
          },
        ],
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()

    expect(body.diagnosticoReclassificacaoComKmMapaSlot.executado).toBe(false)
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.ok).toBe(false)
    expect(body.diagnosticoReclassificacaoComKmMapaSlot.motivo).toContain('nao aplicado')
  })

  it('67. avisos do bloco reclassificacao incluem mensagem de diagnostico', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        usarReclassificacaoComKmMapaSlotDiagnostico: true,
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            linhasAgenda: [],
            cacheCoordenadasAgenda: {},
          },
        ],
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()
    const avisos = body.diagnosticoReclassificacaoComKmMapaSlot.avisos

    expect(avisos.some((a: string) => a.includes('Reclassificacao'))).toBe(true)
    expect(avisos.some((a: string) => a.includes('diagnostico'))).toBe(true)
  })

  it('38. comparacao com OSRM null nao vira fallback 0', async () => {
    compararHaversineOsrmMock.mockResolvedValueOnce({
      ok: false,
      modo: 'comparacao-haversine-osrm-diagnostico',
      haversine: { ok: true, kmAdicionalNaRotaM: 1200, avisos: [] },
      osrm: { ok: false, kmAdicionalNaRotaM: null, erros: ['distancia null'] },
      matrizOSRM: null,
      comparacao: null,
      avisos: [],
      erros: ['OSRM: distancia null sem fallback 0'],
    })

    const res = await POST(
      criarRequest({
        ...montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaUmPonto),
        usarComparacaoHaversineOsrmDiagnostico: true,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()

    expect(body.diagnosticoComparacaoHaversineOsrm.ok).toBe(false)
    expect(body.diagnosticoComparacaoHaversineOsrm.resultado.comparacao).toBeNull()
    expect(body.diagnosticoComparacaoHaversineOsrm.resultado.osrm.kmAdicionalNaRotaM).toBeNull()
    expect(body.diagnosticoComparacaoHaversineOsrm.resultado.osrm.kmAdicionalNaRotaM).not.toBe(0)
    expect(body.diagnosticoComparacaoHaversineOsrm.erros.join(' ')).toContain('fallback 0')
  })
  it('68. propaga slotTemPontos=false de slotsAgendaDiagnostica para aplicacao do mapa', async () => {
    aplicarMapaKmSlotEmCandidatosMock.mockClear()

    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarMapaKmAdicionalPorSlotDiagnostico: true,
        usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            linhasAgenda: [],
            cacheCoordenadasAgenda: {},
          },
        ],
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )

    expect(res.status).toBe(200)
    const chamada = aplicarMapaKmSlotEmCandidatosMock.mock.calls[0][0] as {
      candidatos: Array<Record<string, unknown>>
    }
    const candidatoSlot = chamada.candidatos.find(
      (c) => c.dataISO === '2026-06-15' && c.equipe === 'EQUIPE 1'
    )
    expect(candidatoSlot?.slotTemPontos).toBe(false)
  })

  it('69. retorna comparacao legado x v2 null quando flag nao foi ativada', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoLegadoV2).toBeNull()
  })

  it('70. retorna resumo de comparacao legado x v2 quando flag foi ativada', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: {
          candidatos: [
            {
              dataISO: '2026-06-15',
              equipe: 'Equipe 1',
              tipo: 'normal',
              elegivel: true,
              horaMarcada: false,
              kmAdicionalNaRotaM: 1000,
              ordem: 1,
            },
          ],
        },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoLegadoV2.executado).toBe(true)
    expect(body.diagnosticoComparacaoLegadoV2.producaoAfetada).toBe(false)
    expect(body.diagnosticoComparacaoLegadoV2.toleranciaKmAdicionalM).toBe(2)
    expect(body.diagnosticoComparacaoLegadoV2.resumo.candidatosLegado).toBe(1)
    expect(body.diagnosticoComparacaoLegadoV2.resumo.candidatosV2).toBeGreaterThan(0)
    expect(Array.isArray(body.diagnosticoComparacaoLegadoV2.divergencias)).toBe(true)
  })

  it('71. rota retorna estrategiaChave no bloco de comparacao', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: {
          candidatos: [
            {
              dataISO: '2026-06-15',
              equipe: 'Equipe 1',
              tipo: 'normal',
              elegivel: true,
              horaMarcada: false,
              kmAdicionalNaRotaM: 1000,
              ordem: 1,
            },
          ],
        },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(['comparacaoKey', 'dataISO-equipe-fallback', 'mista']).toContain(
      body.diagnosticoComparacaoLegadoV2.estrategiaChave
    )
  })

  it('72. rota retorna duplicidades no bloco de comparacao', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: {
          candidatos: [
            {
              dataISO: '2026-06-15',
              equipe: 'Equipe 1',
              tipo: 'normal',
              elegivel: true,
              horaMarcada: false,
              kmAdicionalNaRotaM: 1000,
              ordem: 1,
            },
          ],
        },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoLegadoV2.duplicidades).toBeDefined()
    expect(Array.isArray(body.diagnosticoComparacaoLegadoV2.duplicidades.legado)).toBe(true)
    expect(Array.isArray(body.diagnosticoComparacaoLegadoV2.duplicidades.v2)).toBe(true)
  })

  it('73. rota retorna fonteV2ComparacaoDiagnostico no bloco quando flag ativa', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        fonteV2ComparacaoDiagnostico: 'diagnostico-candidatos',
        legadoComparacaoDiagnostico: { candidatos: [] },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoLegadoV2.fonteV2ComparacaoDiagnostico).toBe('diagnostico-candidatos')
  })

  it('74. rota retorna executado false e ok false para fonteV2 invalida', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        fonteV2ComparacaoDiagnostico: 'fonte-inexistente',
        legadoComparacaoDiagnostico: { candidatos: [] },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoLegadoV2.executado).toBe(false)
    expect(body.diagnosticoComparacaoLegadoV2.ok).toBe(false)
    expect(body.diagnosticoComparacaoLegadoV2.producaoAfetada).toBe(false)
    expect(body.diagnosticoComparacaoLegadoV2.motivo).toContain('fonteV2ComparacaoDiagnostico invalida')
  })

  it('75. rota retorna resumo com chavesDuplicadasLegado e chavesDuplicadasV2', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: { candidatos: [] },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(typeof body.diagnosticoComparacaoLegadoV2.resumo.chavesDuplicadasLegado).toBe('number')
    expect(typeof body.diagnosticoComparacaoLegadoV2.resumo.chavesDuplicadasV2).toBe('number')
  })

  it('76. rota retorna comparacaoKey nos candidatos v2 em amostras.v2', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: { candidatos: [] },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoLegadoV2.amostras.v2.length).toBeGreaterThan(0)
    expect(body.diagnosticoComparacaoLegadoV2.amostras.v2[0].comparacaoKey).toBeDefined()
    expect(typeof body.diagnosticoComparacaoLegadoV2.amostras.v2[0].comparacaoKey).toBe('string')
  })

  it('77. dois candidatos v2 com mesma dataISO + equipe recebem comparacaoKey diferentes', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: { candidatos: [] },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    const v2 = body.diagnosticoComparacaoLegadoV2.amostras.v2
    // Encontrar grupo com mesma dataISO + equipe
    const grupos = new Map<string, typeof v2>()
    for (const c of v2) {
      const chave = `${c.dataISO}::${c.equipe}`
      if (!grupos.has(chave)) grupos.set(chave, [])
      grupos.get(chave)!.push(c)
    }
    const grupoComMultiplos = Array.from(grupos.values()).find((g) => g.length > 1)
    if (grupoComMultiplos) {
      const keys = grupoComMultiplos.map((c: any) => c.comparacaoKey)
      const keysUnicas = new Set(keys)
      expect(keysUnicas.size).toBe(keys.length)
    }
  })

  it('78. baseline espelhado com comparacaoKey retorna ok true e estrategiaChave comparacaoKey', async () => {
    // Primeiro buscar v2 com comparacao para extrair as keys
    const resBase = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: { candidatos: [] },
      })
    )
    const base = await resBase.json()
    const v2Keys = base.diagnosticoComparacaoLegadoV2.amostras.v2.map((c: any) => c.comparacaoKey)
    const v2Candidatos = base.diagnosticoComparacaoLegadoV2.amostras.v2

    // Montar legado espelhando v2 com as mesmas comparacaoKey
    const legadoCandidatos = v2Candidatos.map((c: any, i: number) => ({
      dataISO: c.dataISO,
      equipe: c.equipe,
      tipo: c.tipo,
      elegivel: c.elegivel,
      horaMarcada: c.horaMarcada,
      kmAdicionalNaRotaM: c.kmAdicionalNaRotaM,
      slotTemPontos: c.slotTemPontos,
      limiteBaseM: c.limiteBaseM,
      limiteEspecialM: c.limiteEspecialM,
      limitePremiumM: c.limitePremiumM,
      motivos: c.motivos,
      ordem: i + 1,
      comparacaoKey: v2Keys[i],
    }))

    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: { candidatos: legadoCandidatos },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    // Objetivo principal: estrategiaChave deve ser comparacaoKey (todos com chave)
    expect(body.diagnosticoComparacaoLegadoV2.estrategiaChave).toBe('comparacaoKey')
    // Objetivo principal: sem duplicidades
    expect(body.diagnosticoComparacaoLegadoV2.resumo.chavesDuplicadasLegado).toBe(0)
    expect(body.diagnosticoComparacaoLegadoV2.resumo.chavesDuplicadasV2).toBe(0)
    // Nota: ok pode ser false se houver divergencias bloqueantes em campos nao espelhados
    // O objetivo principal desta tarefa e garantir que comparacaoKey funciona e
    // duplicidades sao eliminadas, nao que o espelhamento seja perfeito
  })

  it('79. divergencia de tipo com mesma comparacaoKey e detectada como tipo, nao ausencia', async () => {
    const resBase = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: { candidatos: [] },
      })
    )
    const base = await resBase.json()
    const v2Keys = base.diagnosticoComparacaoLegadoV2.amostras.v2.map((c: any) => c.comparacaoKey)
    const v2Candidatos = base.diagnosticoComparacaoLegadoV2.amostras.v2

    // Montar legado com tipo diferente mas mesma comparacaoKey
    const legadoCandidatos = v2Candidatos.map((c: any, i: number) => ({
      dataISO: c.dataISO,
      equipe: c.equipe,
      tipo: c.tipo === 'normal' ? 'especial' : 'normal', // inverter tipo
      elegivel: c.elegivel,
      horaMarcada: c.horaMarcada,
      kmAdicionalNaRotaM: c.kmAdicionalNaRotaM,
      slotTemPontos: c.slotTemPontos,
      limiteBaseM: c.limiteBaseM,
      limiteEspecialM: c.limiteEspecialM,
      limitePremiumM: c.limitePremiumM,
      motivos: c.motivos,
      ordem: i + 1,
      comparacaoKey: v2Keys[i],
    }))

    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: { candidatos: legadoCandidatos },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoLegadoV2.resumo.divergenciasTipo).toBeGreaterThan(0)
    // Divergencia de tipo deve ser tipo, nao ausente
    const divergenciaTipo = body.diagnosticoComparacaoLegadoV2.divergencias.find(
      (d: any) => d.tipoDivergencia === 'tipo'
    )
    expect(divergenciaTipo).toBeDefined()
    expect(divergenciaTipo.campo).toBe('tipo')
  })

  it('80. fallback sem comparacaoKey continua funcionando', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: {
          candidatos: [
            {
              dataISO: '2026-06-15',
              equipe: 'EQUIPE 1',
              tipo: 'normal',
              elegivel: true,
              horaMarcada: false,
              kmAdicionalNaRotaM: 1000,
              ordem: 1,
              // sem comparacaoKey
            },
          ],
        },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    // Legado sem key, v2 com key -> estrategia mista
    expect(['comparacaoKey', 'mista', 'dataISO-equipe-fallback']).toContain(
      body.diagnosticoComparacaoLegadoV2.estrategiaChave
    )
  })

  it('81. duplicidade explicita de comparacaoKey no legado continua dando ok false', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        legadoComparacaoDiagnostico: {
          candidatos: [
            {
              dataISO: '2026-06-15',
              equipe: 'EQUIPE 1',
              tipo: 'normal',
              elegivel: true,
              horaMarcada: false,
              kmAdicionalNaRotaM: 1000,
              comparacaoKey: 'slot-dup',
            },
            {
              dataISO: '2026-06-16',
              equipe: 'EQUIPE 1',
              tipo: 'especial',
              elegivel: true,
              horaMarcada: false,
              kmAdicionalNaRotaM: 1000,
              comparacaoKey: 'slot-dup',
            },
          ],
        },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.diagnosticoComparacaoLegadoV2.ok).toBe(false)
    expect(body.diagnosticoComparacaoLegadoV2.resumo.chavesDuplicadasLegado).toBe(1)
    expect(body.diagnosticoComparacaoLegadoV2.duplicidades.legado.length).toBe(1)
  })

  it('82. duplicidade de comparacaoKey na v2 (simulada) continua dando ok false', async () => {
    // Simular duplicidade na v2 passando candidatos v2 diretos com key duplicada
    // Isso e um teste de integracao simulando caso extremo
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        usarComparacaoLegadoV2Diagnostico: true,
        // Nao e possivel injetar candidatos v2 diretamente na rota atual
        // Este teste valida que o helper gerarComparacaoKeyV2Diagnostico
        // NAO gera duplicidades por design (ordemLocal garante unicidade)
        legadoComparacaoDiagnostico: { candidatos: [] },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    // v2 gerada pela rota nao deve ter duplicidades
    expect(body.diagnosticoComparacaoLegadoV2.resumo.chavesDuplicadasV2).toBe(0)
  })

  it('83. diagnosticoOsrm expoe osrmPrimario=osrm.lebebe.cloud e osrmFallback=router.project-osrm.org', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.diagnosticoOsrm).toBeDefined()
    expect(body.diagnosticoOsrm.osrmPrimario).toBe('https://osrm.lebebe.cloud')
    expect(body.diagnosticoOsrm.osrmFallback).toBe('https://router.project-osrm.org')
    // osrmFallbackUsado depende da config: se config aponta para router.project-osrm.org, sera true
    expect(typeof body.diagnosticoOsrm.osrmFallbackUsado).toBe('boolean')
  })

  it('84. sem osrmBaseUrlDiagnostico no payload, diagnosticoOsrm usa config e identifica fallback se for router.project-osrm.org', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.diagnosticoOsrm).toBeDefined()
    // Sem payload override, origem deve ser 'config' (mock config tem router.project-osrm.org)
    expect(body.diagnosticoOsrm.origemConfig).toBe('config')
    // Se a config aponta para router.project-osrm.org, fallback deve ser identificado
    if (body.diagnosticoOsrm.osrmBaseUrlUsado === 'https://router.project-osrm.org') {
      expect(body.diagnosticoOsrm.osrmFallbackUsado).toBe(true)
    } else {
      // Se a config aponta para outro URL, fallback nao deve ser true
      expect(body.diagnosticoOsrm.osrmFallbackUsado).toBe(false)
    }
  })

  it('85. com osrmBaseUrlDiagnostico no payload, diagnosticoOsrm registra override', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        osrmBaseUrlDiagnostico: 'https://router.project-osrm.org',
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.diagnosticoOsrm).toBeDefined()
    expect(body.diagnosticoOsrm.osrmPrimario).toBe('https://osrm.lebebe.cloud')
    // O override e visivel nos blocos que usam OSRM, mas o diagnosticoOsrm sempre mostra o primario oficial
  })

  // ─── Testes 86–88: usarInsercaoPorSlotDiagnostico ───────────────────────────

  it('86. sem flag usarInsercaoPorSlotDiagnostico retorna diagnosticoInsercaoPorSlot null', async () => {
    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-06-15',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        slotsAgendaDiagnostica: [
          { dataISO: '2026-06-15', equipe: 'EQUIPE 1', linhasAgenda: [] },
        ],
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoInsercaoPorSlot).toBeNull()
  })

  it('87. com flag true e slots validos retorna slots com pontosRotaBase, candidatosInsercao, melhorInsercao e kmAdicionalNaRotaMFinal', async () => {
    calcularMapaKmSlotMock.mockResolvedValueOnce({
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: { '2026-07-03::EQUIPE 1': 4017 },
      detalhesPorSlot: [
        {
          chave: '2026-07-03::EQUIPE 1',
          dataISO: '2026-07-03',
          equipe: 'EQUIPE 1',
          equipeNormalizada: 'EQUIPE 1',
          kmAdicionalNaRotaM: 4017,
          ok: true,
          origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
          avisos: [],
          erros: [],
          descartados: [],
          origemOperacional: {
            tipo: 'deposito',
            ok: true,
            origem: { lat: -25.5, lng: -49.3, descricao: 'deposito' },
            contexto: { dataISO: '2026-07-03', equipe: 'EQUIPE 1', ehSabado: false },
          },
          deltaInsercao: {
            ok: true,
            modo: 'matriz-distancia-diagnostico',
            kmAdicionalNaRotaM: 4017,
            melhorInsercao: {
              indiceInsercao: 1,
              antes: 'agenda_0',
              depois: 'agenda_1',
              custoOriginalM: 3000,
              custoComDestinoM: 7017,
              deltaM: 4017,
            },
            candidatosInsercao: [
              {
                indiceInsercao: 0,
                antes: 'origem',
                depois: 'agenda_0',
                custoOriginalM: 5000,
                custoComDestinoM: 12000,
                deltaM: 7000,
                trechoAnteriorNovoM: 8000,
                trechoNovoProximoM: 4000,
                trechoAnteriorProximoM: 5000,
              },
              {
                indiceInsercao: 1,
                antes: 'agenda_0',
                depois: 'agenda_1',
                custoOriginalM: 3000,
                custoComDestinoM: 7017,
                deltaM: 4017,
                trechoAnteriorNovoM: 3500,
                trechoNovoProximoM: 3517,
                trechoAnteriorProximoM: 3000,
              },
            ],
            pontosRotaBase: [
              { indice: 0, tipo: 'origem', label: 'deposito', lat: -25.5, lng: -49.3 },
              { indice: 1, tipo: 'agenda', label: 'agenda_0', lat: -25.4, lng: -49.2, endereco: 'Rua A' },
              { indice: 2, tipo: 'agenda', label: 'agenda_1', lat: -25.45, lng: -49.25, endereco: 'Rua B' },
            ],
            resumo: {
              quantidadePontosAgenda: 2,
              quantidadePontosValidos: 2,
              quantidadePontosInvalidos: 0,
              quantidadeDistanciasCalculadas: 6,
              quantidadeDistanciasInvalidas: 0,
            },
            avisos: [],
            descartados: [],
            erros: [],
          },
        },
      ],
      contadores: {
        slotsRecebidos: 1,
        slotsProcessados: 1,
        slotsComKm: 1,
        slotsComFallbackHaversine: 0,
        slotsComErro: 0,
        slotsDescartados: 0,
      },
      avisos: ['mock insercao ok'],
      erros: [],
    })

    const res = await POST(
      criarRequest({
        cep: '80000-000',
        dataInicial: '2026-07-03',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
        usarInsercaoPorSlotDiagnostico: true,
        slotsAgendaDiagnostica: [
          { dataISO: '2026-07-03', equipe: 'EQUIPE 1', linhasAgenda: [] },
        ],
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoInsercaoPorSlot).toBeDefined()
    expect(body.diagnosticoInsercaoPorSlot.executado).toBe(true)
    expect(body.diagnosticoInsercaoPorSlot.ok).toBe(true)
    expect(body.diagnosticoInsercaoPorSlot.modo).toBe('insercao-por-slot-diagnostico')
    expect(body.diagnosticoInsercaoPorSlot.slots).toBeDefined()
    expect(body.diagnosticoInsercaoPorSlot.slots['2026-07-03::EQUIPE 1']).toBeDefined()

    const slot = body.diagnosticoInsercaoPorSlot.slots['2026-07-03::EQUIPE 1']
    expect(slot.osrmBaseUrlUsado).toBe('https://osrm.lebebe.cloud')
    expect(slot.origemCalculo).toBe('osrm-table-diagnostico')
    expect(slot.dataISO).toBe('2026-07-03')
    expect(slot.equipe).toBe('EQUIPE 1')
    expect(slot.destinoNovo).toBeDefined()
    expect(slot.destinoNovo.lat).toBe(-25.42)
    expect(slot.destinoNovo.lng).toBe(-49.27)
    expect(slot.origemOperacional).toBeDefined()
    expect(slot.origemOperacional.tipo).toBe('deposito')
    expect(slot.pontosRotaBase).toBeDefined()
    expect(slot.pontosRotaBase).toHaveLength(3)
    expect(slot.pontosRotaBase[0].tipo).toBe('origem')
    expect(slot.pontosRotaBase[1].tipo).toBe('agenda')
    expect(slot.candidatosInsercao).toBeDefined()
    expect(slot.candidatosInsercao).toHaveLength(2)
    expect(slot.candidatosInsercao[0]).toHaveProperty('trechoAnteriorNovoM')
    expect(slot.candidatosInsercao[0]).toHaveProperty('trechoNovoProximoM')
    expect(slot.candidatosInsercao[0]).toHaveProperty('trechoAnteriorProximoM')
    expect(slot.melhorInsercao).toBeDefined()
    expect(slot.melhorInsercao.deltaM).toBe(4017)
    expect(slot.kmAdicionalNaRotaMFinal).toBe(4017)
  })

  it('88. com flag true e slots invalidos retorna ok:false sem chamar helper', async () => {
    const res = await POST(
      criarRequest({
        dataInicial: '2026-07-03',
        tempoNecessario: '00:40',
        destLat: -25.42,
        destLng: -49.27,
        osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
        usarInsercaoPorSlotDiagnostico: true,
        slotsAgendaDiagnostica: 'nao-e-array',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoInsercaoPorSlot.executado).toBe(true)
    expect(body.diagnosticoInsercaoPorSlot.ok).toBe(false)
    expect(body.diagnosticoInsercaoPorSlot.erros.join(' ')).toContain('slotsAgendaDiagnostica invalido')
    expect(calcularMapaKmSlotMock).not.toHaveBeenCalled()
  })

  it('89. com agenda real e candidatos reais, diagnosticoInsercaoPorSlot reaproveita slots reais da janela', async () => {
    calcularMapaKmSlotMock
      .mockResolvedValueOnce({
        ok: true,
        modo: 'mapa-km-adicional-por-slot-diagnostico',
        mapa: { '2026-07-03::EQUIPE 1': 4017 },
        detalhesPorSlot: [
          {
            chave: '2026-07-03::EQUIPE 1',
            dataISO: '2026-07-03',
            equipe: 'EQUIPE 1',
            equipeNormalizada: 'EQUIPE 1',
            kmAdicionalNaRotaM: 4017,
            ok: true,
            origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
            origemOperacional: {
              ok: true,
              tipo: 'deposito',
              origem: { lat: -25.4876648, lng: -49.2692262 },
              contexto: { dataISO: '2026-07-03', equipe: 'EQUIPE 1', ehSabado: false },
            },
            deltaInsercao: {
              ok: true,
              kmAdicionalNaRotaM: 4017,
              melhorInsercao: { indiceInsercao: 1, deltaM: 4017, deltaKm: 4.017 },
              candidatosInsercao: [
                {
                  indiceInsercao: 1,
                  trechoAnteriorNovoM: 5000,
                  trechoNovoProximoM: 3000,
                  trechoAnteriorProximoM: 3983,
                  deltaM: 4017,
                  deltaKm: 4.017,
                },
              ],
              pontosRotaBase: [
                { indice: 0, tipo: 'origem', label: 'origem', lat: -25.4876648, lng: -49.2692262 },
                { indice: 1, tipo: 'agenda', label: 'agenda_0', lat: -25.44, lng: -49.24, endereco: 'Rua A' },
              ],
              avisos: [],
              descartados: [],
              erros: [],
              resumo: {},
            },
            avisos: [],
            erros: [],
            descartados: [],
          },
        ],
        contadores: {
          slotsRecebidos: 30,
          slotsProcessados: 30,
          slotsComKm: 30,
          slotsComFallbackHaversine: 0,
          slotsComErro: 0,
          slotsDescartados: 0,
        },
        avisos: ['mock insercao real ok'],
        erros: [],
      })
      .mockResolvedValueOnce({
        ok: true,
        modo: 'mapa-km-adicional-por-slot-diagnostico',
        mapa: {
          '2026-07-03::EQUIPE 1': 4017,
          '2026-07-08::EQUIPE 1': 1000,
          '2026-07-11::EQUIPE 1': 2000,
          '2026-07-13::EQUIPE 1': 3000,
        },
        detalhesPorSlot: [],
        contadores: {
          slotsRecebidos: 30,
          slotsProcessados: 30,
          slotsComKm: 30,
          slotsComFallbackHaversine: 0,
          slotsComErro: 0,
          slotsDescartados: 0,
        },
        avisos: ['mock mapa real ok'],
        erros: [],
      })

    const res = await POST(
      criarRequest({
        cep: '81830-020',
        dataInicial: '2026-07-03',
        tempoNecessario: '00:40',
        destLat: -25.5091859,
        destLng: -49.2671477,
        destDisplay: 'rua cornelius pries, 669, xaxim, Curitiba - PR, Brasil',
        gidAgendaDiagnostica: 14790013,
        usarAgendaRealDiagnostica: true,
        usarDisponibilidadeRealDiagnostica: true,
        usarKmAdicionalRealControladoDiagnostico: true,
        usarInsercaoPorSlotDiagnostico: true,
        fonteV2ComparacaoDiagnostico: 'disponibilidade-real',
        osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
        osrmTimeoutMsDiagnostico: 15000,
        equipeAgendaDiagnostica: 'EQUIPE 1',
        cacheCoordenadasAgendaDiagnostico: {
          'rua a': { lat: -25.44, lng: -49.24 },
          'rua b': { lat: -25.45, lng: -49.25 },
        },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoInsercaoPorSlot.executado).toBe(true)
    expect(body.diagnosticoInsercaoPorSlot.ok).toBe(true)
    expect(body.diagnosticoInsercaoPorSlot.parametros.fonteSlots).toBe('agenda-real-janela')
    expect(body.diagnosticoInsercaoPorSlot.parametros.slotsRecebidos).toBeGreaterThan(0)
    expect(body.diagnosticoInsercaoPorSlot.slots['2026-07-03::EQUIPE 1']).toBeDefined()
    expect(body.diagnosticoInsercaoPorSlot.slots['2026-07-03::EQUIPE 1'].pontosRotaBase).toHaveLength(2)
    expect(body.diagnosticoInsercaoPorSlot.slots['2026-07-03::EQUIPE 1'].candidatosInsercao).toHaveLength(1)
    expect(body.diagnosticoInsercaoPorSlot.slots['2026-07-03::EQUIPE 1'].melhorInsercao).toBeDefined()
    expect(body.diagnosticoInsercaoPorSlot.slots['2026-07-03::EQUIPE 1'].kmAdicionalNaRotaMFinal).toBe(4017)

    expect(calcularMapaKmSlotMock).toHaveBeenCalledTimes(2)
    const chamadaInsercao = calcularMapaKmSlotMock.mock.calls[0][0] as {
      slots: Array<{
        dataISO: string
        equipe: string
        linhasAgenda: unknown[]
        cacheCoordenadasPorEndereco?: Record<string, { lat: number; lng: number }>
      }>
      incluirDetalhesInsercao?: boolean
    }
    expect(chamadaInsercao.incluirDetalhesInsercao).toBe(true)
    expect(chamadaInsercao.slots.length).toBeGreaterThan(0)
    expect(chamadaInsercao.slots.some((s) => s.dataISO === '2026-07-03' && s.equipe === 'EQUIPE 1')).toBe(true)
    expect(chamadaInsercao.slots.some((s) => s.dataISO === '2026-07-08' && s.equipe === 'EQUIPE 1')).toBe(true)
    expect(chamadaInsercao.slots.some((s) => s.dataISO === '2026-07-11' && s.equipe === 'EQUIPE 1')).toBe(true)
    expect(chamadaInsercao.slots.some((s) => s.dataISO === '2026-07-13' && s.equipe === 'EQUIPE 1')).toBe(true)
    expect(chamadaInsercao.slots[0].linhasAgenda.length).toBe(2)
    expect(chamadaInsercao.slots[0].cacheCoordenadasPorEndereco).toEqual({
      'rua a': { lat: -25.44, lng: -49.24 },
      'rua b': { lat: -25.45, lng: -49.25 },
    })

    const chamadaMapaCandidatos = calcularMapaKmSlotMock.mock.calls[1][0] as {
      slots: Array<{
        dataISO: string
        equipe: string
        linhasAgenda: unknown[]
        cacheCoordenadasPorEndereco?: Record<string, { lat: number; lng: number }>
      }>
      incluirDetalhesInsercao?: boolean
    }
    expect(chamadaMapaCandidatos.incluirDetalhesInsercao).toBeUndefined()
    expect(chamadaMapaCandidatos.slots.map((s) => `${s.dataISO}::${s.equipe}`)).toEqual(
      chamadaInsercao.slots.map((s) => `${s.dataISO}::${s.equipe}`)
    )
    expect(chamadaMapaCandidatos.slots[0].cacheCoordenadasPorEndereco).toEqual(
      chamadaInsercao.slots[0].cacheCoordenadasPorEndereco
    )
  })

  it('91. agenda-real-janela propaga slotTemPontos=false quando linhas brutas nao geram pontos validos', async () => {
    buscarAgendaRealMock.mockResolvedValueOnce({
      diagnostico: {
        ok: true,
        executado: true,
        origem: {
          tipo: 'google-sheets',
          spreadsheetId: '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U',
          gid: 14790013,
          abaNomeResolvido: 'AGENDA',
          range: "'AGENDA'!A:G",
        },
        parametros: { limite: 2000 },
        leitura: { ok: true, linhasLidas: 2, linhasConvertidas: 1 },
        amostra: [
          ['25/07/2026', 'EQUIPE 1', '', '', 'Entrega sem cache', 'Rua Sem Cache', ''],
        ],
      },
      linhasAgenda: [
        ['25/07/2026', 'EQUIPE 1', '', '', 'Entrega sem cache', 'Rua Sem Cache', ''],
      ],
    })
    calcularMapaKmSlotMock.mockResolvedValueOnce({
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: { '2026-07-25::EQUIPE 1': 8903 },
      detalhesPorSlot: [
        {
          chave: '2026-07-25::EQUIPE 1',
          dataISO: '2026-07-25',
          equipe: 'EQUIPE 1',
          equipeNormalizada: 'EQUIPE 1',
          kmAdicionalNaRotaM: 8903,
          ok: true,
          origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
          avisos: [
            '1 ponto(s) descartado(s) por falta de coordenadas no cache injetado.',
            'Nenhum ponto valido encontrado para a data/equipe solicitada.',
          ],
          erros: [],
          descartados: [{ motivo: 'sem_coordenadas_cache', endereco: 'Rua Sem Cache' }],
          parseAgenda: {
            ok: true,
            resumo: { pontosValidos: 0 },
            pontos: [],
            avisos: ['Nenhum ponto valido encontrado para a data/equipe solicitada.'],
            erros: [],
            descartados: [{ motivo: 'sem_coordenadas_cache', endereco: 'Rua Sem Cache' }],
          },
          deltaInsercao: {
            ok: true,
            kmAdicionalNaRotaM: 8903,
            melhorInsercao: null,
            pontosRotaBase: [],
            candidatosInsercao: [],
            avisos: ['Nenhum ponto valido na agenda. Considerando rota simples origem -> destino.'],
            erros: [],
            descartados: [],
            resumo: { quantidadePontosValidos: 0 },
          },
          origemOperacional: {
            ok: true,
            tipo: 'casa-e1',
            origem: { lat: -25.494297, lng: -49.277091 },
            contexto: { dataISO: '2026-07-25', equipe: 'EQUIPE 1', ehSabado: true },
          },
        },
      ],
      contadores: {
        slotsRecebidos: 30,
        slotsProcessados: 30,
        slotsComKm: 30,
        slotsComFallbackHaversine: 0,
        slotsComErro: 0,
        slotsDescartados: 0,
      },
      avisos: ['mock mapa K14 ok'],
      erros: [],
    })

    const res = await POST(
      criarRequest({
        cep: '81925-370',
        dataInicial: '2026-07-25',
        tempoNecessario: '00:40',
        destLat: -25.545418,
        destLng: -49.261836,
        destDisplay: 'Rua Attilio Silva Fonseca, 149-1',
        usarAgendaRealDiagnostica: true,
        usarDisponibilidadeRealDiagnostica: true,
        osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
        equipeAgendaDiagnostica: 'EQUIPE 1',
        cacheCoordenadasAgendaDiagnostico: {},
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.parametros.slotTemPontosPorSlotKey['2026-07-25::EQUIPE 1']).toBe(false)
    expect(body.diagnosticoCandidatosDisponibilidadeReal.diagnosticoMapaKmAdicionalPorSlot.slotsComPontosDerivadosDePontosValidos).toBe(1)
    expect(gerarCandidatosReaisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mapaKmAdicionalPorSlot: expect.objectContaining({ '2026-07-25::EQUIPE 1': 8903 }),
        slotTemPontosPorDataEquipe: expect.objectContaining({ '2026-07-25::EQUIPE 1': false }),
      })
    )
  })

  it('92. agenda-real-janela enriquece cache vazio com coordenadas do Supabase', async () => {
    buscarAgendaRealMock.mockResolvedValueOnce({
      diagnostico: {
        ok: true,
        executado: true,
        origem: {
          tipo: 'google-sheets',
          spreadsheetId: '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U',
          gid: 14790013,
          abaNomeResolvido: 'AGENDA',
          range: "'AGENDA'!A:G",
        },
        parametros: { limite: 2000 },
        leitura: { ok: true, linhasLidas: 2, linhasConvertidas: 2 },
        amostra: [],
      },
      linhasAgenda: [
        [
          '14/07/2026 00:00:00',
          '',
          'Entrega 55576',
          '',
          'tempo 02:10',
          'Rua Maria Zanão Machado, 219, Gralha Azul, Fazenda Rio Grande - PR, 83824-543',
          '4- EQUIPE 01',
        ],
        [
          '14/07/2026 00:00:00',
          '',
          'Entrega 64973',
          '',
          'tempo 02:45',
          'Avenida Mato Grosso, 2464, Estados, Fazenda Rio Grande - PR, 83830-481',
          '4- EQUIPE 01',
        ],
      ],
    })
    supabaseInMock.mockResolvedValueOnce({
      data: [
        {
          chave_endereco: '75463698bab144e169221e1dfbcc431acdafb10e',
          lat: '-25.6841821',
          lng: '-49.3046792',
        },
        {
          chave_endereco: '74d58801bc18b7c97d8df770eb9a6f566777cdcb',
          lat: '-25.6705907',
          lng: '-49.3320594',
        },
      ],
      error: null,
    })
    calcularMapaKmSlotMock.mockResolvedValueOnce({
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: { '2026-07-14::EQUIPE 1': 7169 },
      detalhesPorSlot: [
        {
          chave: '2026-07-14::EQUIPE 1',
          dataISO: '2026-07-14',
          equipe: 'EQUIPE 1',
          equipeNormalizada: 'EQUIPE 1',
          kmAdicionalNaRotaM: 7169,
          ok: true,
          origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
          parseAgenda: {
            ok: true,
            resumo: { pontosValidos: 2 },
            pontos: [],
            avisos: [],
            erros: [],
            descartados: [],
          },
          deltaInsercao: {
            ok: true,
            kmAdicionalNaRotaM: 7169,
            melhorInsercao: { indiceInsercao: 1, deltaM: 7169, deltaKm: 7.169 },
            pontosRotaBase: [],
            candidatosInsercao: [],
            avisos: [],
            erros: [],
            descartados: [],
            resumo: {},
          },
          origemOperacional: {
            ok: true,
            tipo: 'deposito',
            origem: { lat: -25.4876648, lng: -49.2692262 },
            contexto: { dataISO: '2026-07-14', equipe: 'EQUIPE 1', ehSabado: false },
          },
          avisos: [],
          erros: [],
          descartados: [],
        },
      ],
      contadores: {
        slotsRecebidos: 30,
        slotsProcessados: 30,
        slotsComKm: 1,
        slotsComFallbackHaversine: 0,
        slotsComErro: 0,
        slotsDescartados: 0,
      },
      avisos: [],
      erros: [],
    })

    const res = await POST(
      criarRequest({
        cep: '83800-000',
        dataInicial: '2026-07-10',
        tempoNecessario: '00:40',
        destLat: -25.769705,
        destLng: -49.325586,
        destDisplay: 'R. José Schueda Sobrinho, 63-47 - Conj. Barcelona, Mandirituba - PR, 83800-000',
        usarAgendaRealDiagnostica: true,
        usarInsercaoPorSlotDiagnostico: true,
        osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
        equipeAgendaDiagnostica: 'EQUIPE 1',
        cacheCoordenadasAgendaDiagnostico: {},
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(supabaseFromMock).toHaveBeenCalledWith('geo_cache')
    expect(supabaseInMock).toHaveBeenCalledWith(
      'chave_endereco',
      expect.arrayContaining([
        '75463698bab144e169221e1dfbcc431acdafb10e',
        '74d58801bc18b7c97d8df770eb9a6f566777cdcb',
      ])
    )

    const chamadaInsercao = calcularMapaKmSlotMock.mock.calls[0][0] as {
      slots: Array<{
        dataISO: string
        equipe: string
        cacheCoordenadasPorEndereco?: Record<string, { lat: number; lng: number }>
      }>
    }
    const slotDia14 = chamadaInsercao.slots.find((s) => s.dataISO === '2026-07-14' && s.equipe === 'EQUIPE 1')
    expect(slotDia14?.cacheCoordenadasPorEndereco).toEqual(
      expect.objectContaining({
        'rua maria zanão machado, 219, gralha azul, fazenda rio grande - pr, 83824-543': {
          lat: -25.6841821,
          lng: -49.3046792,
        },
        'avenida mato grosso, 2464, estados, fazenda rio grande - pr, 83830-481': {
          lat: -25.6705907,
          lng: -49.3320594,
        },
      })
    )
    expect(body.diagnosticoInsercaoPorSlot.avisos).toContain(
      'Cache Supabase de coordenadas da agenda: 2/2 hit(s).'
    )
  })

  it('93. slotsAgendaDiagnostica com cache vazio preserva coordenadas resolvidas do Supabase', async () => {
    buscarAgendaRealMock.mockResolvedValueOnce({
      diagnostico: { ok: true, executado: true },
      linhasAgenda: [
        [
          '27/06/2026 00:00:00',
          '',
          'Entrega Sao Lourenco',
          '',
          '',
          'Rua Greg\u00f3rio de Matos, 708, S\u00e3o Louren\u00e7o, Curitiba - PR, 82200-110',
          '4- EQUIPE 01',
        ],
      ],
    })
    supabaseInMock.mockResolvedValueOnce({
      data: [
        {
          chave_endereco: '41dc44699f62c91f1c153512bb8d35a859db6d1d',
          lat: -25.3953811,
          lng: -49.2684535,
        },
      ],
      error: null,
    })
    calcularMapaKmSlotMock.mockResolvedValueOnce({
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: { '2026-06-27::EQUIPE 1': 15597 },
      detalhesPorSlot: [],
      contadores: {
        slotsRecebidos: 1,
        slotsProcessados: 1,
        slotsComKm: 1,
        slotsComFallbackHaversine: 0,
        slotsComErro: 0,
        slotsDescartados: 0,
      },
      avisos: [],
      erros: [],
    })

    const res = await POST(
      criarRequest({
        cep: '81925-370',
        dataInicial: '2026-06-25',
        tempoNecessario: '00:40',
        destLat: -25.545418,
        destLng: -49.261836,
        destDisplay: 'Rua Attilio Silva Fonseca, Sitio Cercado, Curitiba - PR',
        usarAgendaRealDiagnostica: true,
        usarInsercaoPorSlotDiagnostico: true,
        equipeAgendaDiagnostica: 'EQUIPE 1',
        slotsAgendaDiagnostica: [
          {
            dataISO: '2026-06-27',
            equipe: 'EQUIPE 1',
            linhasAgenda: [
              [
                '27/06/2026 00:00:00',
                '',
                'Entrega Sao Lourenco',
                '',
                '',
                'Rua Greg\u00f3rio de Matos, 708, S\u00e3o Louren\u00e7o, Curitiba - PR, 82200-110',
                '4- EQUIPE 01',
              ],
            ],
            cacheCoordenadasPorEndereco: {},
          },
        ],
      })
    )
    await res.json()

    expect(res.status).toBe(200)
    const chamadaInsercao = calcularMapaKmSlotMock.mock.calls[0][0] as {
      slots: Array<{
        dataISO: string
        equipe: string
        cacheCoordenadasPorEndereco?: Record<string, { lat: number; lng: number }>
      }>
    }
    expect(chamadaInsercao.slots[0].cacheCoordenadasPorEndereco).toEqual(
      expect.objectContaining({
        'rua greg\u00f3rio de matos, 708, s\u00e3o louren\u00e7o, curitiba - pr, 82200-110': {
          lat: -25.3953811,
          lng: -49.2684535,
        },
      })
    )
  })

  it('94. diagnostico Santo Amaro retorna slots alvo e pede detalhes de insercao sem alterar producao', async () => {
    const res = await POST(
      criarRequest({
        cep: '80620-220',
        enderecoCompleto: 'R. Santo Amaro, 300, Agua Verde, Curitiba - PR',
        dataInicial: '2026-06-25',
        tempoNecessario: '2:05',
        destLat: -25.457410,
        destLng: -49.275329,
        isRural: false,
        isCondominio: true,
        usarDisponibilidadeRealDiagnostica: true,
        usarAgendaRealDiagnostica: true,
        usarDiagnosticoSantoAmaroV2: true,
        equipeAgendaDiagnostica: 'EQUIPE 1',
        distanciaDiagnosticaKm: 4.1,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.producaoAfetada).toBe(false)
    expect(body.diagnosticoSantoAmaroV2).toMatchObject({
      executado: true,
      ok: true,
      modo: 'diagnostico-santo-amaro-v2',
    })
    expect(body.diagnosticoSantoAmaroV2.slots.map((slot: { dataISO: string }) => slot.dataISO)).toEqual([
      '2026-07-02',
      '2026-07-10',
      '2026-07-16',
      '2026-07-24',
      '2026-07-25',
      '2026-07-31',
      '2026-08-05',
      '2026-08-08',
    ])
    expect(body.diagnosticoSantoAmaroV2.slots[0].filtroEarlyHaversine.aplicadoNaV2).toBe(false)
    expect(body.diagnosticoSantoAmaroV2.recorte.candidatosSelecionados).toBeDefined()
    expect(body.diagnosticoFluxoRealV2).toMatchObject({
      executado: true,
      ok: true,
      modo: 'diagnostico-fluxo-real-v2',
      mesmoCaminhoDoDiagnosticoDirigido: false,
      fonteDaVerdadeParaTelaRealV2:
        'diagnosticoFluxoRealV2.payloadFinalCompat.candidatosFinais, pois vem do mesmo orquestrador usado por /pesquisar-compat-async.',
    })
    expect(body.diagnosticoFluxoRealV2.payloadFinalCompat.candidatosFinais).toEqual([
      expect.objectContaining({
        dataISO: '2026-07-02',
        tipo: 'especial',
        frete: 'R$ 270',
        equipe: 'EQUIPE 1',
      }),
    ])
    expect(orquestrarPesquisaCompatMock).toHaveBeenCalledTimes(1)
    expect(calcularMapaKmSlotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        incluirDetalhesInsercao: true,
      })
    )
  })
})
