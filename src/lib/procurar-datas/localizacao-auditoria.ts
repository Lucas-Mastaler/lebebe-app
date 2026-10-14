import { coordenadasMapsValidas, validarUrlGoogleMaps, type CoordenadasMaps } from './localizacao-maps'
export type LocalizacaoAuditoria = {
  versao: 1; metodo: 'endereco-tradicional' | 'google-maps-link' | 'coordenadas-diretas'
  linkOriginal?: string; origemCoordenadas?: string; nome?: string; cidade?: string; uf?: string
  lat: number; lng: number
}
const texto = (v: unknown, max = 160) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined
/** Metadado declarativo da entrada; coordenadas vêm sempre da entrada efetiva do motor. */
export function normalizarLocalizacaoAuditoria(raw: unknown, ponto: CoordenadasMaps | null): LocalizacaoAuditoria | null {
  if (!ponto || !coordenadasMapsValidas(ponto.lat, ponto.lng)) return null
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.metodo !== 'google-maps-link' && r.metodo !== 'coordenadas-diretas' && r.metodo !== 'endereco-tradicional') return null
  const metodo = r.metodo
  let linkOriginal: string | undefined
  if (metodo === 'google-maps-link' && typeof r.linkOriginal === 'string' && r.linkOriginal.length <= 8192) {
    try { validarUrlGoogleMaps(r.linkOriginal); linkOriginal = r.linkOriginal.trim() } catch { /* Link inválido não vira href na auditoria. */ }
  }
  return { versao: 1, metodo, ...ponto, ...(linkOriginal ? { linkOriginal } : {}),
    origemCoordenadas: texto(r.origemCoordenadas), nome: texto(r.nome), cidade: texto(r.cidade,120), uf: texto(r.uf,2) }
}
/** Histórico sem metadado explícito permanece não registrado. */
export function lerLocalizacaoAuditoria(raw: unknown): LocalizacaoAuditoria | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as LocalizacaoAuditoria
  if (r.versao !== 1 || !['endereco-tradicional','google-maps-link','coordenadas-diretas'].includes(r.metodo)) return null
  return normalizarLocalizacaoAuditoria(raw, { lat: r.lat, lng: r.lng })
}
