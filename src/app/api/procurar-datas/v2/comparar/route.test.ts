import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import { gerarDiagnosticoAdapterV2Comparar, GET } from './route'

vi.mock('@/lib/procurar-datas/apps-script', () => ({
  chamarAppsScriptProcurarDatas: vi.fn(),
}))

vi.mock('@/lib/procurar-datas/api', () => ({
  validarAcessoProcurarDatas: vi.fn(),
  respostaErroProcurarDatas: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
    return Response.json({ ok: false, error: message }, { status: 500 })
  }),
}))

const validarAcessoMock = vi.mocked(validarAcessoProcurarDatas)
const chamarAppsScriptMock = vi.mocked(chamarAppsScriptProcurarDatas)

const REGEX_LEGADO_GMT3 = /^\d{4}-\d{2}-\d{2}T03:00:00\.000Z$/

describe('gerarDiagnosticoAdapterV2Comparar', () => {
  it('gera bloco sintetico deterministico com quatro tipos adaptados', () => {
    const diagnostico = gerarDiagnosticoAdapterV2Comparar()

    expect(diagnostico.executado).toBe(true)
    expect(diagnostico.modo).toBe('sintetico')
    expect(diagnostico.dataReferenciaISO).toBe('2026-06-12')
    expect(diagnostico.quantidadeCandidatosAdaptados).toBe(4)
    expect(diagnostico.amostra).toHaveLength(4)
    expect(diagnostico.tiposDemonstrados).toEqual([
      'normal',
      'premium',
      'especial',
      'hora-marcada',
    ])
    expect(diagnostico.amostra.map((c) => c.rank)).toEqual([1, 2, 3, 4])
  })

  it('retorna formatoDateISO legado-gmt3 no bloco diagnosticoAdapterV2', () => {
    const diagnostico = gerarDiagnosticoAdapterV2Comparar()

    expect(diagnostico.formatoDateISO).toBe('legado-gmt3')
  })

  it('amostra adaptada retorna dateISO no formato YYYY-MM-DDT03:00:00.000Z', () => {
    const { amostra } = gerarDiagnosticoAdapterV2Comparar()

    for (const candidato of amostra) {
      expect(candidato.dateISO).toMatch(REGEX_LEGADO_GMT3)
    }
  })

  it('amostra adaptada retorna dateDM correto independente do formato dateISO', () => {
    const { amostra } = gerarDiagnosticoAdapterV2Comparar()
    const porTipo = Object.fromEntries(amostra.map((c) => [c.tipo, c]))

    expect(porTipo.normal?.dateDM).toBe('23/06')
    expect(porTipo.premium?.dateDM).toBe('30/06')
    expect(porTipo.especial?.dateDM).toBe('24/07')
    expect(porTipo['hora-marcada']?.dateDM).toBe('25/07')
  })

  it('amostra adaptada retorna weekday correto', () => {
    const { amostra } = gerarDiagnosticoAdapterV2Comparar()
    const porTipo = Object.fromEntries(amostra.map((c) => [c.tipo, c]))

    expect(porTipo.normal?.weekday).toBe('Terça')
    expect(porTipo.premium?.weekday).toBe('Terça')
    expect(porTipo.especial?.weekday).toBe('Sexta')
    expect(porTipo['hora-marcada']?.weekday).toBe('Sábado')
  })

  it('adapta isExtra conforme contrato legado observado/documentado', () => {
    const { amostra } = gerarDiagnosticoAdapterV2Comparar()
    const porTipo = Object.fromEntries(amostra.map((candidato) => [candidato.tipo, candidato]))

    expect(porTipo.normal?.isExtra).toBe(false)
    expect(porTipo.premium?.isExtra).toBe(true)
    expect(porTipo.especial?.isExtra).toBe(true)
    expect(porTipo['hora-marcada']?.isExtra).toBe(true)
  })

  it('retorna rank, tipo, frete e team corretos para cada candidato', () => {
    const { amostra } = gerarDiagnosticoAdapterV2Comparar()
    const porTipo = Object.fromEntries(amostra.map((c) => [c.tipo, c]))

    expect(porTipo.normal?.rank).toBe(1)
    expect(porTipo.normal?.frete).toBe('R$ 110')
    expect(porTipo.normal?.team).toBe('EQUIPE 1')

    expect(porTipo.premium?.rank).toBe(2)
    expect(porTipo.premium?.frete).toBe('R$ 320')
    expect(porTipo.premium?.team).toBe('EQUIPE 1')

    expect(porTipo.especial?.rank).toBe(3)
    expect(porTipo.especial?.frete).toBe('R$ 220')
    expect(porTipo.especial?.team).toBe('EQUIPE 1')

    expect(porTipo['hora-marcada']?.rank).toBe(4)
    expect(porTipo['hora-marcada']?.frete).toBe('R$ 200')
    expect(porTipo['hora-marcada']?.team).toBe('EQUIPE 2')
  })

  it('mantem aviso diagnostico de pendencia para hora marcada', () => {
    const { amostra } = gerarDiagnosticoAdapterV2Comparar()
    const horaMarcada = amostra.find((candidato) => candidato.tipo === 'hora-marcada')

    expect(horaMarcada?.avisoHoraMarcada).not.toBe('')
    expect(
      horaMarcada?.diagnosticoV2.avisos.some(
        (aviso) => aviso.includes('hora-marcada') && aviso.includes('pendente')
      )
    ).toBe(true)
  })
})

describe('GET /api/procurar-datas/v2/comparar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validarAcessoMock.mockResolvedValue({ auth: { authorized: true }, response: null })
  })

  it('preserva comparacao estrutural das duas fixtures e adiciona diagnosticoAdapterV2', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.modo).toBe('fixtures')
    expect(body.errosCarregamento).toEqual([])
    expect(body.comparacoes).toHaveLength(2)
    expect(body.comparacoes.every((comparacao: { ok: boolean }) => comparacao.ok)).toBe(true)
    expect(body.diagnosticoAdapterV2).toMatchObject({
      executado: true,
      modo: 'sintetico',
      formatoDateISO: 'legado-gmt3',
      quantidadeCandidatosAdaptados: 4,
    })
    expect(body.diagnosticoAdapterV2.tiposDemonstrados).toEqual([
      'normal',
      'premium',
      'especial',
      'hora-marcada',
    ])
    expect(body.avisos.some((aviso: string) => aviso.includes('fixtures'))).toBe(true)
    expect(body.avisos.some((aviso: string) => aviso.includes('sinteticos'))).toBe(true)
    expect(body.avisos.some((aviso: string) => aviso.includes('Nao ha comparacao operacional final'))).toBe(true)
    expect(chamarAppsScriptMock).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('diagnosticoAdapterV2 retorna dateISO da amostra no formato YYYY-MM-DDT03:00:00.000Z', async () => {
    const response = await GET()
    const body = await response.json()

    const amostra: Array<{ dateISO: string }> = body.diagnosticoAdapterV2?.amostra ?? []
    expect(amostra.length).toBeGreaterThan(0)
    for (const candidato of amostra) {
      expect(candidato.dateISO).toMatch(REGEX_LEGADO_GMT3)
    }
  })

  it('comparacao estrutural retorna 2 comparacoes sem chamar Apps Script ou planilha', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET()
    const body = await response.json()

    expect(body.comparacoes).toHaveLength(2)
    expect(chamarAppsScriptMock).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('producaoAfetada e false e nao altera producao', async () => {
    const response = await GET()
    const body = await response.json()

    expect(body.producaoAfetada).toBe(false)
  })
})
