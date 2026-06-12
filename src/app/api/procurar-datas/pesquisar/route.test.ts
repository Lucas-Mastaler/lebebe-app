import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import { isTempoNecessarioValido, POST } from './route'

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

const chamarAppsScriptMock = vi.mocked(chamarAppsScriptProcurarDatas)
const validarAcessoMock = vi.mocked(validarAcessoProcurarDatas)

function criarRequest(payload: Record<string, unknown>) {
  return new Request('http://localhost/api/procurar-datas/pesquisar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest
}

const payloadBase = {
  clientToken: 'fixture-test-token',
  cep: '81020-220',
  enderecoCompleto: 'Endereco de teste',
  lat: -25.49,
  lng: -49.29,
  destLat: -25.49,
  destLng: -49.29,
  destDisplay: 'Endereco de teste',
  destProvider: 'teste',
  dataInicial: '2026-06-13',
  monthYear: '2026-06-13',
  isRural: false,
  isCondominio: false,
  isEncomenda: false,
  tipoBerco: '',
  comoda: '',
  roupeiro: '',
  poltrona: '',
  painel: '',
}

describe('isTempoNecessarioValido', () => {
  it('aceita HH:mm maior que zero', () => {
    expect(isTempoNecessarioValido('01:00')).toBe(true)
  })

  it('aceita HH:mm:ss quando horas ou minutos representam tempo maior que zero', () => {
    expect(isTempoNecessarioValido('01:00:00')).toBe(true)
  })

  it('recusa formatos ausentes, zerados ou fora do contrato HH:mm', () => {
    expect(isTempoNecessarioValido('')).toBe(false)
    expect(isTempoNecessarioValido('   ')).toBe(false)
    expect(isTempoNecessarioValido(null)).toBe(false)
    expect(isTempoNecessarioValido(undefined)).toBe(false)
    expect(isTempoNecessarioValido('00:00')).toBe(false)
    expect(isTempoNecessarioValido('00:00:00')).toBe(false)
    expect(isTempoNecessarioValido('abc')).toBe(false)
    expect(isTempoNecessarioValido('1 hora')).toBe(false)
  })
})

describe('POST /api/procurar-datas/pesquisar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validarAcessoMock.mockResolvedValue({ auth: { authorized: true }, response: null })
    chamarAppsScriptMock.mockResolvedValue({ ok: true, clientToken: 'fixture-test-token', status: 'started' })
  })

  it.each([
    ['string vazia', { tempoNecessario: '' }],
    ['espacos', { tempoNecessario: '   ' }],
    ['null', { tempoNecessario: null }],
    ['ausente', {}],
    ['zero HH:mm', { tempoNecessario: '00:00' }],
    ['zero HH:mm:ss', { tempoNecessario: '00:00:00' }],
    ['texto solto', { tempoNecessario: 'abc' }],
    ['texto descritivo', { tempoNecessario: '1 hora' }],
  ])('recusa tempoNecessario invalido: %s', async (_label, override) => {
    const response = await POST(criarRequest({ ...payloadBase, ...override }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      ok: false,
      error: 'Tempo necessario ausente ou invalido.',
    })
    expect(chamarAppsScriptMock).not.toHaveBeenCalled()
  })

  it('mantem tempoNecessario HH:mm valido e chama Apps Script', async () => {
    const response = await POST(criarRequest({ ...payloadBase, tempoNecessario: '01:00' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      clientToken: 'fixture-test-token',
      status: 'started',
    })
    expect(chamarAppsScriptMock).toHaveBeenCalledTimes(1)
    expect(chamarAppsScriptMock).toHaveBeenCalledWith('ApiIniciarPesquisaDatasApp', [{ ...payloadBase, tempoNecessario: '01:00' }], {
      rota: 'pesquisar',
      clientToken: 'fixture-test-token',
      timeoutMs: 30_000,
    })
  })
})
