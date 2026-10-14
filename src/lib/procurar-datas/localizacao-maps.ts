export type CoordenadasMaps = { lat: number; lng: number }
/** Tolerância exclusivamente visual aprovada; não participa do cálculo de frete. */
export function deveAvisarAssociacaoViaMaps(distanciaM: number): boolean { return distanciaM > 1000 }
export type LocalizacaoMaps = CoordenadasMaps & {
  fonte: 'coordenadas-diretas' | 'google-maps-ponto' | 'google-maps-pesquisa-coordenadas'
  conferirUrl: string
  nome?: string
}
export class ErroLocalizacaoMaps extends Error {
  constructor(public codigo: string, message: string, public status = 400) { super(message) }
}

export function coordenadasMapsValidas(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
}

export function linkConferenciaMaps({ lat, lng }: CoordenadasMaps): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

const PAR = /^\s*\(?\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\)?\s*$/
function parCoordenadas(value: string): CoordenadasMaps | null {
  const match = value.match(PAR)
  if (!match) return null
  const lat = Number(match[1]), lng = Number(match[2])
  if (!coordenadasMapsValidas(lat, lng)) throw new ErroLocalizacaoMaps('coordenadas-invalidas', 'Latitude deve estar entre -90 e 90; longitude entre -180 e 180.')
  return { lat, lng }
}

/** Lista exata, sem subdomínios livres, URLs de saída, portas alternativas ou credenciais. */
export function validarUrlGoogleMaps(value: string): URL {
  let url: URL
  try { url = new URL(value) } catch { throw new ErroLocalizacaoMaps('link-invalido', 'Informe um link HTTPS do Google Maps ou latitude, longitude.') }
  const hosts = ['google.com', 'www.google.com', 'maps.google.com', 'google.com.br', 'www.google.com.br', 'maps.google.com.br', 'maps.app.goo.gl']
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) {
    throw new ErroLocalizacaoMaps('dominio-nao-permitido', 'Apenas links HTTPS dos domínios Google Maps permitidos são aceitos.')
  }
  const short = url.hostname === 'maps.app.goo.gl'
  const mapsHost = url.hostname === 'maps.google.com' || url.hostname === 'maps.google.com.br'
  if (short ? !/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) : !/^\/maps(?:\/|$)/.test(url.pathname) && !(mapsHost && url.pathname === '/')) {
    throw new ErroLocalizacaoMaps('caminho-nao-permitido', 'Esse endereço não é um link de localização do Google Maps.')
  }
  return url
}

/** Nunca usa @lat,lng, ll, center ou coordenadas de imagens estáticas como ponto escolhido. */
export function extrairLocalizacaoMaps(entrada: string): LocalizacaoMaps | null {
  const value = entrada.trim()
  if (!value || value.length > 8192) throw new ErroLocalizacaoMaps('entrada-invalida', 'Informe um link ou coordenadas válidas (até 8.192 caracteres).')
  const diretas = parCoordenadas(value)
  if (diretas) return { ...diretas, fonte: 'coordenadas-diretas', conferirUrl: linkConferenciaMaps(diretas) }
  const url = validarUrlGoogleMaps(value)
  let caminho: string
  try { caminho = decodeURIComponent(url.pathname) } catch { throw new ErroLocalizacaoMaps('link-invalido', 'O link contém codificação inválida.') }
  // A semântica de rota tem precedência sobre pins/pares duplicados nos metadados.
  if (/^\/maps\/(?:preview\/)?dir(?:\/|$)/.test(caminho) || url.searchParams.get('api') === '1' &&
    (url.searchParams.has('origin') || url.searchParams.has('waypoints')) ||
    ['saddr', 'daddr'].some((key) => url.searchParams.has(key))) {
    throw new ErroLocalizacaoMaps('link-de-rota', 'Este link contém uma rota com mais de um local. Envie o link de um único lugar no Google Maps.')
  }
  const nomeNoLink = caminho.match(/^\/maps\/place\/([^/]+)/)?.[1]?.replace(/\+/g, ' ').trim()
  const nome = nomeNoLink && !parCoordenadas(nomeNoLink) ? nomeNoLink.slice(0, 160) : undefined
  // Pins de um local: !3d latitude !4d longitude. Rotas com múltiplos locais não são um pin único.
  if (!caminho.startsWith('/maps/dir')) {
    const pins = Array.from(caminho.matchAll(/!3d([+-]?\d+(?:\.\d+)?)!4d([+-]?\d+(?:\.\d+)?)(?=!|\/|$)/g))
    const unicos = [...new Set(pins.map((pin) => {
      const ponto = parCoordenadas(`${pin[1]},${pin[2]}`)!
      return `${ponto.lat},${ponto.lng}`
    }))]
    if (unicos.length > 1) throw new ErroLocalizacaoMaps('local-ambiguo', 'O link contém mais de um ponto. Copie as coordenadas do destino desejado.')
    if (unicos.length === 1) {
      const ponto = parCoordenadas(unicos[0])!
      return { ...ponto, fonte: 'google-maps-ponto', conferirUrl: linkConferenciaMaps(ponto), ...(nome ? { nome } : {}) }
    }
  }
  // Place ID, quando fornecido, tem precedência sobre query; CID/ftid não são Place IDs.
  if (url.searchParams.has('query_place_id') || url.searchParams.has('destination_place_id')) return null
  const consulta = url.pathname.startsWith('/maps/dir') ? url.searchParams.get('destination') : url.searchParams.get('query') ?? url.searchParams.get('q')
  const ponto = consulta ? parCoordenadas(consulta.replace(/^loc:/i, '')) : null
  return ponto ? { ...ponto, fonte: 'google-maps-pesquisa-coordenadas', conferirUrl: linkConferenciaMaps(ponto) } : null
}
