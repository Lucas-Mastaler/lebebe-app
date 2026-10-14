import { ErroLocalizacaoMaps, extrairLocalizacaoMaps, validarUrlGoogleMaps, type LocalizacaoMaps } from './localizacao-maps'
import { ErroConsumoLocalizacao, fetchLocalizacao } from './consumo-localizacao'
import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'
const linksPendentes = new Map<string, Promise<LocalizacaoMaps>>()

/** Somente redirecionamentos HTTP. Não executa JS, raspa HTML nem consulta serviços pagos. */
export async function resolverLinkMaps(entrada: string, fetchImpl: typeof fetch = fetch): Promise<LocalizacaoMaps> {
  const direto = extrairLocalizacaoMaps(entrada)
  if (direto) return { ...direto, ...(direto.fonte !== 'coordenadas-diretas' ? { linkOriginal: entrada.trim() } : {}) }
  if (fetchImpl !== fetch) return resolverLinkCurto(entrada, fetchImpl)
  const key = `procurar-datas:maps:link:v1:${createHash('sha256').update(entrada.trim()).digest('hex')}`
  const pendente = linksPendentes.get(key)
  if (pendente) return pendente
  const promessa = resolverLinkCurtoComCache(entrada, key)
  linksPendentes.set(key, promessa)
  try { return await promessa } finally { linksPendentes.delete(key) }
}

async function resolverLinkCurtoComCache(entrada: string, key: string): Promise<LocalizacaoMaps> {
  const configCache = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN } : null
  if (configCache) {
    try { const cache = new Redis({ ...configCache, signal: AbortSignal.timeout(2000), retry: { retries: 0 } }); const cached = await cache.get<LocalizacaoMaps>(key); if (cached) return cached }
    catch { console.warn('[procurar-datas:maps-link]', { etapa: 'cache-leitura' }) }
  }
  const local = await resolverLinkCurto(entrada, fetch)
  if (configCache) {
    try { await new Redis({ ...configCache, signal: AbortSignal.timeout(2000), retry: { retries: 0 } }).set(key, local, { ex: 86400 }) }
    catch { console.warn('[procurar-datas:maps-link]', { etapa: 'cache-gravacao' }) }
  }
  return local
}
async function resolverLinkCurto(entrada: string, fetchImpl: typeof fetch): Promise<LocalizacaoMaps> {
  let url = validarUrlGoogleMaps(entrada.trim())
  if (url.hostname !== 'maps.app.goo.gl') {
    throw new ErroLocalizacaoMaps('coordenadas-nao-identificadas', 'Esse link não informa um ponto exato. Abra o lugar no Google Maps e copie as coordenadas, ou peça outro link ao cliente.', 422)
  }
  const signal = AbortSignal.timeout(8000)
  const visitadas = new Set<string>()
  for (let etapa = 0; etapa < 6; etapa++) {
    validarUrlGoogleMaps(url.href)
    if (visitadas.has(url.href)) throw new ErroLocalizacaoMaps('redirecionamento-circular', 'O link possui redirecionamentos repetidos.')
    visitadas.add(url.href)
    let response: Response
    try { response = await (fetchImpl === fetch ? (input: Parameters<typeof fetch>[0], init?: RequestInit) => fetchLocalizacao('google-maps-link', input, init) : fetchImpl)(url.href, { redirect: 'manual', signal, cache: 'no-store' }) }
    catch (error) {
      if (error instanceof ErroConsumoLocalizacao) throw new ErroLocalizacaoMaps(error.motivo, error.message, 429)
      throw new ErroLocalizacaoMaps('falha-resolucao', 'Não foi possível resolver o link. Tente novamente ou copie as coordenadas diretamente.', 502)
    }
    await response.body?.cancel()
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new ErroLocalizacaoMaps('falha-resolucao', 'O redirecionamento não informou o destino.', 502)
      const proxima = validarUrlGoogleMaps(new URL(location, url).href)
      const ponto = extrairLocalizacaoMaps(proxima.href)
      if (ponto) return { ...ponto, linkOriginal: entrada.trim() }
      url = proxima
      continue
    }
    if (!response.ok) throw new ErroLocalizacaoMaps('falha-resolucao', 'O Google Maps não conseguiu abrir esse link. Confira o link ou copie as coordenadas.', 502)
    throw new ErroLocalizacaoMaps('coordenadas-nao-identificadas', 'Não conseguimos identificar esse lugar pelo link curto. Abra-o no Google Maps e copie as coordenadas do local, ou peça ao cliente um link de um único lugar.', 422)
  }
  throw new ErroLocalizacaoMaps('redirecionamentos-excedidos', 'O link excedeu o limite técnico de redirecionamentos. Copie as coordenadas diretamente.')
}
