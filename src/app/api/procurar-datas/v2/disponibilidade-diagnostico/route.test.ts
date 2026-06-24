// ─────────────────────────────────────────────────────────────────────────────
// route.test.ts — GET /api/procurar-datas/v2/disponibilidade-diagnostico
//
// Todos os testes usam mocks para:
//   - @/lib/procurar-datas/google-sheets-tempo-disponivel → não chama credencial real
//   - validarAcessoProcurarDatas → autorizado por padrão
//   - buscarConfiguracoesProcurarDatas → config mínima com planilhaDeTempoDisponivel
//
// Nenhum teste depende de credencial real nem de googleapis diretamente.
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/procurar-datas/api', () => ({
  validarAcessoProcurarDatas: vi.fn(),
  respostaErroProcurarDatas: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
    return Response.json({ ok: false, error: message }, { status: 500 })
  }),
}))

vi.mock('@/lib/procurar-datas/config-service', () => ({
  buscarConfiguracoesProcurarDatas: vi.fn(),
}))

vi.mock('@/lib/procurar-datas/google-sheets-tempo-disponivel', () => ({
  lerPlanilhaTempoDisponivel: vi.fn(),
}))

// ─── Imports após mocks ───────────────────────────────────────────────────────

import { validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import { buscarConfiguracoesProcurarDatas } from '@/lib/procurar-datas/config-service'
import { lerPlanilhaTempoDisponivel } from '@/lib/procurar-datas/google-sheets-tempo-disponivel'
import { GET } from './route'

const validarAcessoMock = vi.mocked(validarAcessoProcurarDatas)
const buscarConfigMock = vi.mocked(buscarConfiguracoesProcurarDatas)
const lerPlanilhaMock = vi.mocked(lerPlanilhaTempoDisponivel)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function criarRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/procurar-datas/v2/disponibilidade-diagnostico')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString())
}

const PLANILHA_ID = '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U'

const TABELA_MOCK: string[][] = [
  ['DATA', 'EQUIPE', 'TEMPO UTILIZADO', 'TEMPO DISPONÍVEL', 'TEMPO EXCEDIDO', 'STATUS'],
  ['23/06/2026', 'Equipe 1', '06:00', '01:00', '', 'disponível'],
  ['13/06/2026', 'Equipe 1', '05:45', '00:00', '01:45', 'excedeu'],
  ['12/06/2026', 'Equipe 2', '07:00', '00:00', '', 'agenda fechada'],
]

const LEITURA_OK = {
  ok: true as const,
  tabela: TABELA_MOCK,
  planilhaId: PLANILHA_ID,
  gid: 65861376,
  abaNomeResolvido: 'TEMPO DISPONIVEL POR EQUIPE',
  range: "'TEMPO DISPONIVEL POR EQUIPE'!A:F",
}

const CONFIG_OK = {
  ok: true as const,
  origem: 'supabase' as const,
  faltantesNoSupabase: [],
  usandoFallbackPlanilha: false,
  lido_em: '2026-06-12T00:00:00.000Z',
  config: {
    planilhaDeTempoDisponivel: PLANILHA_ID,
    planilhaDaAgenda: '',
    planilhaDoCep: '',
    supabaseTable: '',
    diasPesquisaAgenda: 21,
    osrmBaseUrl: '',
    kmAdicionalMaxNaRotaM: 5000,
    kmMaximoNaSemanaM: 30000,
    kmMaximoNoSabadoM: 25000,
    kmAdicionalMaxNaRotaEspecialM: 10000,
    kmAdicionalMaxNaRotaPremiumM: 15000,
    kmMaxEntrePontosKm: 50,
    valorAdicionalRotaEspecial: 0,
    valorAdicionalRotaPremium: 0,
    horaMarcadaHorasAMais: 0,
    horaMarcadaValorAdicional: 0,
    equipe1Ativa: true,
    equipe2Ativa: true,
    enderecoDeposito: '',
    enderecoCasaEqp1: '',
    enderecoCasaEqp2: '',
    kmMaxViagem: 25,
    kmMaxValorFixo: 10,
    kmMaxLongaCidade: 25,
    kmMaxNaoViagem: 50,
    valorSemanaAte10km: 110,
    valorSabadoAte10km: 130,
    valorDiaApos25kmSemana: 0,
    valorDiaApos25kmSabado: 0,
    precoCondominioAdicional: 0,
    fatorMultiplicadorKmViagem: 1,
    multiplicadorKmNaoViagem: 1,
    tempoMaximoViagemSabadoMin: 60,
    latDeposito: -25.4876648,
    lngDeposito: -49.2692262,
    latCasaE1: -25.494297,
    lngCasaE1: -49.277091,
    latCasaE2: -25.494297,
    lngCasaE2: -49.277091,
  },
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('GET /api/procurar-datas/v2/disponibilidade-diagnostico', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validarAcessoMock.mockResolvedValue({ auth: { authorized: true }, response: null })
    buscarConfigMock.mockResolvedValue(CONFIG_OK)
    lerPlanilhaMock.mockResolvedValue(LEITURA_OK)
  })

  it('1. retorna ok: true quando leitura mockada traz linhas válidas', async () => {
    const res = await GET(criarRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.modo).toBe('diagnostico-planilha-tempo-disponivel')
    expect(body.producaoAfetada).toBe(false)
  })

  it('2. converte cabeçalho e linhas corretamente', async () => {
    const res = await GET(criarRequest())
    const body = await res.json()

    expect(body.leitura.ok).toBe(true)
    expect(body.leitura.linhasLidas).toBe(3)
    expect(body.leitura.linhasConvertidas).toBe(3)
    expect(body.leitura.cabecalhoReconhecido).toBe(true)
    expect(body.leitura.cabecalhoEncontrado[0]).toBe('DATA')
    expect(body.leitura.cabecalhoEncontrado[3]).toBe('TEMPO DISPONÍVEL')
  })

  it('3. retorna resumo do parser correto', async () => {
    const res = await GET(criarRequest())
    const body = await res.json()

    expect(body.parser.ok).toBe(true)
    expect(body.parser.resumo.linhasRecebidas).toBe(3)
    expect(body.parser.resumo.linhasValidas).toBe(3)
    expect(body.parser.resumo.linhasIgnoradas).toBe(0)
    expect(body.parser.resumo.disponiveis).toBe(1)
    expect(body.parser.resumo.excedidas).toBe(1)
    expect(body.parser.resumo.agendasFechadas).toBe(1)
  })

  it('4. retorna amostra com os dados parseados', async () => {
    const res = await GET(criarRequest())
    const body = await res.json()

    expect(Array.isArray(body.amostra)).toBe(true)
    expect(body.amostra).toHaveLength(3)
    expect(body.amostra[0]).toMatchObject({
      dataISO: '2026-06-23',
      equipe: 'EQUIPE 1',
      disponivelMin: 60,
      ativa: true,
    })
    expect(body.amostra[1]).toMatchObject({
      dataISO: '2026-06-13',
      equipe: 'EQUIPE 1',
      disponivelMin: 0,
      ativa: false,
      motivoIndisponibilidade: 'excedeu',
    })
  })

  it('5. não chama Apps Script (não usa fetch)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await GET(criarRequest())

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('6. retorna ok: false quando leitura falha', async () => {
    lerPlanilhaMock.mockResolvedValue({ ok: false, erro: 'Auth failed' })

    const res = await GET(criarRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.leitura.ok).toBe(false)
    expect(body.leitura.erro).toMatch(/Auth failed/)
  })

  it('7. retorna ok: false quando lerPlanilha retorna erro de OAuth', async () => {
    lerPlanilhaMock.mockResolvedValue({
      ok: false,
      erro: 'Variáveis de ambiente Google OAuth não configuradas',
    })

    const res = await GET(criarRequest())
    const body = await res.json()

    expect(body.ok).toBe(false)
    expect(body.leitura.ok).toBe(false)
    expect(body.leitura.erro).toMatch(/OAuth/)
  })

  it('8. respeita query param ?amostra=1', async () => {
    const res = await GET(criarRequest({ amostra: '1' }))
    const body = await res.json()

    expect(body.amostra).toHaveLength(1)
    expect(body.tamAmostra).toBe(1)
  })

  it('9. retorna avisos obrigatórios de rota diagnóstica', async () => {
    const res = await GET(criarRequest())
    const body = await res.json()

    expect(body.avisos).toContain('Rota diagnóstica. Não usada pelo frontend.')
    expect(body.avisos).toContain('Não altera produção.')
    expect(body.avisos).toContain('Não substitui Apps Script.')
    expect(body.avisos).toContain('Não altera agenda ou planilha.')
  })

  it('10. sempre usa o spreadsheetId real (constante), independente da config', async () => {
    const res = await GET(criarRequest())
    const body = await res.json()

    expect(body.origem.spreadsheetId).toBe('1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U')
    expect(body.origem.gid).toBe(65861376)
    expect(body.origem.tipo).toBe('google-sheets')
  })

  it('10b. expõe nomeLogicoConfig, abaNomeResolvido e range da leitura', async () => {
    const res = await GET(criarRequest())
    const body = await res.json()

    expect(body.origem.nomeLogicoConfig).toBe(PLANILHA_ID)
    expect(body.origem.abaNomeResolvido).toBe('TEMPO DISPONIVEL POR EQUIPE')
    expect(body.origem.range).toBe("'TEMPO DISPONIVEL POR EQUIPE'!A:F")
    expect(body.origem.origemId).toBe('fallback-diagnostico-confirmado')
    expect(body.leitura.range).toBe("'TEMPO DISPONIVEL POR EQUIPE'!A:F")
    expect(body.leitura.gid).toBe(65861376)
  })

  it('10c. quando config retorna nome lógico real, exibe-o como nomeLogicoConfig; aba resolvida pelo gid separada', async () => {
    buscarConfigMock.mockResolvedValue({
      ...CONFIG_OK,
      config: { ...CONFIG_OK.config, planilhaDeTempoDisponivel: 'TEMPO DISPONIVEL POR EQUIPE' },
    })

    const res = await GET(criarRequest())
    const body = await res.json()

    expect(body.origem.nomeLogicoConfig).toBe('TEMPO DISPONIVEL POR EQUIPE')
    expect(body.origem.abaNomeResolvido).toBe('TEMPO DISPONIVEL POR EQUIPE')
    expect(body.origem.spreadsheetId).toBe('1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U')
    expect(body.origem.origemId).toBe('fallback-diagnostico-confirmado')
  })

  it('11. quando config falha, origemId é fallback-diagnostico e spreadsheetId real ainda é usado', async () => {
    buscarConfigMock.mockResolvedValue({
      ok: false,
      erro: 'Supabase inacessível',
      origemErro: 'ambos' as const,
    })

    const res = await GET(criarRequest())
    const body = await res.json()

    expect(body.origem.origemId).toBe('fallback-diagnostico')
    expect(body.origem.spreadsheetId).toBe('1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U')
    expect(body.origem.nomeLogicoConfig).toBeNull()
    expect(body.avisos.some((a: string) => a.includes('constante diagnóstica'))).toBe(true)
  })

  it('12. tabela vazia retorna ok: true com resumo zerado', async () => {
    lerPlanilhaMock.mockResolvedValue({
      ok: true,
      tabela: [],
      planilhaId: PLANILHA_ID,
      gid: 65861376,
      abaNomeResolvido: 'TEMPO DISPONIVEL POR EQUIPE',
      range: "'TEMPO DISPONIVEL POR EQUIPE'!A:F",
    })

    const res = await GET(criarRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.leitura.linhasLidas).toBe(0)
    expect(body.parser.resumo.linhasRecebidas).toBe(0)
    expect(body.amostra).toHaveLength(0)
  })

  it('13. aceita ?dataInicialISO=YYYY-MM-DD e expõe parametros no response', async () => {
    const res = await GET(criarRequest({ dataInicialISO: '2026-12-15', limite: '50', amostra: '10' }))
    const body = await res.json()

    expect(body.parametros).toBeDefined()
    expect(body.parametros.dataInicialISO).toBe('2026-12-15')
    expect(body.parametros.origemDataInicialISO).toBe('query')
    expect(body.parametros.limite).toBe(50)
    expect(body.parametros.tamAmostra).toBe(10)
  })

  it('14. fallback diagnostico-hoje quando dataInicialISO não é informado', async () => {
    const res = await GET(criarRequest())
    const body = await res.json()

    expect(body.parametros).toBeDefined()
    expect(body.parametros.origemDataInicialISO).toBe('diagnostico-hoje')
    expect(body.parametros.dataInicialISO).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('15. parseia dados no formato real da planilha (DD/MM com texto) e retorna linhasValidas > 0', async () => {
    const tabelaReal: string[][] = [
      ['DATA', 'EQUIPE', 'TEMPO UTILIZADO', 'TEMPO DISPONÍVEL', 'TEMPO EXCEDIDO', 'STATUS'],
      ['15/06 (segunda-feira)', 'Equipe 1', '06:00', '01:00', '', 'disponível'],
      ['23/06 (terça-feira)', 'Equipe 1', '05:45', '00:00', '01:45', 'excedeu'],
      ['05/01 (segunda-feira)', 'Equipe 2', '07:00', '02:00', '', 'disponível'],
    ]

    lerPlanilhaMock.mockResolvedValue({
      ok: true,
      tabela: tabelaReal,
      planilhaId: PLANILHA_ID,
      gid: 65861376,
      abaNomeResolvido: 'TEMPO DISPONIVEL POR EQUIPE',
      range: "'TEMPO DISPONIVEL POR EQUIPE'!A:F",
    })

    const res = await GET(criarRequest({ dataInicialISO: '2026-06-15' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.parser.resumo.linhasValidas).toBe(3)
    expect(body.parser.resumo.linhasIgnoradas).toBe(0)
    expect(body.parser.erros).toHaveLength(0)
    expect(body.amostra).toHaveLength(3)

    expect(body.amostra[0].dataISO).toBe('2026-06-15')
    expect(body.amostra[1].dataISO).toBe('2026-06-23')
    expect(body.amostra[2].dataISO).toBe('2027-01-05')
  })
})
