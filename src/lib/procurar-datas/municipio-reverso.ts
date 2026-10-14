import { coordenadasMapsValidas, type CoordenadasMaps } from './localizacao-maps'

// GeoJSON usa longitude, latitude. Limite/incerteza ou geometria inválida não prova município.
function dentroDoAnel(ponto: CoordenadasMaps, valor: unknown): boolean | null {
  if (!Array.isArray(valor) || valor.length < 4) return null
  const anel = valor as unknown[]
  if (!anel.every((p) => Array.isArray(p) && coordenadasMapsValidas(p[1], p[0]))) return null
  const coords = anel as number[][]
  if (coords[0][0] !== coords.at(-1)![0] || coords[0][1] !== coords.at(-1)![1]) return null
  let dentro = false
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const [xi, yi] = coords[i], [xj, yj] = coords[j]
    if (xi === xj && yi === yj) continue
    const cruzado = (ponto.lng - xi) * (yj - yi) - (ponto.lat - yi) * (xj - xi)
    if (cruzado === 0 && ponto.lng >= Math.min(xi, xj) && ponto.lng <= Math.max(xi, xj) &&
      ponto.lat >= Math.min(yi, yj) && ponto.lat <= Math.max(yi, yj)) return null
    if ((yi > ponto.lat) !== (yj > ponto.lat) && ponto.lng < (xj - xi) * (ponto.lat - yi) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

function dentroDoPoligono(ponto: CoordenadasMaps, valor: unknown): boolean {
  return Array.isArray(valor) && valor.length > 0 && dentroDoAnel(ponto, valor[0]) === true &&
    valor.slice(1).every((anel) => dentroDoAnel(ponto, anel) === false)
}

/** Verificação somente do metadado municipal; nunca altera coordenadas, rota ou preço. */
export function municipioContemPonto(ponto: CoordenadasMaps, geometria: unknown): boolean {
  if (!coordenadasMapsValidas(ponto.lat, ponto.lng) || !geometria || typeof geometria !== 'object') return false
  const geo = geometria as { type?: unknown; coordinates?: unknown }
  if (geo.type === 'Polygon') return dentroDoPoligono(ponto, geo.coordinates)
  if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates)) return geo.coordinates.some((p) => dentroDoPoligono(ponto, p))
  return false
}
