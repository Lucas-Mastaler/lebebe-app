import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { consultarCidadeUfMaps, extrairCidadeUfPhoton, extrairCidadeUfNominatim, extrairEnderecoNominatim, complementarRuaNominatim } from './cidade-uf-maps'
import { ErroConsumoLocalizacao } from './consumo-localizacao'

const local = { lat: -25.6963932, lng: -49.5036726 }
const dados = { category: 'boundary', type: 'administrative', osm_type: 'relation', addresstype: 'town',
  lat: '-25.678', lon: '-49.531', address: { town: 'Contenda', state: 'Paraná', 'ISO3166-2-lvl4': 'BR-PR', country_code: 'br' },
  geojson: { type: 'Polygon', coordinates: [[[-49.6, -25.8], [-49.4, -25.8], [-49.4, -25.6], [-49.6, -25.6], [-49.6, -25.8]]] } }
const criarCache = () => ({ get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') })
// Campos/geometria da resposta real de 14/10/2026; ponto público já autorizado.
const fazenda = { lat: -25.665061, lng: -49.298785 }
const ruaFazenda = { category: 'highway', type: 'residential', addresstype: 'road', name: 'Travessa Indonésia',
  address: { road: 'Travessa Indonésia', suburb: 'Nações', city: 'Fazenda Rio Grande', state: 'Paraná',
    'ISO3166-2-lvl4': 'BR-PR', postcode: '83823-132', country_code: 'br' },
  geojson: { type: 'LineString', coordinates: [[-49.2989952,-25.6647524],[-49.2986053,-25.6653467],[-49.2984428,-25.6656092]] } }
const municipioFazenda = { cidade: 'Fazenda Rio Grande', uf: 'PR', fonte: 'nominatim-openstreetmap' as const }
it('aproveita rua, bairro e CEP reais quando ponto está sobre o traçado e município confirmado', () => {
  expect(complementarRuaNominatim(ruaFazenda, fazenda, municipioFazenda)).toEqual({ ...municipioFazenda,
    logradouro: 'Travessa Indonésia', bairro: 'Nações', cep: '83823132' })
  expect(complementarRuaNominatim({...ruaFazenda,address:{...ruaFazenda.address,house_number:'99'}},fazenda,municipioFazenda)).not.toHaveProperty('numero')
  expect(fazenda).toEqual({lat:-25.665061,lng:-49.298785})
})
it('rua próxima, município divergente, geometria inválida e ponto sem coordenadas não complementam', () => {
  expect(complementarRuaNominatim(ruaFazenda, {...fazenda,lat:fazenda.lat+0.001},municipioFazenda)).toEqual(municipioFazenda)
  expect(complementarRuaNominatim(ruaFazenda, fazenda, {...municipioFazenda,cidade:'Contenda'})).toEqual({...municipioFazenda,cidade:'Contenda'})
  for (const geojson of [{type:'Point',coordinates:[fazenda.lng,fazenda.lat]}, {type:'LineString',coordinates:[[NaN,0],[0,0]]}]) {
    expect(complementarRuaNominatim({...ruaFazenda,geojson},fazenda,municipioFazenda)).toEqual(municipioFazenda)
  }
  expect(complementarRuaNominatim(ruaFazenda,{lat:NaN,lng:0},municipioFazenda)).toEqual(municipioFazenda)
})
it('pedestrian e quarter têm significado de via e divisão urbana; locality/residential não viram rua/bairro', () => {
  const address = {city:'Fazenda Rio Grande',state:'Paraná',country_code:'br',pedestrian:'Calçadão',quarter:'Setor',locality:'Localidade rural',residential:'Residencial'}
  expect(complementarRuaNominatim({...ruaFazenda,address},fazenda,municipioFazenda)).toMatchObject({logradouro:'Calçadão',bairro:'Setor'})
  expect(complementarRuaNominatim({...ruaFazenda,address:{...address,pedestrian:undefined,quarter:undefined}},fazenda,municipioFazenda)).toEqual(municipioFazenda)
})
it('fluxo confirma município antes de aproveitar rua real e grava cache enriquecido', async () => {
  vi.useFakeTimers()
  try {
    const municipio = {...dados,address:{...dados.address,town:'Fazenda Rio Grande'},geojson:{type:'Polygon',coordinates:[[[-49.4,-25.8],[-49.2,-25.8],[-49.2,-25.6],[-49.4,-25.6],[-49.4,-25.8]]]}}
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(ruaFazenda)).mockResolvedValueOnce(Response.json(municipio))
    const cache=criarCache()
    const promessa=consultarCidadeUfMaps(fazenda,{cache,fetchImpl})
    await vi.advanceTimersByTimeAsync(2101)
    expect(await promessa).toMatchObject({cidade:'Fazenda Rio Grande',uf:'PR',logradouro:'Travessa Indonésia',bairro:'Nações',cep:'83823132'})
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(cache.set.mock.calls.at(-1)?.[1]).toMatchObject({resultado:{logradouro:'Travessa Indonésia'}})
  } finally {vi.useRealTimers()}
})
beforeEach(() => { vi.stubEnv('PROCURAR_DATAS_REVERSE_ENABLED', 'true'); vi.stubEnv('PROCURAR_DATAS_NOMINATIM_BASE_URL', '') })
afterEach(() => { vi.unstubAllEnvs() })
it('extrai município administrativo que contém ponto, preservando coordenadas originais', () => {
  expect(extrairCidadeUfNominatim(dados, local)).toEqual({ cidade: 'Contenda', uf: 'PR', fonte: 'nominatim-openstreetmap' })
  expect(local).toEqual({ lat: -25.6963932, lng: -49.5036726 })
})
it('preenche endereço do imóvel somente quando sua geometria contém o ponto',()=>{
  const predio={...dados,category:'building',type:'yes',addresstype:'building',name:'Local',
    address:{...dados.address,road:'Rua do local',suburb:'Centro',postcode:'83730-000',house_number:'10'}}
  expect(extrairEnderecoNominatim(predio,local)).toMatchObject({cidade:'Contenda',uf:'PR',logradouro:'Rua do local',bairro:'Centro',cep:'83730000',numero:'10',nome:'Local'})
  expect(extrairEnderecoNominatim(predio,{lat:-25,lng:-49})).toBeNull()
  expect(extrairEnderecoNominatim({...predio,geojson:{type:'Point',coordinates:[local.lng,local.lat]}},local)).toBeNull()
})
it('usa aliases confiáveis no imóvel e ignora subdivisão ampla/localidade rural',()=>{
  const predio={...dados,addresstype:'building',address:{...dados.address,suburb:' ',neighbourhood:'',quarter:'Centro',pedestrian:'Calçadão',locality:'Sítio',city_district:'Distrito'}}
  expect(extrairEnderecoNominatim(predio,local)).toMatchObject({bairro:'Centro',logradouro:'Calçadão'})
  const resultado=extrairEnderecoNominatim({...predio,address:{...predio.address,quarter:undefined,pedestrian:undefined}},local)
  expect(resultado?.bairro).toBeUndefined()
  expect(resultado?.logradouro).toBeUndefined()
})
it('Casa Nostra: tipo residential e CEP do objeto próximo não constituem endereço comprovado',()=>{
  const resposta={category:'highway',type:'residential',addresstype:'road',address:{town:'Contenda',state:'Paraná',country_code:'br',postcode:'83730-000'}}
  expect(extrairEnderecoNominatim(resposta,local)).toBeNull()
  const municipio=extrairCidadeUfNominatim(dados,local)!
  expect(complementarRuaNominatim(resposta,local,municipio)).toEqual(municipio)
})
it('limite administrativo não transforma rua/bairro vizinhos em endereço do imóvel',()=>{
  expect(extrairEnderecoNominatim({...dados,address:{...dados.address,road:'Rua vizinha',suburb:'Bairro vizinho',house_number:'10',postcode:'83730-000'}},local))
    .toEqual({cidade:'Contenda',uf:'PR',fonte:'nominatim-openstreetmap'})
})
it('quota esgotada informa aviso sem perder o ponto',async()=>{
  const fetchImpl=vi.fn<typeof fetch>().mockRejectedValue(new ErroConsumoLocalizacao('limite-mensal'))
  expect(await consultarCidadeUfMaps(local,{cache:criarCache(),fetchImpl})).toMatchObject({aviso:expect.stringContaining('Limite mensal')})
  expect(local).toEqual({lat:-25.6963932,lng:-49.5036726})
})
it('detalhe vizinho recorre ao município comprovado, no máximo duas chamadas',async()=>{
  vi.useFakeTimers()
  try {
    const fetchImpl=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({address:{town:'Vizinho'}})).mockResolvedValueOnce(Response.json(dados))
    const promessa=consultarCidadeUfMaps(local,{cache:criarCache(),fetchImpl})
    await vi.advanceTimersByTimeAsync(2101)
    expect(await promessa).toMatchObject({cidade:'Contenda',uf:'PR'})
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(new URL(String(fetchImpl.mock.calls[1][0])).searchParams.get('zoom')).toBe('10')
  } finally {vi.useRealTimers()}
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
  expect(url.searchParams.get('zoom')).toBe('18')
  expect(url.searchParams.get('polygon_geojson')).toBe('1')
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: { 'User-Agent': expect.stringContaining('LeBebe') } })
  expect(cache.set).toHaveBeenCalledWith('procurar-datas:maps:nominatim:limite', '1', { ex: 12, nx: true })
  expect(cache.set).toHaveBeenCalledWith('procurar-datas:maps:nominatim:limite', '1', { ex: 2 })
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
