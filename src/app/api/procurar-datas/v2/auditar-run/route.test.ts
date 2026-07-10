import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'

const requireModuleAccessMock = vi.hoisted(() => vi.fn())
const createServiceClientMock = vi.hoisted(() => vi.fn())
const buscarConfigMock = vi.hoisted(() => vi.fn())
const buscarAgendaMock = vi.hoisted(() => vi.fn())
const buscarDisponibilidadeMock = vi.hoisted(() => vi.fn())
const resolverCacheMock = vi.hoisted(() => vi.fn())
const calcularMapaMock = vi.hoisted(() => vi.fn())
const gerarCandidatosMock = vi.hoisted(() => vi.fn())
const recortarMock = vi.hoisted(() => vi.fn())
const buscarEnderecoGeoCacheMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/module-access', () => ({
  requireModuleAccess: requireModuleAccessMock,
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: createServiceClientMock,
}))

vi.mock('@/lib/procurar-datas/config-service', () => ({
  buscarConfiguracoesProcurarDatas: buscarConfigMock,
}))

vi.mock('@/lib/procurar-datas/motor/agenda-real-helper', () => ({
  buscarAgendaRealDiagnosticaComDados: buscarAgendaMock,
}))

vi.mock('@/lib/procurar-datas/motor/disponibilidade-real-helper', () => ({
  buscarDisponibilidadeRealDiagnosticaComDados: buscarDisponibilidadeMock,
}))

vi.mock('@/lib/procurar-datas/motor/cache-coordenadas-agenda-diagnostico', () => ({
  montarFormGeoCachePorEnderecoAgenda: vi.fn(),
  resolverCacheCoordenadasAgendaDiagnostico: resolverCacheMock,
}))

vi.mock('@/lib/procurar-datas/endereco-cache', () => ({
  buscarEnderecoNoGeoCache: buscarEnderecoGeoCacheMock,
}))

vi.mock('@/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot', () => ({
  calcularMapaKmAdicionalPorSlotControladoV2: calcularMapaMock,
}))

vi.mock('@/lib/procurar-datas/motor/osrm-table-client-diagnostico', () => ({
  criarBuscarMatrizOSRMTableDiagnosticoV2: vi.fn(() => vi.fn()),
}))

vi.mock('@/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real', () => ({
  gerarCandidatosComDisponibilidadeRealV2: gerarCandidatosMock,
}))

vi.mock('@/lib/procurar-datas/motor/recortar-candidatos-legado-equivalente', () => ({
  recortarCandidatosLegadoEquivalente: recortarMock,
}))

function criarRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/procurar-datas/v2/auditar-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const snapshotTecnicoBase = {
  candidatosFinais: [
    {
      slotKey: '2026-08-15::EQUIPE 1',
      dataISO: '2026-08-15',
      equipe: 'EQUIPE 1',
      elegivel: true,
      tipoOriginal: 'normal',
      motivos: [],
      slotAvailMin: 60,
      serviceMin: 40,
      kmAdicionalNaRotaM: 797,
      origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
      filtroEarly: null,
      slotTemPontos: true,
    },
  ],
  contadoresMapaKm: {
    slotsRecebidos: 100,
    slotsProcessados: 100,
    slotsComKm: 94,
    slotsComFallbackHaversine: 0,
    slotsComErro: 1,
    slotsDescartados: 5,
  },
  fonteAgenda: 'google-sheets',
  fonteDisponibilidade: 'google-sheets',
}

const resultadosSalvosBase = [
  {
    rank: 1,
    dateISO: '2026-08-15',
    date: '2026-08-15',
    dateDM: '15/08',
    weekday: 'Sexta',
    daysLeftTxt: '5 d',
    encomenda: 'Não',
    frete: 'R$ 120',
    team: 'EQUIPE 1',
    tipo: 'normal',
    isExtra: false,
    avisoHoraMarcada: '',
  },
]

const configBase = {
  ok: true,
  config: {
    diasPesquisaAgenda: 30,
    supabaseTable: 'geo_cache',
    osrmBaseUrl: 'https://osrm.lebebe.cloud',
    latDeposito: -25.4284,
    lngDeposito: -49.2725,
    latCasaE1: -25.44,
    lngCasaE1: -49.28,
    latCasaE2: -25.45,
    lngCasaE2: -49.29,
    kmMaxEntrePontosKm: 8,
    kmAdicionalMaxNaRotaM: 6000,
    kmAdicionalMaxNaRotaEspecialM: 10000,
    kmAdicionalMaxNaRotaPremiumM: 18000,
    kmMaximoNaSemanaM: 300000,
    kmMaximoNoSabadoM: 200000,
    horaMarcadaHorasAMais: 4,
  },
}

const agendaRealBase = {
  diagnostico: { ok: true, linhasLidas: 506, fonte: 'google-sheets' },
  linhasAgenda: [],
}

const disponibilidadeRealBase = {
  diagnostico: { ok: true, total: 200, fonte: 'google-sheets' },
  disponibilidades: [],
}

const cacheAgendaBase = {
  cacheCoordenadasPorEndereco: {},
  hashesConsultados: 10,
  hitsSupabase: 5,
  enderecosSemHash: 2,
  avisos: [],
}

const mapaPorSlotBase = {
  detalhesPorSlot: [],
  mapa: {},
  contadores: {
    slotsRecebidos: 100,
    slotsProcessados: 100,
    slotsComKm: 94,
    slotsComFallbackHaversine: 0,
    slotsComErro: 1,
    slotsDescartados: 5,
  },
  ok: true,
  avisos: [],
  erros: [],
}

const candidatosBase = {
  candidatos: [],
  candidatosOrdenados: [],
  avisos: [],
}

const recorteBase = {
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
  avisos: [],
}

function setupSupabaseMock(pesquisaRow: Record<string, unknown>) {
  const supabaseMock = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({ data: pesquisaRow, error: null })
                ),
              })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({ data: pesquisaRow, error: null })
              ),
            })),
          })),
        })),
      })),
    })),
  }
  createServiceClientMock.mockReturnValue(supabaseMock)
  return supabaseMock
}

beforeEach(() => {
  vi.clearAllMocks()
  requireModuleAccessMock.mockResolvedValue({ ok: true, response: null })
  buscarConfigMock.mockResolvedValue(configBase)
  buscarAgendaMock.mockResolvedValue(agendaRealBase)
  buscarDisponibilidadeMock.mockResolvedValue(disponibilidadeRealBase)
  resolverCacheMock.mockResolvedValue(cacheAgendaBase)
  calcularMapaMock.mockResolvedValue(mapaPorSlotBase)
  gerarCandidatosMock.mockReturnValue(candidatosBase)
  recortarMock.mockReturnValue(recorteBase)
  buscarEnderecoGeoCacheMock.mockResolvedValue({ status: 'miss' })
})

describe('POST /api/procurar-datas/v2/auditar-run — snapshot técnico', () => {
  it('inclui snapshotTecnicoDisponivel=true e snapshotTecnico no response quando snapshot existe', async () => {
    const pesquisaRow = {
      id: 'a00e378b-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok123',
      run_id: 'run123',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
        snapshotTecnico: snapshotTecnicoBase,
      },
      resultados_json: resultadosSalvosBase,
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run123' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.snapshotTecnicoDisponivel).toBe(true)
    expect(json.snapshotTecnico).not.toBeNull()
    expect(json.snapshotTecnico.candidatosFinais).toHaveLength(1)
    expect(json.snapshotTecnico.candidatosFinais[0].slotKey).toBe('2026-08-15::EQUIPE 1')
  })

  it('inclui snapshotTecnicoDisponivel=false quando snapshot não existe', async () => {
    const pesquisaRow = {
      id: 'b00e378b-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok456',
      run_id: 'run456',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
      },
      resultados_json: resultadosSalvosBase,
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run456' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.snapshotTecnicoDisponivel).toBe(false)
    expect(json.snapshotTecnico).toBeNull()
  })

  it('inclui divergenciasSnapshot comparando resultado salvo x snapshot', async () => {
    const pesquisaRow = {
      id: 'c00e378b-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok789',
      run_id: 'run789',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
        snapshotTecnico: {
          ...snapshotTecnicoBase,
          candidatosFinais: [
            {
              ...snapshotTecnicoBase.candidatosFinais[0],
              tipoOriginal: 'especial',
            },
          ],
        },
      },
      resultados_json: resultadosSalvosBase,
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run789' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.comparacao.divergenciasSnapshot).toBeDefined()
    const tipoDiv = json.comparacao.divergenciasSnapshot.find(
      (d: { tipo: string }) => d.tipo === 'tipo-divergente-snapshot'
    )
    expect(tipoDiv).toBeDefined()
    expect(tipoDiv.severidade).toBe('forte')
    expect(tipoDiv.detalhe).toContain('normal')
    expect(tipoDiv.detalhe).toContain('especial')
  })

  it('marca recalculoConclusivo=false quando agenda tem 0 linhas', async () => {
    const pesquisaRow = {
      id: 'd00e378b-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok000',
      run_id: 'run000',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
        snapshotTecnico: snapshotTecnicoBase,
      },
      resultados_json: resultadosSalvosBase,
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)
    buscarAgendaMock.mockResolvedValue({
      diagnostico: { ok: true, linhasLidas: 0, fonte: 'google-sheets' },
      linhasAgenda: [],
    })

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run000' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.comparacao.recalculoConclusivo.conclusivo).toBe(false)
    expect(json.comparacao.recalculoConclusivo.motivos).toBeDefined()
    expect(json.comparacao.recalculoConclusivo.motivos.length).toBeGreaterThan(0)
  })

  it('rebaixa divergências para aviso quando recálculo não é conclusivo', async () => {
    const pesquisaRow = {
      id: 'e00e378b-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok111',
      run_id: 'run111',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
        snapshotTecnico: snapshotTecnicoBase,
      },
      resultados_json: [
        {
          ...resultadosSalvosBase[0],
          tipo: 'especial',
        },
      ],
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)
    buscarAgendaMock.mockResolvedValue({
      diagnostico: { ok: true, linhasLidas: 0, fonte: 'google-sheets' },
      linhasAgenda: [],
    })

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run111' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.comparacao.recalculoConclusivo.conclusivo).toBe(false)
    const divergencias = json.comparacao.divergencias
    const tipoDiv = divergencias.find(
      (d: { tipo: string }) => d.tipo === 'tipo-divergente'
    )
    if (tipoDiv) {
      expect(tipoDiv.severidade).toBe('aviso')
      expect(tipoDiv.detalhe).toContain('recálculo não conclusivo')
    }
  })

  it('inclui limitacoesHistoricas mencionando snapshot técnico', async () => {
    const pesquisaRow = {
      id: 'f00e378b-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok222',
      run_id: 'run222',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
        snapshotTecnico: snapshotTecnicoBase,
      },
      resultados_json: resultadosSalvosBase,
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run222' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    const limitacoes = json.comparacao.limitacoesHistoricas
    const snapshotMention = limitacoes.find((l: string) =>
      l.includes('snapshot técnico')
    )
    expect(snapshotMention).toBeDefined()
  })

  // --- Novos testes: coerência salvo x snapshot ---

  const candidatoIndisponivel = {
    id: 'cand-ind-1',
    elegivel: false,
    tipo: 'indisponivel',
    horaMarcada: false,
    elegivelHoraMarcada: false,
    dataISO: '2026-08-15',
    indice: 0,
    diaSemana: 5,
    ehSabado: false,
    ehDomingo: false,
    slotTemPontos: true,
    equipe: 'EQUIPE 1',
    operacional: {
      ativa: false,
      disponivelMin: 0,
      suficienteParaServico: false,
      tempoNecessarioMin: 40,
      slotAvailMin: 0,
      serviceMin: 40,
    },
    distancia: {
      distanciaKm: null,
      kmAdicionalNaRotaM: null,
      origemKm: null,
      chaveSlotKm: null,
    },
    frete: {
      valorFrete: null,
      tipoFrete: null,
    },
    motivos: ['agenda fechada'],
    avisos: [],
    limites: {
      limiteBaseM: 6000,
      limiteEspecialM: 10000,
      limitePremiumM: 18000,
    },
  }

  it('1. quando salvo bate com snapshot elegível, divergência contra recálculo atual vira aviso, não forte', async () => {
    const pesquisaRow = {
      id: 'g10-aaa-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok-g10',
      run_id: 'run-g10',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
        snapshotTecnico: snapshotTecnicoBase,
      },
      resultados_json: resultadosSalvosBase,
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)
    buscarAgendaMock.mockResolvedValue({
      diagnostico: { ok: true, linhasLidas: 506, fonte: 'google-sheets' },
      linhasAgenda: [{ data: '2026-08-15', equipe: 'EQUIPE 1', endereco: 'Rua A' }],
    })
    gerarCandidatosMock.mockReturnValue({
      candidatos: [candidatoIndisponivel],
      candidatosOrdenados: [candidatoIndisponivel],
      avisos: [],
    })

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run-g10' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.comparacao.recalculoConclusivo.conclusivo).toBe(true)
    const divergencias = json.comparacao.divergencias

    const tipoDiv = divergencias.find((d: { tipo: string }) => d.tipo === 'tipo-divergente')
    expect(tipoDiv).toBeDefined()
    expect(tipoDiv.severidade).toBe('aviso')
    expect(tipoDiv.detalhe).toContain('coerente com o snapshot técnico da produção')

    const naoElegivel = divergencias.find((d: { tipo: string }) => d.tipo === 'resultado-salvo-nao-elegivel-atual')
    expect(naoElegivel).toBeDefined()
    expect(naoElegivel.severidade).toBe('aviso')
    expect(naoElegivel.detalhe).toContain('coerente com o snapshot técnico da produção')
  })

  it('2. quando salvo não bate com snapshot (tipo divergente), divergência continua forte', async () => {
    const pesquisaRow = {
      id: 'g20-bbb-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok-g20',
      run_id: 'run-g20',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
        snapshotTecnico: {
          ...snapshotTecnicoBase,
          candidatosFinais: [
            {
              ...snapshotTecnicoBase.candidatosFinais[0],
              tipoOriginal: 'especial',
            },
          ],
        },
      },
      resultados_json: resultadosSalvosBase,
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)
    buscarAgendaMock.mockResolvedValue({
      diagnostico: { ok: true, linhasLidas: 506, fonte: 'google-sheets' },
      linhasAgenda: [{ data: '2026-08-15', equipe: 'EQUIPE 1', endereco: 'Rua A' }],
    })
    gerarCandidatosMock.mockReturnValue({
      candidatos: [candidatoIndisponivel],
      candidatosOrdenados: [candidatoIndisponivel],
      avisos: [],
    })

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run-g20' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    const divergencias = json.comparacao.divergencias

    const tipoDiv = divergencias.find((d: { tipo: string }) => d.tipo === 'tipo-divergente')
    expect(tipoDiv).toBeDefined()
    expect(tipoDiv.severidade).toBe('forte')
    expect(tipoDiv.detalhe).not.toContain('coerente com o snapshot técnico')
  })

  it('3. quando snapshot diz elegivel=false, divergência continua forte', async () => {
    const pesquisaRow = {
      id: 'g30-ccc-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok-g30',
      run_id: 'run-g30',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
        snapshotTecnico: {
          ...snapshotTecnicoBase,
          candidatosFinais: [
            {
              ...snapshotTecnicoBase.candidatosFinais[0],
              elegivel: false,
              motivos: ['tempo insuficiente'],
            },
          ],
        },
      },
      resultados_json: resultadosSalvosBase,
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)
    buscarAgendaMock.mockResolvedValue({
      diagnostico: { ok: true, linhasLidas: 506, fonte: 'google-sheets' },
      linhasAgenda: [{ data: '2026-08-15', equipe: 'EQUIPE 1', endereco: 'Rua A' }],
    })
    gerarCandidatosMock.mockReturnValue({
      candidatos: [candidatoIndisponivel],
      candidatosOrdenados: [candidatoIndisponivel],
      avisos: [],
    })

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run-g30' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    const divergencias = json.comparacao.divergencias

    const naoElegivel = divergencias.find((d: { tipo: string }) => d.tipo === 'resultado-salvo-nao-elegivel-atual')
    expect(naoElegivel).toBeDefined()
    expect(naoElegivel.severidade).toBe('forte')
    expect(naoElegivel.detalhe).not.toContain('coerente com o snapshot técnico')
  })

  it('4. quando não existe snapshot técnico, manter comportamento anterior (forte se conclusivo)', async () => {
    const pesquisaRow = {
      id: 'g40-ddd-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok-g40',
      run_id: 'run-g40',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
      },
      resultados_json: resultadosSalvosBase,
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)
    buscarAgendaMock.mockResolvedValue({
      diagnostico: { ok: true, linhasLidas: 506, fonte: 'google-sheets' },
      linhasAgenda: [{ data: '2026-08-15', equipe: 'EQUIPE 1', endereco: 'Rua A' }],
    })
    gerarCandidatosMock.mockReturnValue({
      candidatos: [candidatoIndisponivel],
      candidatosOrdenados: [candidatoIndisponivel],
      avisos: [],
    })

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run-g40' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.snapshotTecnicoDisponivel).toBe(false)
    const divergencias = json.comparacao.divergencias

    const tipoDiv = divergencias.find((d: { tipo: string }) => d.tipo === 'tipo-divergente')
    expect(tipoDiv).toBeDefined()
    expect(tipoDiv.severidade).toBe('forte')
    expect(tipoDiv.detalhe).not.toContain('coerente com o snapshot técnico')
  })

  it('5. quando recálculo muda disponibilidade para agenda fechada, mas snapshot estava elegível, classifica como mudança posterior/aviso', async () => {
    const pesquisaRow = {
      id: 'g50-eee-c66d-4f29-96ed-d42acfc6e5ec',
      created_at: '2026-07-10T10:00:00Z',
      usuario_id: null,
      usuario_email: 'test@test.com',
      client_token: 'tok-g50',
      run_id: 'run-g50',
      motor_versao: 'v2',
      origem: 'procurar-datas-v2',
      cep: '80000-000',
      numero_residencia: '100',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      endereco_completo: 'Rua Teste, 100, Centro, Curitiba - PR',
      latitude: -25.4,
      longitude: -49.2,
      parametros_json: {
        dataInicial: '2026-08-15',
        tempoNecessario: '00:40',
        snapshotTecnico: snapshotTecnicoBase,
      },
      resultados_json: resultadosSalvosBase,
      status: 'success',
      erro_mensagem: null,
      duracao_ms: 5000,
      started_at: '2026-07-10T10:00:00Z',
      finished_at: '2026-07-10T10:00:05Z',
    }
    setupSupabaseMock(pesquisaRow)
    buscarAgendaMock.mockResolvedValue({
      diagnostico: { ok: true, linhasLidas: 506, fonte: 'google-sheets' },
      linhasAgenda: [{ data: '2026-08-15', equipe: 'EQUIPE 1', endereco: 'Rua A' }],
    })
    gerarCandidatosMock.mockReturnValue({
      candidatos: [{
        ...candidatoIndisponivel,
        motivos: ['agenda fechada'],
        operacional: {
          ...candidatoIndisponivel.operacional,
          ativa: false,
        },
      }],
      candidatosOrdenados: [{
        ...candidatoIndisponivel,
        motivos: ['agenda fechada'],
        operacional: {
          ...candidatoIndisponivel.operacional,
          ativa: false,
        },
      }],
      avisos: [],
    })

    const res = await POST(criarRequest({ runIdOuPesquisaId: 'run-g50' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.comparacao.recalculoConclusivo.conclusivo).toBe(true)
    const divergencias = json.comparacao.divergencias

    const naoElegivel = divergencias.find((d: { tipo: string }) => d.tipo === 'resultado-salvo-nao-elegivel-atual')
    expect(naoElegivel).toBeDefined()
    expect(naoElegivel.severidade).toBe('aviso')
    expect(naoElegivel.detalhe).toContain('coerente com o snapshot técnico da produção')
    expect(naoElegivel.detalhe).toContain('mudança posterior de agenda/disponibilidade')

    const foraRecorte = divergencias.find((d: { tipo: string }) => d.tipo === 'resultado-salvo-fora-do-recorte-atual')
    expect(foraRecorte).toBeDefined()
    expect(foraRecorte.severidade).toBe('aviso')
    expect(foraRecorte.detalhe).toContain('coerente com o snapshot técnico da produção')
  })
})
