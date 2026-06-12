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

  it('adapta isExtra conforme contrato legado observado/documentado', () => {
    const { amostra } = gerarDiagnosticoAdapterV2Comparar()
    const porTipo = Object.fromEntries(amostra.map((candidato) => [candidato.tipo, candidato]))

    expect(porTipo.normal?.isExtra).toBe(false)
    expect(porTipo.premium?.isExtra).toBe(true)
    expect(porTipo.especial?.isExtra).toBe(true)
    expect(porTipo['hora-marcada']?.isExtra).toBe(true)
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
})
