import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { consultarCidadeUfMaps, extrairCidadeUfPhoton, extrairCidadeUfNominatim } from './cidade-uf-maps'

const local = { lat: -25.6963932, lng: -49.5036726 }
const dados = { category: 'boundary', type: 'administrative', osm_type: 'relation', addresstype: 'town',
  lat: '-25.678', lon: '-49.531', address: { town: 'Contenda', state: 'Paraná', 'ISO3166-2-lvl4': 'BR-PR', country_code: 'br' },
  geojson: { type: 'Polygon', coordinates: [[[-49.6, -25.8], [-49.4, -25.8], [-49.4, -25.6], [-49.6, -25.6], [-49.6, -25.8]]] } }
const criarCache = () => ({ get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') })
beforeEach(() => { vi.stubEnv('PROCURAR_DATAS_REVERSE_ENABLED', 'true'); vi.stubEnv('PROCURAR_DATAS_NOMINATIM_BASE_URL', '') })
afterEach(() => { vi.unstubAllEnvs() })
it('extrai município administrativo que contém ponto, preservando coordenadas originais', () => {
  expect(extrairCidadeUfNominatim(dados, local)).toEqual({ cidade: 'Contenda', uf: 'PR', fonte: 'nominatim-openstreetmap' })
  expect(local).toEqual({ lat: -25.6963932, lng: -49.5036726 })
})
it.each([
  { ...dados, geojson: { type: 'Point', coordinates: [-49.503, -25.696] } },
  { ...dados, category: 'place' }, { ...dados, addresstype: 'state' },
  { ...dados, address: { ...dados.address, city: 'Curitiba' } },
  { ...dados, address: { ...dados.address, 'ISO3166-2-lvl4': 'BR-SC' } },
  { ...dados, address: { country_code: 'br', state: 'Paraná' } },
])('nome próximo, divergência ou região ampla não são aceitos como município: %j', (data) => {
  expect(extrairCidadeUfNominatim(data, local)).toBeNull()
})
it('não atribui município vizinho mesmo com nome e estado válidos', () => {
  expect(extrairCidadeUfNominatim(dados, { lat: -25.5, lng: -49.5 })).toBeNull()
})
it('mantém parser Photon para comparação experimental, sem inferir cidade pelo nome', () => {
  expect(extrairCidadeUfPhoton({ features: [{ properties: { countrycode: 'BR', city: 'Contenda', state: 'Paraná' } }] }))
    .toEqual({ cidade: 'Contenda', uf: 'PR', fonte: 'photon-openstreetmap' })
  expect(extrairCidadeUfPhoton({ features: [{ properties: { countrycode: 'BR', name: 'Curitiba' } }] })).toBeNull()
})
it('sem cache/limite compartilhado não consulta serviço público', async () => {
  const fetchImpl = vi.fn<typeof fetch>()
  expect(await consultarCidadeUfMaps(local, { cache: null, fetchImpl })).toBeNull()
  expect(fetchImpl).not.toHaveBeenCalled()
})
it('cache evita outra consulta, inclusive resposta negativa', async () => {
  for (const resultado of [extrairCidadeUfNominatim(dados, local), null]) {
    const fetchImpl = vi.fn<typeof fetch>()
    const cache = criarCache(); cache.get.mockResolvedValue({ resultado })
    expect(await consultarCidadeUfMaps(local, { cache, fetchImpl })).toEqual(resultado)
    expect(fetchImpl).not.toHaveBeenCalled()
  }
})
it('limite global impede excesso sem fila ou bloqueio do destino', async () => {
  const fetchImpl = vi.fn<typeof fetch>()
  const cache = criarCache(); cache.set.mockResolvedValue(null)
  expect(await consultarCidadeUfMaps(local, { cache, fetchImpl })).toBeNull()
  expect(fetchImpl).not.toHaveBeenCalled()
})
it('consulta endpoint fixo uma vez, sem redirect, com limite global, polígono e cache', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(dados)))
  const cache = criarCache()
  expect(await consultarCidadeUfMaps(local, { cache, fetchImpl })).toMatchObject({ cidade: 'Contenda', uf: 'PR' })
  const url = new URL(String(fetchImpl.mock.calls[0][0]))
  expect(url.origin).toBe('https://nominatim.openstreetmap.org')
  expect(url.searchParams.get('lat')).toBe(String(local.lat))
  expect(url.searchParams.get('zoom')).toBe('10')
  expect(url.searchParams.get('polygon_geojson')).toBe('1')
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: { 'User-Agent': expect.stringContaining('LeBebe') } })
  expect(cache.set.mock.calls[0][2]).toEqual({ ex: 2, nx: true })
  expect(cache.set.mock.calls.at(-1)?.[2]).toEqual({ ex: 86400 })
})
it('deduplica consultas simultâneas do mesmo ponto', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(dados)))
  const cache = criarCache()
  const resultados = await Promise.all([consultarCidadeUfMaps(local, { cache, fetchImpl }), consultarCidadeUfMaps(local, { cache, fetchImpl })])
  expect(resultados[0]).toEqual(resultados[1])
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})
it.each([new Error('network'), new DOMException('timeout', 'TimeoutError')])('falha externa mantém fallback por coordenadas', async (error) => {
  const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(error)
  expect(await consultarCidadeUfMaps(local, { cache: criarCache(), fetchImpl })).toBeNull()
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})
it('respeita resposta 429 sem retry e aplica Retry-After compartilhado', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '120' } }))
  const cache = criarCache()
  expect(await consultarCidadeUfMaps(local, { cache, fetchImpl })).toBeNull()
  expect(cache.set).toHaveBeenCalledWith('procurar-datas:maps:nominatim:limite', '1', { ex: 120 })
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})
it('respeita Retry-After em formato de data HTTP', async () => {
  const agora = Date.now()
  const date = vi.spyOn(Date, 'now').mockReturnValue(agora)
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429,
    headers: { 'Retry-After': new Date(agora + 120000).toUTCString() } }))
  const cache = criarCache()
  try {
    expect(await consultarCidadeUfMaps(local, { cache, fetchImpl })).toBeNull()
    const cooldown = cache.set.mock.calls.find((call) => call[0] === 'procurar-datas:maps:nominatim:limite' && !call[2].nx)
    expect(cooldown?.[2].ex).toBe(120)
  } finally { date.mockRestore() }
})
it('consulta já em execução em outro processo não gera outra requisição', async () => {
  const fetchImpl = vi.fn<typeof fetch>(), cache = criarCache()
  cache.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null)
  expect(await consultarCidadeUfMaps(local, { cache, fetchImpl })).toBeNull()
  expect(fetchImpl).not.toHaveBeenCalled()
})
it('instância pode ser trocada pelo servidor sem aceitar URL do cliente', async () => {
  vi.stubEnv('PROCURAR_DATAS_NOMINATIM_BASE_URL', 'https://nominatim.example.org')
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(dados)))
  await consultarCidadeUfMaps(local, { cache: criarCache(), fetchImpl })
  expect(new URL(String(fetchImpl.mock.calls[0][0])).origin).toBe('https://nominatim.example.org')
})
it('configuração insegura não realiza consulta externa', async () => {
  vi.stubEnv('PROCURAR_DATAS_NOMINATIM_BASE_URL', 'http://nominatim.example.org')
  const fetchImpl = vi.fn<typeof fetch>()
  expect(await consultarCidadeUfMaps(local, { cache: criarCache(), fetchImpl })).toBeNull()
  expect(fetchImpl).not.toHaveBeenCalled()
})
it('falha ao gravar cache não descarta município já validado', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(dados)))
  const cache = criarCache(); cache.set.mockResolvedValueOnce('OK').mockResolvedValueOnce('OK').mockRejectedValueOnce(new Error('cache'))
  expect(await consultarCidadeUfMaps(local, { cache, fetchImpl })).toMatchObject({ cidade: 'Contenda' })
})
it('sem ativação explícita nenhuma coordenada é compartilhada', async () => {
  vi.stubEnv('PROCURAR_DATAS_REVERSE_ENABLED', 'false')
  const fetchImpl = vi.fn<typeof fetch>(), cache = criarCache()
  expect(await consultarCidadeUfMaps(local, { fetchImpl, cache })).toBeNull()
  expect(fetchImpl).not.toHaveBeenCalled(); expect(cache.get).not.toHaveBeenCalled()
})
it('timeout total de dez segundos libera fallback sem novas tentativas', async () => {
  vi.useFakeTimers()
  // AbortSignal.timeout usa relógio nativo; injeta somente o sinal para testar o orçamento.
  const controller = new AbortController()
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
  const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError')), { once: true })
  }))
  try {
    const promise = consultarCidadeUfMaps(local, { cache: criarCache(), fetchImpl })
    await vi.advanceTimersByTimeAsync(0)
    expect(timeout).toHaveBeenCalledWith(10000)
    controller.abort()
    expect(await promise).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  } finally { timeout.mockRestore(); vi.useRealTimers() }
})
