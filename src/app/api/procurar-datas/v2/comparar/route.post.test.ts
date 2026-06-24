import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST, compararResultadosVivo } from './route'
import type { CandidatoNormalizado } from './route'
import { AppsScriptTimeoutError } from '@/lib/procurar-datas/apps-script'

const validarAcessoMock = vi.hoisted(() => vi.fn())
const chamarAppsScriptMock = vi.hoisted(() => vi.fn())
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

vi.mock('@/lib/procurar-datas/apps-script', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/procurar-datas/apps-script')>()
  return {
    ...actual,
    chamarAppsScriptProcurarDatas: chamarAppsScriptMock,
  }
})

vi.mock('@/lib/procurar-datas/motor/pesquisar-datas-v2', () => ({
  pesquisarDatasV2: pesquisarDatasV2Mock,
}))

function criarRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/procurar-datas/v2/comparar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const PAYLOAD_BASE = {
  cep: '81830-020',
  dataInicial: '2026-07-01',
  tempoNecessario: '00:40',
  destLat: -25.5091859,
  destLng: -49.2671477,
}

const LEGADO_OK_MOCK = {
  ok: true,
  payload: {
    candidates: [
      { dateISO: '2026-07-02T03:00:00.000Z', team: 'EQUIPE 1', tipo: 'especial', isExtra: true, rank: 1, avisoHoraMarcada: '' },
      { dateISO: '2026-07-10T03:00:00.000Z', team: 'EQUIPE 1', tipo: 'normal', isExtra: false, rank: 2, avisoHoraMarcada: '' },
      { dateISO: '2026-07-11T03:00:00.000Z', team: 'EQUIPE 1', tipo: 'normal', isExtra: false, rank: 3, avisoHoraMarcada: '' },
      { dateISO: '2026-07-13T03:00:00.000Z', team: 'EQUIPE 1', tipo: 'normal', isExtra: false, rank: 4, avisoHoraMarcada: '' },
    ],
  },
}

const V2_OK_MOCK = {
  ok: true,
  modo: 'v2-pesquisar-paralelo',
  aviso: 'Rota v2 paralela. Nao altera producao.',
  resultadoFinal: {
    candidatosFinais: [
      { dataISO: '2026-07-02', equipe: 'EQUIPE 1', tipo: 'especial', rank: 1, horaMarcada: false, kmAdicionalNaRotaM: 7158, origemKmAdicional: 'slot' },
      { dataISO: '2026-07-10', equipe: 'EQUIPE 1', tipo: 'normal', rank: 2, horaMarcada: false, kmAdicionalNaRotaM: 3200, origemKmAdicional: 'slot' },
      { dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', rank: 3, horaMarcada: false, kmAdicionalNaRotaM: 3000, origemKmAdicional: 'slot' },
      { dataISO: '2026-07-13', equipe: 'EQUIPE 1', tipo: 'normal', rank: 4, horaMarcada: false, kmAdicionalNaRotaM: 2800, origemKmAdicional: 'slot' },
    ],
    resumo: {
      totalRecebidos: 100,
      totalElegiveis: 20,
      totalRecortados: 4,
      normaisRecortados: 3,
      especiaisRecortados: 1,
      premiumsRecortados: 0,
      horaMarcadaRecortados: 0,
      maxNormaisAplicado: 3,
    },
    diasUsados: ['2026-07-02', '2026-07-10', '2026-07-11', '2026-07-13'],
  },
  diagnosticoMinimo: {
    osrmBaseUrlUsado: 'https://osrm.lebebe.cloud',
    osrmFallbackUsado: false,
    quantidadeSlotsComPontos: 0,
    quantidadeSlotsSemPontos: 10,
    slotsComKm: 10,
    slotsComFallbackHaversine: 0,
    cacheAgenda: { hashesConsultados: 0, hitsSupabase: 0, enderecosSemHash: 0 },
    avisos: [],
  },
}

describe('POST /api/procurar-datas/v2/comparar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validarAcessoMock.mockResolvedValue({ response: null, user: { id: 'user-test' } })
    chamarAppsScriptMock.mockResolvedValue(LEGADO_OK_MOCK)
    pesquisarDatasV2Mock.mockResolvedValue(V2_OK_MOCK)
  })

  it('retorna 401 quando acesso negado', async () => {
    validarAcessoMock.mockResolvedValue({
      response: NextResponse.json({ ok: false, erro: 'nao autorizado' }, { status: 401 }),
    })

    const res = await POST(criarRequest(PAYLOAD_BASE))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.erro).toBe('nao autorizado')
    expect(chamarAppsScriptMock).not.toHaveBeenCalled()
    expect(pesquisarDatasV2Mock).not.toHaveBeenCalled()
  })

  it('retorna 200 com modo v2-comparar-legado quando ambos executam com sucesso', async () => {
    const res = await POST(criarRequest(PAYLOAD_BASE))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.modo).toBe('v2-comparar-legado')
  })

  it('chama ApiPesquisarDatasApp no Apps Script e pesquisarDatasV2 com o mesmo body', async () => {
    await POST(criarRequest(PAYLOAD_BASE))
    expect(chamarAppsScriptMock).toHaveBeenCalledTimes(1)
    expect(chamarAppsScriptMock).toHaveBeenCalledWith(
      'ApiPesquisarDatasApp',
      [PAYLOAD_BASE],
      expect.objectContaining({ rota: 'v2/comparar-legado' })
    )
    expect(pesquisarDatasV2Mock).toHaveBeenCalledTimes(1)
    expect(pesquisarDatasV2Mock).toHaveBeenCalledWith(PAYLOAD_BASE)
  })

  it('retorna bloco legado, v2 e comparacao na resposta', async () => {
    const res = await POST(criarRequest(PAYLOAD_BASE))
    const json = await res.json()
    expect(json.legado).toBeDefined()
    expect(json.v2).toBeDefined()
    expect(json.comparacao).toBeDefined()
    expect(json.diagnosticoMinimo).toBeDefined()
  })

  it('mede tempoMs do legado e da v2', async () => {
    const res = await POST(criarRequest(PAYLOAD_BASE))
    const json = await res.json()
    expect(typeof json.legado.tempoMs).toBe('number')
    expect(typeof json.v2.tempoMs).toBe('number')
    expect(json.legado.tempoMs).toBeGreaterThanOrEqual(0)
    expect(json.v2.tempoMs).toBeGreaterThanOrEqual(0)
  })

  it('normaliza datas do legado de YYYY-MM-DDTHH:mm:ss.sssZ para YYYY-MM-DD', async () => {
    const res = await POST(criarRequest(PAYLOAD_BASE))
    const json = await res.json()
    const candidatosLegado = json.legado.resultadoNormalizado.candidatos
    for (const c of candidatosLegado) {
      expect(c.dataISO).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('retorna datasIguais=true quando legado e v2 retornam as mesmas datas', async () => {
    const res = await POST(criarRequest(PAYLOAD_BASE))
    const json = await res.json()
    expect(json.comparacao.datasIguais).toBe(true)
    expect(json.comparacao.divergencias).toHaveLength(0)
  })

  it('sinaliza divergencia critica quando v2 falha e legado ok', async () => {
    pesquisarDatasV2Mock.mockResolvedValue({
      ok: false,
      modo: 'v2-pesquisar-paralelo',
      erros: ['Erro simulado na v2'],
      resultadoFinal: {
        candidatosFinais: [],
        resumo: { totalRecebidos: 0, totalElegiveis: 0, totalRecortados: 0, normaisRecortados: 0, especiaisRecortados: 0, premiumsRecortados: 0, horaMarcadaRecortados: 0, maxNormaisAplicado: 3 },
        diasUsados: [],
      },
      diagnosticoMinimo: { osrmBaseUrlUsado: 'https://osrm.lebebe.cloud', osrmFallbackUsado: false, quantidadeSlotsComPontos: 0, quantidadeSlotsSemPontos: 0, slotsComKm: 0, slotsComFallbackHaversine: 0, cacheAgenda: { hashesConsultados: 0, hitsSupabase: 0, enderecosSemHash: 0 }, avisos: [] },
    })

    const res = await POST(criarRequest(PAYLOAD_BASE))
    const json = await res.json()

    const critico = json.comparacao.divergencias.find(
      (d: { severidade: string; tipo: string }) => d.severidade === 'critico' && d.tipo === 'v2-falhou-legado-ok'
    )
    expect(critico).toBeDefined()
  })

  it('retorna tipoErro=timeout quando legado estoura timeout e NAO gera avisos de data-apenas-na-v2', async () => {
    chamarAppsScriptMock.mockRejectedValue(new AppsScriptTimeoutError(170_000))

    const res = await POST(criarRequest(PAYLOAD_BASE))
    const json = await res.json()

    expect(json.legado.ok).toBe(false)
    expect(json.legado.tipoErro).toBe('timeout')

    // deve haver exatamente 1 critica de legado-timeout
    const timeout = json.comparacao.divergencias.filter(
      (d: { tipo: string }) => d.tipo === 'legado-timeout'
    )
    expect(timeout).toHaveLength(1)
    expect(timeout[0].severidade).toBe('critico')

    // NAO deve haver avisos de data-apenas-na-v2 (seria espurio)
    const espurios = json.comparacao.divergencias.filter(
      (d: { tipo: string }) => d.tipo === 'data-apenas-na-v2'
    )
    expect(espurios).toHaveLength(0)

    // v2 continua funcionando
    expect(json.v2.ok).toBe(true)
  })

  it('retorna tipoErro=apps-script-erro quando legado retorna ok=false sem timeout', async () => {
    chamarAppsScriptMock.mockResolvedValue({ ok: false, error: 'ERR_EXCEPTION' })

    const res = await POST(criarRequest(PAYLOAD_BASE))
    const json = await res.json()

    expect(json.legado.ok).toBe(false)
    expect(json.legado.tipoErro).toBe('apps-script-erro')

    const erroDivergencia = json.comparacao.divergencias.find(
      (d: { tipo: string }) => d.tipo === 'legado-erro'
    )
    expect(erroDivergencia).toBeDefined()
    expect(erroDivergencia.severidade).toBe('critico')

    // NAO deve haver avisos espurios de data-apenas-na-v2
    const espurios = json.comparacao.divergencias.filter(
      (d: { tipo: string }) => d.tipo === 'data-apenas-na-v2'
    )
    expect(espurios).toHaveLength(0)
  })

  it('sinaliza divergencia info quando legado tem mais normais que maxNormais v2', async () => {
    chamarAppsScriptMock.mockResolvedValue({
      ok: true,
      payload: {
        candidates: [
          { dateISO: '2026-07-10T03:00:00.000Z', team: 'EQUIPE 1', tipo: 'normal', rank: 1, avisoHoraMarcada: '' },
          { dateISO: '2026-07-11T03:00:00.000Z', team: 'EQUIPE 1', tipo: 'normal', rank: 2, avisoHoraMarcada: '' },
          { dateISO: '2026-07-13T03:00:00.000Z', team: 'EQUIPE 1', tipo: 'normal', rank: 3, avisoHoraMarcada: '' },
          { dateISO: '2026-07-14T03:00:00.000Z', team: 'EQUIPE 1', tipo: 'normal', rank: 4, avisoHoraMarcada: '' },
          { dateISO: '2026-07-17T03:00:00.000Z', team: 'EQUIPE 1', tipo: 'normal', rank: 5, avisoHoraMarcada: '' },
        ],
      },
    })
    pesquisarDatasV2Mock.mockResolvedValue({
      ...V2_OK_MOCK,
      resultadoFinal: {
        ...V2_OK_MOCK.resultadoFinal,
        candidatosFinais: [
          { dataISO: '2026-07-10', equipe: 'EQUIPE 1', tipo: 'normal', rank: 1, horaMarcada: false, kmAdicionalNaRotaM: 3200, origemKmAdicional: 'slot' },
          { dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', rank: 2, horaMarcada: false, kmAdicionalNaRotaM: 3000, origemKmAdicional: 'slot' },
          { dataISO: '2026-07-13', equipe: 'EQUIPE 1', tipo: 'normal', rank: 3, horaMarcada: false, kmAdicionalNaRotaM: 2800, origemKmAdicional: 'slot' },
        ],
        resumo: { ...V2_OK_MOCK.resultadoFinal.resumo, totalRecortados: 3, normaisRecortados: 3, especiaisRecortados: 0 },
      },
    })

    const res = await POST(criarRequest(PAYLOAD_BASE))
    const json = await res.json()

    const divInfo = json.comparacao.divergencias.filter(
      (d: { severidade: string; tipo: string }) =>
        d.severidade === 'info' &&
        d.tipo === 'data-apenas-no-legado-divergencia-esperada-maxnormais'
    )
    expect(divInfo.length).toBeGreaterThan(0)
  })

  it('retorna diagnosticoMinimo com flags de nao-alteracao de producao', async () => {
    const res = await POST(criarRequest(PAYLOAD_BASE))
    const json = await res.json()
    expect(json.diagnosticoMinimo.v2ParalelaNaoAfetaProducao).toBe(true)
    expect(json.diagnosticoMinimo.frontendInalterado).toBe(true)
    expect(json.diagnosticoMinimo.pesquisarLegadoInalterada).toBe(true)
  })

  it('retorna resumo com contagens de normais e extras de cada lado', async () => {
    const res = await POST(criarRequest(PAYLOAD_BASE))
    const json = await res.json()
    const { resumo } = json.comparacao
    expect(typeof resumo.quantidadeLegado).toBe('number')
    expect(typeof resumo.quantidadeV2).toBe('number')
    expect(typeof resumo.normaisLegado).toBe('number')
    expect(typeof resumo.normaisV2).toBe('number')
    expect(typeof resumo.extrasLegado).toBe('number')
    expect(typeof resumo.extrasV2).toBe('number')
    expect(typeof resumo.diferencaQuantidade).toBe('number')
  })
})

describe('compararResultadosVivo', () => {
  const candidatosBase: CandidatoNormalizado[] = [
    { dataISO: '2026-07-02', equipe: 'EQUIPE 1', tipo: 'especial', rank: 1 },
    { dataISO: '2026-07-10', equipe: 'EQUIPE 1', tipo: 'normal', rank: 2 },
    { dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', rank: 3 },
  ]

  it('retorna datasIguais=true quando listas sao identicas', () => {
    const resultado = compararResultadosVivo(candidatosBase, candidatosBase)
    expect(resultado.datasIguais).toBe(true)
    expect(resultado.divergencias).toHaveLength(0)
  })

  it('sinaliza data-apenas-no-legado como aviso quando nao e divergencia de maxNormais', () => {
    const v2 = [candidatosBase[0], candidatosBase[1]]
    const resultado = compararResultadosVivo(candidatosBase, v2, { maxNormaisAplicado: 3, normaisRecortados: 1 })
    const div = resultado.divergencias.find((d) => d.tipo === 'data-apenas-no-legado')
    expect(div).toBeDefined()
    expect(div?.severidade).toBe('aviso')
  })

  it('sinaliza data-apenas-no-legado-divergencia-esperada-maxnormais como info quando legado tem mais normais', () => {
    const legado: CandidatoNormalizado[] = [
      { dataISO: '2026-07-10', tipo: 'normal' },
      { dataISO: '2026-07-11', tipo: 'normal' },
      { dataISO: '2026-07-13', tipo: 'normal' },
      { dataISO: '2026-07-14', tipo: 'normal' },
    ]
    const v2: CandidatoNormalizado[] = [
      { dataISO: '2026-07-10', tipo: 'normal' },
      { dataISO: '2026-07-11', tipo: 'normal' },
      { dataISO: '2026-07-13', tipo: 'normal' },
    ]
    const resultado = compararResultadosVivo(legado, v2, { maxNormaisAplicado: 3, normaisRecortados: 3 })
    const divInfo = resultado.divergencias.filter(
      (d) => d.tipo === 'data-apenas-no-legado-divergencia-esperada-maxnormais' && d.severidade === 'info'
    )
    expect(divInfo).toHaveLength(1)
    expect(divInfo[0].legado).toBe('2026-07-14')
  })

  it('sinaliza tipo-divergente como aviso quando tipo difere na mesma data', () => {
    const legado: CandidatoNormalizado[] = [{ dataISO: '2026-07-10', tipo: 'normal' }]
    const v2: CandidatoNormalizado[] = [{ dataISO: '2026-07-10', tipo: 'especial' }]
    const resultado = compararResultadosVivo(legado, v2)
    const div = resultado.divergencias.find((d) => d.tipo === 'tipo-divergente')
    expect(div).toBeDefined()
    expect(div?.severidade).toBe('aviso')
    expect(div?.legado).toBe('normal')
    expect(div?.v2).toBe('especial')
  })

  it('sinaliza datas-duplicadas-v2 como critico', () => {
    const v2: CandidatoNormalizado[] = [
      { dataISO: '2026-07-10', tipo: 'normal' },
      { dataISO: '2026-07-10', tipo: 'normal' },
    ]
    const resultado = compararResultadosVivo([], v2)
    const div = resultado.divergencias.find((d) => d.tipo === 'datas-duplicadas-v2')
    expect(div).toBeDefined()
    expect(div?.severidade).toBe('critico')
  })

  it('sinaliza maxnormais-violado-v2 como critico quando v2 excede o limite', () => {
    const v2: CandidatoNormalizado[] = [
      { dataISO: '2026-07-10', tipo: 'normal' },
      { dataISO: '2026-07-11', tipo: 'normal' },
      { dataISO: '2026-07-13', tipo: 'normal' },
      { dataISO: '2026-07-14', tipo: 'normal' },
    ]
    const resultado = compararResultadosVivo([], v2, { maxNormaisAplicado: 3, normaisRecortados: 4 })
    const div = resultado.divergencias.find((d) => d.tipo === 'maxnormais-violado-v2')
    expect(div).toBeDefined()
    expect(div?.severidade).toBe('critico')
  })

  it('retorna resumo com contagens corretas', () => {
    const legado: CandidatoNormalizado[] = [
      { dataISO: '2026-07-10', tipo: 'normal' },
      { dataISO: '2026-07-11', tipo: 'especial' },
    ]
    const v2: CandidatoNormalizado[] = [
      { dataISO: '2026-07-10', tipo: 'normal' },
    ]
    const resultado = compararResultadosVivo(legado, v2)
    expect(resultado.resumo.quantidadeLegado).toBe(2)
    expect(resultado.resumo.quantidadeV2).toBe(1)
    expect(resultado.resumo.normaisLegado).toBe(1)
    expect(resultado.resumo.normaisV2).toBe(1)
    expect(resultado.resumo.extrasLegado).toBe(1)
    expect(resultado.resumo.extrasV2).toBe(0)
    expect(resultado.resumo.diferencaQuantidade).toBe(-1)
  })
})
