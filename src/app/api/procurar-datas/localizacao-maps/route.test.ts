import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'
import { consultarCidadeUfMaps } from '@/lib/procurar-datas/cidade-uf-maps'

const mocks = vi.hoisted(() => ({ acesso: vi.fn(), config: vi.fn(), rota: vi.fn(), criarRota: vi.fn() }))
vi.mock('@/lib/procurar-datas/api', () => ({ validarAcessoProcurarDatas: mocks.acesso }))
vi.mock('@/lib/procurar-datas/config-service', () => ({ buscarConfiguracoesProcurarDatas: mocks.config }))
vi.mock('@/lib/procurar-datas/cidade-uf-maps', () => ({ consultarCidadeUfMaps: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/procurar-datas/motor/osrm-route-client-diagnostico', () => ({ criarBuscarRotaOSRMRouteDiagnosticoV2: mocks.criarRota }))
const request = (body: string) => new NextRequest('http://localhost/api/procurar-datas/localizacao-maps', { method: 'POST', body })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.acesso.mockResolvedValue({})
  mocks.config.mockResolvedValue({ ok: true, config: { latDeposito: -25, lngDeposito: -49, osrmBaseUrl: 'https://osrm.example/' } })
  mocks.criarRota.mockReturnValue(mocks.rota)
  mocks.rota.mockResolvedValue({ ok: true, distanciaM: 12000, associacaoDestino: { lat: -25.69, lng: -49.50, distanciaAteViaM: 350 } })
  vi.mocked(consultarCidadeUfMaps).mockResolvedValue(null)
})
it('exige acesso antes de resolver ou consultar configuração', async () => {
  mocks.acesso.mockResolvedValue({ response: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) })
  expect((await POST(request('{}'))).status).toBe(403)
  expect(mocks.config).not.toHaveBeenCalled()
  expect(mocks.rota).not.toHaveBeenCalled()
})
it.each(['{', '{}', '{"entrada":42}', '{"entrada":"https://127.0.0.1/maps"}'])('rejeita entrada inválida sem acessar OSRM: %s', async (body) => {
  expect((await POST(request(body))).status).toBe(400)
  expect(mocks.config).not.toHaveBeenCalled()
})
it('preserva coordenadas escolhidas e usa origem e servidor configurados', async () => {
  const response = await POST(request(JSON.stringify({ entrada: '-25.6963932, -49.5036726' })))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  const data = await response.json()
  expect(data.resultado).toMatchObject({ lat: -25.6963932, lng: -49.5036726, acessoViario: { distanciaAteViaM: 350 } })
  expect(mocks.criarRota).toHaveBeenCalledWith({ baseUrl: 'https://osrm.example', timeoutMs: 5000 })
  expect(mocks.rota).toHaveBeenCalledWith({ lat: -25, lng: -49 }, expect.objectContaining({ lat: -25.6963932, lng: -49.5036726 }))
})
it('não confirma localização sem rota válida', async () => {
  mocks.rota.mockResolvedValue({ ok: false, distanciaM: null })
  expect((await POST(request('{"entrada":"-25.6,-49.5"}'))).status).toBe(422)
})
it('retorna indisponibilidade de configuração sem aproximar rota', async () => {
  mocks.config.mockResolvedValue({ ok: false })
  expect((await POST(request('{"entrada":"-25.6,-49.5"}'))).status).toBe(503)
  expect(mocks.rota).not.toHaveBeenCalled()
})
it('quota esgotada no reverso não bloqueia o link com coordenadas explícitas',async()=>{
  vi.mocked(consultarCidadeUfMaps).mockResolvedValue({fonte:'nominatim-openstreetmap',aviso:'Limite mensal de consultas de localização atingido.'})
  const entrada='https://www.google.com/maps/search/-25.665061,+-49.298785'
  const response=await POST(request(JSON.stringify({entrada})))
  expect(response.status).toBe(200)
  expect((await response.json()).resultado).toMatchObject({lat:-25.665061,lng:-49.298785,linkOriginal:entrada,regiao:{aviso:expect.stringContaining('Limite mensal')}})
})
