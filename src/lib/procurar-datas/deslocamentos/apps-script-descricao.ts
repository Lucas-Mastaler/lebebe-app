export interface ReferenciaBackend {
  linha?: number | null
  eventId?: string | null
  titulo?: string | null
}

export interface PontoRotaBackend {
  enderecoOriginal?: string | null
  display?: string | null
  lat?: number | null
  lng?: number | null
  referencias?: ReferenciaBackend[] | null
}

export interface OrigemBackend {
  enderecoOriginal?: string | null
  display?: string | null
  lat?: number | null
  lng?: number | null
}

export function formatarLinhaBackend(p: PontoRotaBackend): string {
  const refs = (p.referencias || [])
    .map((r) => {
      const partes: string[] = []
      if (r.linha) partes.push('linha ' + r.linha)
      if (r.eventId) partes.push('event ' + String(r.eventId).slice(0, 12))
      if (r.titulo) partes.push(String(r.titulo).slice(0, 60))
      return partes.join(' | ')
    })
    .filter(Boolean)

  return `${p.enderecoOriginal || p.display || '-'}` +
    `\n  refs: ${refs.join('; ') || '-'}`
}

export function buildMapsLinkBackendCoordenadas(
  origem: OrigemBackend,
  ordem: PontoRotaBackend[]
): string {
  const coords: string[] = []

  function coordenadaValida(lat: unknown, lng: unknown): boolean {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return false
    const latNum = Number(lat)
    const lngNum = Number(lng)
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return false
    if (latNum === 0 && lngNum === 0) return false
    return latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180
  }

  if (origem && coordenadaValida(origem.lat, origem.lng)) {
    coords.push(`${Number(origem.lat)},${Number(origem.lng)}`)
  }

  for (const p of ordem || []) {
    if (coordenadaValida(p.lat, p.lng)) {
      coords.push(`${Number(p.lat)},${Number(p.lng)}`)
    }
  }

  return 'https://www.google.com/maps/dir/' + coords.map(encodeURIComponent).join('/')
}

export function buildMapsLinkBackendEnderecos(
  origemOriginal: string | null | undefined,
  ordem: PontoRotaBackend[]
): string {
  const enderecos = [
    String(origemOriginal || '').trim(),
    ...(ordem || []).map((p) => String(p.enderecoOriginal || '').trim()),
  ].filter(Boolean)

  return 'https://www.google.com/maps/dir/' + enderecos.map(encodeURIComponent).join('/')
}
