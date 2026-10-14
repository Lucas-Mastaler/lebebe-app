import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'
import { coordenadasMapsValidas, type CoordenadasMaps } from './localizacao-maps'
import { municipioContemPonto } from './municipio-reverso'

export type CidadeUfMaps = { cidade?: string; uf?: string; fonte: 'photon-openstreetmap' | 'nominatim-openstreetmap' }
type CacheReverso = {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown, options: { ex: number; nx?: boolean }) => Promise<unknown>
}
const ESTADOS: Record<string, string> = {
  Acre: 'AC', Alagoas: 'AL', Amapá: 'AP', Amazonas: 'AM', Bahia: 'BA', Ceará: 'CE',
  'Distrito Federal': 'DF', 'Espírito Santo': 'ES', Goiás: 'GO', Maranhão: 'MA',
  'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG', Pará: 'PA',
  Paraíba: 'PB', Paraná: 'PR', Pernambuco: 'PE', Piauí: 'PI', 'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS', Rondônia: 'RO', Roraima: 'RR',
  'Santa Catarina': 'SC', 'São Paulo': 'SP', Sergipe: 'SE', Tocantins: 'TO',
}

/** Usado na comparação experimental; Photon não é chamado pelo fluxo ativo. */
export function extrairCidadeUfPhoton(data: unknown): CidadeUfMaps | null {
  const features = (data as { features?: Array<{ properties?: Record<string, unknown> }> } | null)?.features
  const props = Array.isArray(features) ? features[0]?.properties : undefined
  if (!props || props.countrycode !== 'BR' && props.countrycode !== 'br') return null
  const cidade = typeof props.city === 'string' ? props.city.trim().slice(0, 120) : undefined
  const uf = typeof props.state === 'string' ? ESTADOS[props.state] : undefined
  return cidade || uf ? { ...(cidade ? { cidade } : {}), ...(uf ? { uf } : {}), fonte: 'photon-openstreetmap' } : null
}

export function extrairCidadeUfNominatim(data: unknown, ponto: CoordenadasMaps): CidadeUfMaps | null {
  if (!data || typeof data !== 'object') return null
  const r = data as Record<string, unknown>
  if (r.category !== 'boundary' || r.type !== 'administrative' || r.osm_type !== 'relation' ||
    !['city', 'town', 'municipality'].includes(String(r.addresstype)) || !municipioContemPonto(ponto, r.geojson)) return null
  const address = r.address as Record<string, unknown> | undefined
  if (!address || address.country_code !== 'br') return null
  const cidades = [...new Set([address.city, address.town, address.municipality]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim()))]
  if (cidades.length !== 1) return null
  const ufNome = typeof address.state === 'string' ? ESTADOS[address.state] : undefined
  const codigo = typeof address['ISO3166-2-lvl4'] === 'string' ? address['ISO3166-2-lvl4'].replace(/^BR-/, '') : undefined
  const ufCodigo = codigo && Object.values(ESTADOS).includes(codigo) ? codigo : undefined
  if (ufNome && ufCodigo && ufNome !== ufCodigo) return null
  const uf = ufCodigo || ufNome
  return uf ? { cidade: cidades[0].slice(0, 120), uf, fonte: 'nominatim-openstreetmap' } : null
}

type DepsReverso = { fetchImpl?: typeof fetch; cache?: CacheReverso | null }
const pendentes = new Map<string, Promise<CidadeUfMaps | null>>()

/** Consulta complementar com cache/deduplicação. Falha sempre preserva o destino original. */
export async function consultarCidadeUfMaps(local: CoordenadasMaps, deps: DepsReverso = {}): Promise<CidadeUfMaps | null> {
  if (process.env.PROCURAR_DATAS_REVERSE_ENABLED !== 'true' || !coordenadasMapsValidas(local.lat, local.lng)) return null
  const hash = createHash('sha256').update(`${local.lat},${local.lng}`).digest('hex')
  const pendente = pendentes.get(hash)
  if (pendente) return pendente
  const promessa = consultarMunicipio(local, hash, deps)
  pendentes.set(hash, promessa)
  try { return await promessa } finally { pendentes.delete(hash) }
}

async function consultarMunicipio(local: CoordenadasMaps, hash: string, deps: DepsReverso): Promise<CidadeUfMaps | null> {
  const signal = AbortSignal.timeout(10000)
  const inicio = Date.now()
  let etapa = 'cache-configuracao'
  let obtido: CidadeUfMaps | null = null
  try {
    const cache = deps.cache !== undefined ? deps.cache :
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, signal, retry: { retries: 0 } }) : null
    // O limite é compartilhado entre instâncias; sem ele, mantém apenas coordenadas.
    if (!cache) return null
    const key = `procurar-datas:maps:municipio:v2:${hash}`
    etapa = 'cache-leitura'
    const cached = await cache.get(key)
    if (cached && typeof cached === 'object' && 'resultado' in cached) {
      console.info('[procurar-datas:maps-reverso]', { status: 'cache-hit', provider: 'nominatim', duracaoMs: Date.now() - inicio })
      return (cached as { resultado: CidadeUfMaps | null }).resultado
    }
    etapa = 'limite-global'
    if (!await cache.set('procurar-datas:maps:nominatim:limite', '1', { ex: 2, nx: true })) return null
    // Evita consultas do mesmo ponto simultâneas em processos distintos, sem esperar em fila.
    if (!await cache.set(`${key}:pendente`, '1', { ex: 12, nx: true })) return null
    // Configuração somente do servidor permite trocar a instância sem atualizar o código.
    // Nenhuma URL/provedor é recebido do formulário ou do request.
    const base = new URL(process.env.PROCURAR_DATAS_NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org')
    if (base.protocol !== 'https:' || base.username || base.password || base.port || base.search || base.hash) return null
    const url = new URL('/reverse', base)
    for (const [chave, valor] of Object.entries({ lat: String(local.lat), lon: String(local.lng),
      format: 'jsonv2', addressdetails: '1', zoom: '10', layer: 'address', polygon_geojson: '1', 'accept-language': 'pt-BR' })) url.searchParams.set(chave, valor)
    etapa = 'consulta-reversa'
    const response = await (deps.fetchImpl ?? fetch)(url, { signal, redirect: 'error',
      headers: { 'User-Agent': 'LeBebe-Localizacao/1.0 (+https://lebebe.cloud)', Accept: 'application/json' } })
    if (!response.ok) {
      if (response.status === 429) {
        const raw = response.headers.get('retry-after') || ''
        const espera = /^\d+$/.test(raw) ? Number(raw) : Math.ceil((Date.parse(raw) - Date.now()) / 1000)
        await cache.set('procurar-datas:maps:nominatim:limite', '1', { ex: Number.isFinite(espera) && espera > 0 ? Math.ceil(espera) : 60 })
      }
      console.warn('[procurar-datas:maps-reverso]', { status: 'http', http: response.status, provider: 'nominatim', duracaoMs: Date.now() - inicio })
      await response.body?.cancel()
      await cache.set(key, { resultado: null }, { ex: 30 })
      return null
    }
    etapa = 'validacao-municipio'
    obtido = extrairCidadeUfNominatim(await response.json(), local)
    etapa = 'cache-gravacao'
    await cache.set(key, { resultado: obtido }, { ex: obtido ? 86400 : 600 })
    console.info('[procurar-datas:maps-reverso]', { status: obtido ? 'identificado' : 'sem-municipio-confiavel', provider: 'nominatim', duracaoMs: Date.now() - inicio })
    return obtido
  } catch (error) {
    console.warn('[procurar-datas:maps-reverso]', { status: signal.aborted || error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'indisponivel', etapa, provider: 'nominatim', duracaoMs: Date.now() - inicio })
    return obtido
  }
}
