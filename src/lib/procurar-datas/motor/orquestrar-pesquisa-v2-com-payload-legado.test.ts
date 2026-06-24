import { describe, expect, it, vi } from 'vitest'
import {
  orquestrarPesquisaV2ComPayloadLegado,
  type ConfigOrquestradorPayloadLegado,
} from './orquestrar-pesquisa-v2-com-payload-legado'
import type { PesquisarDatasRequest } from '../contratos'
import type {
  CandidatoFinalPesquisarDatasV2,
  PesquisarDatasV2Output,
} from './pesquisar-datas-v2'

const CONFIG: ConfigOrquestradorPayloadLegado = {
  latDeposito: -25.4876648,
  lngDeposito: -49.2692262,
  kmMaxViagem: 80,
  kmMaxValorFixo: 10,
  kmMaxLongaCidade: 25,
  kmMaxNaoViagem: 50,
  valorSemanaAte10km: 130,
  valorSabadoAte10km: 200,
  fatorMultiplicadorKmViagem: 8,
  multiplicadorKmNaoViagem: 12,
  valorDiaApos25kmSemana: 50,
  valorDiaApos25kmSabado: 80,
  precoCondominioAdicional: 30,
  valorAdicionalRotaEspecial: 70,
  valorAdicionalRotaPremium: 120,
  horaMarcadaValorAdicional: 80,
}

function criarRequest(overrides: Partial<PesquisarDatasRequest> = {}): PesquisarDatasRequest {
  return {
    cep: '80000-000',
    enderecoCompleto: 'Rua Teste, 123, Centro, Curitiba - PR',
    logradouro: 'Rua Teste',
    numero: '123',
    bairro: 'Centro',
    cidade: 'Curitiba',
    uf: 'PR',
    dataInicial: '2026-07-10',
    tempoNecessario: '00:40',
    isRural: false,
    isCondominio: true,
    isEncomenda: false,
    tipoBerco: 'Berco padrao',
    comoda: 'Comoda padrao',
    roupeiro: '',
    poltrona: '',
    painel: '',
    destLat: -25.44,
    destLng: -49.24,
    destDisplay: 'Rua Teste, 123, Centro, Curitiba - PR',
    ...overrides,
  }
}

function candidato(
  dataISO: string,
  tipo: string,
  rank: number,
  kmAdicionalNaRotaM: number
): CandidatoFinalPesquisarDatasV2 {
  return {
    dataISO,
    equipe: 'EQUIPE 1',
    tipo,
    rank,
    elegivel: true,
    horaMarcada: tipo === 'hora-marcada',
    kmAdicionalNaRotaM,
    origemKmAdicional: 'slot',
  }
}

function criarSaidaV2(candidatos: CandidatoFinalPesquisarDatasV2[], ok = true): PesquisarDatasV2Output {
  return {
    ok,
    modo: 'v2-pesquisar-paralelo',
    resultadoFinal: {
      candidatosFinais: candidatos,
      resumo: {
        totalRecebidos: candidatos.length,
        totalElegiveis: candidatos.length,
        totalRecortados: candidatos.length,
        normaisRecortados: candidatos.filter((c) => c.tipo === 'normal').length,
        especiaisRecortados: candidatos.filter((c) => c.tipo === 'especial').length,
        premiumsRecortados: candidatos.filter((c) => c.tipo === 'premium').length,
        horaMarcadaRecortados: candidatos.filter((c) => c.tipo === 'hora-marcada').length,
        maxNormaisAplicado: 3,
      },
      diasUsados: candidatos.map((c) => c.dataISO),
    },
    diagnosticoMinimo: {
      osrmBaseUrlUsado: 'https://osrm.lebebe.cloud',
      osrmFallbackUsado: false,
      quantidadeSlotsComPontos: 1,
      quantidadeSlotsSemPontos: 2,
      slotsComKm: candidatos.length,
      slotsComFallbackHaversine: 0,
      cacheAgenda: {
        hashesConsultados: 0,
        hitsSupabase: 0,
        enderecosSemHash: 0,
      },
      avisos: ['diagnostico v2 preservado'],
    },
    erros: ok ? undefined : ['erro controlado v2'],
  }
}

function depsBase(saidaV2 = criarSaidaV2([
  candidato('2026-07-10', 'normal', 1, 99999),
  candidato('2026-07-12', 'especial', 2, 1),
])) {
  return {
    pesquisarDatas: vi.fn().mockResolvedValue(saidaV2),
    buscarConfig: vi.fn().mockResolvedValue(CONFIG),
    buscarRota: vi.fn().mockResolvedValue({ ok: true, distanciaM: 8000 }),
    agoraMs: vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(2_500),
  }
}

describe('orquestrarPesquisaV2ComPayloadLegado', () => {
  it('gera PayloadCompacto com fretes preenchidos usando distKm deposito -> destino', async () => {
    const deps = depsBase()

    const resultado = await orquestrarPesquisaV2ComPayloadLegado(criarRequest(), deps)

    expect(resultado.ok).toBe(true)
    expect(resultado.payload.candidates.map((c) => c.frete)).toEqual(['R$ 200', 'R$ 270'])
    expect(resultado.diagnosticoPayloadLegado).toMatchObject({
      fretesMontados: 2,
      freteOrigem: 'dist-km-deposito-destino',
    })
    expect(resultado.diagnosticoPayloadLegado.distKmDepositoDestino?.distKm).toBe(8)
    expect(resultado.diagnosticoMinimo?.avisos).toEqual(['diagnostico v2 preservado'])
    expect(deps.buscarRota).toHaveBeenCalledWith(
      { lat: CONFIG.latDeposito, lng: CONFIG.lngDeposito },
      { lat: -25.44, lng: -49.24 }
    )
  })

  it('continua com frete vazio e avisos quando distKm falha', async () => {
    const deps = depsBase()
    deps.buscarRota.mockResolvedValue({ ok: false, distanciaM: null, erro: 'HTTP 503' })

    const resultado = await orquestrarPesquisaV2ComPayloadLegado(criarRequest(), deps)

    expect(resultado.ok).toBe(true)
    expect(resultado.payload.candidates.map((c) => c.frete)).toEqual(['', ''])
    expect(resultado.diagnosticoPayloadLegado.freteOrigem).toBe('ausente')
    expect(resultado.avisos.some((aviso) => aviso.includes('distKm deposito -> destino indisponivel'))).toBe(true)
    expect(resultado.avisos.some((aviso) => aviso.includes('Nao calculado a partir de kmAdicionalNaRotaM'))).toBe(true)
  })

  it('nao usa kmAdicionalNaRotaM como frete quando diverge do distKm retornado', async () => {
    const deps = depsBase(criarSaidaV2([
      candidato('2026-07-10', 'normal', 1, 50000),
    ]))
    deps.buscarRota.mockResolvedValue({ ok: true, distanciaM: 20_000 })

    const resultado = await orquestrarPesquisaV2ComPayloadLegado(criarRequest(), deps)

    expect(resultado.diagnosticoPayloadLegado.distKmDepositoDestino?.distKm).toBe(20)
    expect(resultado.saidaV2.resultadoFinal.candidatosFinais[0].kmAdicionalNaRotaM).toBe(50000)
    expect(resultado.payload.candidates[0].frete).toBe('R$ 290')
  })

  it('retorna payload controlado quando a busca v2 vem sem candidatos ou falha', async () => {
    const deps = depsBase(criarSaidaV2([], false))

    const resultado = await orquestrarPesquisaV2ComPayloadLegado(criarRequest(), deps)

    expect(resultado.ok).toBe(false)
    expect(resultado.payload.candidates).toEqual([])
    expect(resultado.avisos.some((aviso) => aviso.includes('Busca v2 sem candidatos finais'))).toBe(true)
    expect(resultado.avisos.some((aviso) => aviso.includes('saidaV2 erro: erro controlado v2'))).toBe(true)
    expect(deps.buscarConfig).not.toHaveBeenCalled()
    expect(deps.buscarRota).not.toHaveBeenCalled()
  })

  it('retorna payload controlado com frete vazio quando configuracao de deposito e invalida', async () => {
    const deps = depsBase()
    deps.buscarConfig.mockResolvedValue({
      ...CONFIG,
      latDeposito: NaN,
    })

    const resultado = await orquestrarPesquisaV2ComPayloadLegado(criarRequest(), deps)

    expect(resultado.ok).toBe(true)
    expect(resultado.payload.candidates.map((c) => c.frete)).toEqual(['', ''])
    expect(resultado.diagnosticoPayloadLegado.distKmDepositoDestino?.ok).toBe(false)
    expect(resultado.avisos.some((aviso) => aviso.includes('Coordenadas do deposito invalidas'))).toBe(true)
    expect(deps.buscarRota).not.toHaveBeenCalled()
  })
})
