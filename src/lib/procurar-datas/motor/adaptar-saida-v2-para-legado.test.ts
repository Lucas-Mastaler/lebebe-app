import { describe, expect, it } from 'vitest'
import {
  adaptarSaidaV2ParaPayloadLegado,
  montarChaveFreteCandidatoLegado,
} from './adaptar-saida-v2-para-legado'
import { montarFretesLegadoPorDistKm } from './montar-fretes-legado-por-dist-km'
import type { PesquisarDatasRequest } from '../contratos'
import type {
  CandidatoFinalPesquisarDatasV2,
  PesquisarDatasV2Output,
} from './pesquisar-datas-v2'
import type { FreteParams } from './types'

type CenarioFixture = {
  nome: 'K13' | 'K14' | 'K15'
  request: PesquisarDatasRequest
  saidaV2: PesquisarDatasV2Output
  distKmDepositoDestino: number
}

const FRETE_PARAMS: FreteParams = {
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
}

const ADICIONAIS_FRETE = {
  valorAdicionalEspecial: 70,
  valorAdicionalPremium: 120,
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
    dataInicial: '2026-07-01',
    tempoNecessario: '00:40',
    isRural: false,
    isCondominio: true,
    isEncomenda: false,
    tipoBerco: 'Berco padrao',
    comoda: 'Comoda padrao',
    roupeiro: '',
    poltrona: '',
    painel: '',
    ...overrides,
  }
}

function candidato(
  dataISO: string,
  tipo: string,
  rank: number,
  kmAdicionalNaRotaM: number,
  equipe = 'EQUIPE 1'
): CandidatoFinalPesquisarDatasV2 {
  return {
    dataISO,
    equipe,
    tipo,
    rank,
    elegivel: true,
    horaMarcada: tipo === 'hora-marcada',
    kmAdicionalNaRotaM,
    origemKmAdicional: 'slot',
  }
}

function criarSaidaV2(
  candidatos: CandidatoFinalPesquisarDatasV2[]
): PesquisarDatasV2Output {
  return {
    ok: true,
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
      quantidadeSlotsComPontos: 0,
      quantidadeSlotsSemPontos: 0,
      slotsComKm: candidatos.length,
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

const CENARIO_K13: CenarioFixture = {
  nome: 'K13',
  request: criarRequest({
    cep: '81830-020',
    enderecoCompleto: 'Rua Cornelius Pries, 669, Xaxim, Curitiba - PR',
    logradouro: 'Rua Cornelius Pries',
    numero: '669',
    bairro: 'Xaxim',
    cidade: 'Curitiba',
    uf: 'PR',
    dataInicial: '2026-08-14',
    destLat: -25.5091859,
    destLng: -49.2671477,
    destDisplay: 'Rua Cornelius Pries, 669, Xaxim, Curitiba - PR',
  }),
  saidaV2: criarSaidaV2([
    candidato('2026-08-14', 'normal', 1, 1430),
    candidato('2026-08-15', 'normal', 2, 3158),
    candidato('2026-08-17', 'normal', 3, 4017),
  ]),
  distKmDepositoDestino: 8,
}

const CENARIO_K14: CenarioFixture = {
  nome: 'K14',
  request: criarRequest({
    cep: '81925-370',
    enderecoCompleto: 'Rua Attilio Silva Fonseca, 149-1 - Sitio Cercado, Curitiba - PR',
    logradouro: 'Rua Attilio Silva Fonseca',
    numero: '149-1',
    bairro: 'Sitio Cercado',
    cidade: 'Curitiba',
    uf: 'PR',
    dataInicial: '2026-06-25',
    destLat: -25.545418,
    destLng: -49.261836,
    destDisplay: 'Rua Attilio Silva Fonseca, 149-1 - Sitio Cercado, Curitiba - PR, 81925-370',
  }),
  saidaV2: criarSaidaV2([
    candidato('2026-07-02', 'especial', 1, 7650),
    candidato('2026-07-11', 'normal', 2, 4657),
    candidato('2026-07-13', 'normal', 3, 4019),
    candidato('2026-07-16', 'normal', 4, 3491),
  ]),
  distKmDepositoDestino: 8,
}

const CENARIO_K15: CenarioFixture = {
  nome: 'K15',
  request: criarRequest({
    cep: '83800-000',
    enderecoCompleto: 'R. Jose Schueda Sobrinho, 63-47 - Conj. Barcelona, Mandirituba - PR',
    logradouro: 'R. Jose Schueda Sobrinho',
    numero: '63-47',
    bairro: 'Conj. Barcelona',
    cidade: 'Mandirituba',
    uf: 'PR',
    dataInicial: '2026-07-10',
    destLat: -25.769705,
    destLng: -49.325586,
    destDisplay: 'R. Jose Schueda Sobrinho, 63-47 - Conj. Barcelona, Mandirituba - PR, 83800-000',
  }),
  saidaV2: criarSaidaV2([
    candidato('2026-07-14', 'premium', 1, 11533),
    candidato('2026-08-08', 'normal', 2, 32241),
    candidato('2026-08-15', 'normal', 3, 32241),
    candidato('2026-08-17', 'normal', 4, 33100),
  ]),
  distKmDepositoDestino: 8,
}

function montarFretesFixture(cenario: CenarioFixture) {
  return montarFretesLegadoPorDistKm({
    candidatos: cenario.saidaV2.resultadoFinal.candidatosFinais,
    distKm: cenario.distKmDepositoDestino,
    isRural: cenario.request.isRural === true,
    isCondominio: cenario.request.isCondominio === true,
    params: FRETE_PARAMS,
    ...ADICIONAIS_FRETE,
  }).fretes
}

function adaptarFixture(cenario: CenarioFixture, fretes = montarFretesFixture(cenario)) {
  return adaptarSaidaV2ParaPayloadLegado({
    saidaV2: cenario.saidaV2,
    requestOriginal: cenario.request,
    fretes,
    metadados: {
      searchTime: '12.5',
    },
    dataReferenciaISO: cenario.request.dataInicial,
  })
}

describe('adaptarSaidaV2ParaPayloadLegado', () => {
  it('K13: adapta 3 normais com fixture fiel da v2', () => {
    const resultado = adaptarFixture(CENARIO_K13)

    expect(resultado.ok).toBe(true)
    expect(resultado.payload.candidates).toHaveLength(3)
    expect(resultado.payload.candidates.map((c) => c.date)).toEqual([
      '2026-08-14',
      '2026-08-15',
      '2026-08-17',
    ])
    expect(resultado.payload.candidates.map((c) => c.tipo)).toEqual(['normal', 'normal', 'normal'])
    expect(resultado.payload.candidates.every((c) => c.isExtra === false)).toBe(true)
    expect(resultado.payload.candidates.map((c) => c.rank)).toEqual([1, 2, 3])
  })

  it('K14: adapta especial antes das 3 normais preservando ordem cronologica', () => {
    const resultado = adaptarFixture(CENARIO_K14)

    expect(resultado.payload.candidates.map((c) => `${c.date}:${c.tipo}`)).toEqual([
      '2026-07-02:especial',
      '2026-07-11:normal',
      '2026-07-13:normal',
      '2026-07-16:normal',
    ])
    expect(resultado.payload.candidates[0]).toMatchObject({
      tipo: 'especial',
      isExtra: true,
      frete: 'R$ 270',
    })
  })

  it('K15: adapta premium anterior a ultima normal com frete injetado', () => {
    const resultado = adaptarFixture(CENARIO_K15)

    expect(resultado.payload.candidates.map((c) => `${c.date}:${c.tipo}`)).toEqual([
      '2026-07-14:premium',
      '2026-08-08:normal',
      '2026-08-15:normal',
      '2026-08-17:normal',
    ])
    expect(resultado.payload.candidates[0]).toMatchObject({
      tipo: 'premium',
      isExtra: true,
      frete: 'R$ 320',
    })
    expect(resultado.payload.candidates[0].date < resultado.payload.candidates.at(-1)!.date).toBe(true)
  })

  it('formata dateISO legado-gmt3, dateDM, weekday e daysLeftTxt', () => {
    const resultado = adaptarFixture(CENARIO_K15)

    expect(resultado.payload.candidates[0]).toMatchObject({
      dateISO: '2026-07-14T03:00:00.000Z',
      date: '2026-07-14',
      dateDM: '14/07',
      weekday: 'Terça',
      daysLeftTxt: '4 d',
    })
  })

  it('monta campos obrigatorios do PayloadCompacto consumidos pelo frontend', () => {
    const resultado = adaptarFixture(CENARIO_K14)

    expect(resultado.payload).toMatchObject({
      ok: true,
      cep: '81925-370',
      tempo: '00:40',
      label: 'Sitio Cercado - Curitiba',
      address: 'Rua Attilio Silva Fonseca, 149-1 - Sitio Cercado, Curitiba - PR',
      addressShort: 'Rua Attilio Silva Fonseca, 149-1 - Sitio Cercado, Curitiba - PR',
      startFromISO: '2026-06-25',
      startFromDM: '25/06',
      isRural: false,
      isCondominio: true,
      searchTime: '12.5',
    })
    expect(resultado.payload.params).toContain('TEMPO NECESSÁRIO: 00:40')
    expect(resultado.payload.params).toContain('É CONDOMÍNIO?: Sim')
    expect(resultado.payload.candidates.every((c) => c.dateISO && c.dateDM && c.weekday)).toBe(true)
  })

  it('preserva dados suficientes para cand/meta do pre-agendamento legado', () => {
    const resultado = adaptarFixture(CENARIO_K15)
    const candidato = resultado.payload.candidates[0]

    const cand = {
      dateISO: candidato.dateISO,
      team: candidato.team,
      frete: candidato.frete || '',
      tipo: candidato.tipo || '',
    }
    const meta = {
      tempo: resultado.payload.tempo,
      label: resultado.payload.label,
      address: resultado.payload.address || resultado.payload.addressShort,
      cep: resultado.payload.cep,
      params: resultado.payload.params,
    }

    expect(cand).toMatchObject({
      dateISO: '2026-07-14T03:00:00.000Z',
      team: 'EQUIPE 1',
      frete: 'R$ 320',
      tipo: 'premium',
    })
    expect(meta.tempo).toBe('00:40')
    expect(meta.address).toContain('Mandirituba')
    expect(meta.cep).toBe('83800-000')
    expect(meta.params).toContain('PROCURAR A PARTIR DE: 10/07/2026')
  })

  it('deixa frete vazio e avisa quando frete nao for fornecido', () => {
    const resultado = adaptarFixture(CENARIO_K13, [])

    expect(resultado.payload.candidates.every((c) => c.frete === '')).toBe(true)
    expect(resultado.avisos).toHaveLength(3)
    expect(resultado.avisos.every((aviso) => aviso.includes('Nao calculado a partir de kmAdicionalNaRotaM'))).toBe(true)
  })

  it('preenche frete via distKm deposito -> destino ja calculado antes de adaptar', () => {
    const fretes = montarFretesFixture(CENARIO_K13)
    const resultado = adaptarFixture(CENARIO_K13, fretes)

    expect(fretes.map((f) => f.frete)).toEqual(['R$ 200', 'R$ 280', 'R$ 200'])
    expect(resultado.payload.candidates.map((c) => c.frete)).toEqual(['R$ 200', 'R$ 280', 'R$ 200'])
    expect(resultado.avisos).toEqual([])
  })

  it('nao usa kmAdicionalNaRotaM como frete mesmo quando o valor parece monetario', () => {
    const saidaV2 = criarSaidaV2([
      candidato('2026-07-10', 'normal', 1, 110),
    ])
    const resultado = adaptarSaidaV2ParaPayloadLegado({
      saidaV2,
      requestOriginal: criarRequest({ dataInicial: '2026-07-10' }),
    })

    expect(resultado.payload.candidates[0].frete).toBe('')
    expect(resultado.payload.candidates[0].frete).not.toBe('R$ 110')
    expect(resultado.avisos[0]).toContain('Nao calculado a partir de kmAdicionalNaRotaM')
  })

  it('usa rank da v2 para resolver fretes especificos por candidato', () => {
    const saidaV2 = criarSaidaV2([
      candidato('2026-07-10', 'normal', 10, 3000),
      candidato('2026-07-10', 'normal', 11, 3000),
    ])
    const resultado = adaptarSaidaV2ParaPayloadLegado({
      saidaV2,
      requestOriginal: criarRequest({ dataInicial: '2026-07-10' }),
      fretes: [
        { dataISO: '2026-07-10', equipe: 'EQUIPE 1', tipo: 'normal', rank: 10, frete: 'R$ 110' },
        { dataISO: '2026-07-10', equipe: 'EQUIPE 1', tipo: 'normal', rank: 11, frete: 'R$ 120' },
      ],
    })

    expect(resultado.payload.candidates.map((c) => c.rank)).toEqual([10, 11])
    expect(resultado.payload.candidates.map((c) => c.frete)).toEqual(['R$ 110', 'R$ 120'])
  })

  it('permite diferenciar chave de frete com rank para candidatos ambiguos', () => {
    const chaveRank1 = montarChaveFreteCandidatoLegado({
      dataISO: '2026-07-10',
      equipe: 'EQUIPE 1',
      tipo: 'normal',
      rank: 1,
    })
    const chaveRank2 = montarChaveFreteCandidatoLegado({
      dataISO: '2026-07-10',
      equipe: 'EQUIPE 1',
      tipo: 'normal',
      rank: 2,
    })

    expect(chaveRank1).not.toBe(chaveRank2)
  })
})
