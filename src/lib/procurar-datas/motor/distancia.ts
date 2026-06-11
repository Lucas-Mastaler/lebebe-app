// ─────────────────────────────────────────────────────────────────────────────
// motor/distancia.ts  —  Cálculo de distância geodésica pura (sem I/O)
//
// Porta fiel das funções do Apps Script:
//   - haversine()       → haversine() (parâmetros separados)
//   - haversineKm()     → haversineKm() (objetos com lat/lng)
//
// NÃO FAZ:
//   - Leitura de planilha, Supabase, ou qualquer I/O
//   - Nenhuma alteração em APIs existentes ou frontend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reprodução fiel de `haversine(lat1,lon1,lat2,lon2)` do CEP-CONFIG.gs (linhas 1863-1867).
 *
 * Calcula distância geodésica entre dois pontos usando a fórmula de Haversine.
 * Retorna distância em km (raio da Terra = 6371 km).
 *
 * Não há arredondamento ou tratamento de valores inválidos.
 */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Tipo de coordenada geográfica.
 */
export interface Coordenada {
  lat: number
  lng: number
}

/**
 * Reprodução fiel de `haversineKm(a, b)` do CEP-CONFIG.gs (linhas 672-683).
 *
 * Mesma fórmula de haversine, mas recebe objetos com lat/lng.
 * Retorna distância em km.
 */
export function haversineKm(a: Coordenada, b: Coordenada): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}
