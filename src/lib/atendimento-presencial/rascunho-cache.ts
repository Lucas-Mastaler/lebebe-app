import type { DadosRascunho } from './rascunhos'

export type RascunhoCache = {
  draftClientId: string
  usuarioId: string
  atendimentoId: string | null
  version: number | null
  dadosRascunho: DadosRascunho
  atualizadoEm: string
  sincronizado: boolean
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const PREFIXO_CACHE = 'atendimento-presencial:rascunho'

export function criarChaveCacheRascunho(usuarioId: string, draftClientId: string) {
  return `${PREFIXO_CACHE}:${usuarioId}:${draftClientId}`
}

export function salvarCacheRascunho(storage: StorageLike, cache: RascunhoCache) {
  storage.setItem(
    criarChaveCacheRascunho(cache.usuarioId, cache.draftClientId),
    JSON.stringify(cache)
  )
}

export function carregarCacheRascunho(
  storage: StorageLike,
  usuarioId: string,
  draftClientId: string
): RascunhoCache | null {
  const raw = storage.getItem(criarChaveCacheRascunho(usuarioId, draftClientId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<RascunhoCache>
    if (parsed.usuarioId !== usuarioId || parsed.draftClientId !== draftClientId) return null
    return {
      draftClientId,
      usuarioId,
      atendimentoId: typeof parsed.atendimentoId === 'string' ? parsed.atendimentoId : null,
      version: typeof parsed.version === 'number' ? parsed.version : null,
      dadosRascunho: typeof parsed.dadosRascunho === 'object' && parsed.dadosRascunho !== null
        ? parsed.dadosRascunho
        : {},
      atualizadoEm: typeof parsed.atualizadoEm === 'string' ? parsed.atualizadoEm : '',
      sincronizado: parsed.sincronizado === true,
    }
  } catch {
    return null
  }
}

export function removerCacheRascunho(storage: StorageLike, usuarioId: string, draftClientId: string) {
  storage.removeItem(criarChaveCacheRascunho(usuarioId, draftClientId))
}
