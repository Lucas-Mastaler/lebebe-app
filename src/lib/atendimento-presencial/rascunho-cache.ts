import { converterDataInputParaISO, converterViradaCartaoInput, validarFichaDadosRascunho, type FichaDadosRascunho, type EntradasFormularioRascunho } from './ficha-schema'
import { serializarPayloadAutosave } from './autosave-fila'

export type EntradasLocaisRascunho = EntradasFormularioRascunho

export type RascunhoCache = {
  draftClientId: string
  usuarioId: string
  atendimentoId: string | null
  version: number | null
  // undefined identifica caches legados, que nao guardavam o vinculo.
  clienteId?: string | null
  unidadeId?: string
  editorId?: string
  arquivado?: boolean
  entradasLocais?: EntradasLocaisRascunho
  basesRecuperacao?: string[]
  dadosRascunho: FichaDadosRascunho
  atualizadoEm: string
  sincronizado: boolean
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & Partial<Pick<Storage, 'length' | 'key'>>
const PREFIXO_CACHE = 'atendimento-presencial:rascunho'

export function temDadosIntermediariosRascunho(dados: FichaDadosRascunho) {
  return dados.criancas.some((crianca) => crianca.situacao === 'ja_nasceu' && !!crianca.idadeUnidade && crianca.idadeValor === undefined)
}

export function temEntradasLocaisPendentes(entradas: EntradasLocaisRascunho) {
  return Object.values(entradas.novoCliente).some(Boolean)
    || !!entradas.produtoDigitado || !!entradas.numeroLancamento || !!entradas.telefonePendente
    || Object.values(entradas.dataPrevistaInputs).some((valor) => !!valor && !converterDataInputParaISO(valor))
    || (!!entradas.viradaCartaoInput && !converterViradaCartaoInput(entradas.viradaCartaoInput))
}

export function criarChaveCacheRascunho(usuarioId: string, draftClientId: string, editorId?: string) {
  const base = `${PREFIXO_CACHE}:${usuarioId}:${draftClientId}`
  return editorId ? `${base}:${editorId}` : base
}

export function salvarCacheRascunho(storage: StorageLike, cache: RascunhoCache) {
  try {
    // Cada editor guarda sua propria copia: outra aba nunca apaga a pendencia desta.
    storage.setItem(criarChaveCacheRascunho(cache.usuarioId, cache.draftClientId, cache.editorId), JSON.stringify(cache))
    return true
  } catch {
    return false
  }
}

export function listarCachesRascunho(storage: StorageLike, usuarioId: string, draftClientId?: string): RascunhoCache[] {
  try {
    const prefixo = `${PREFIXO_CACHE}:${usuarioId}:`
    const chaves = storage.key
      ? Array.from({ length: storage.length ?? 0 }, (_, i) => storage.key!(i)).filter((key): key is string => !!key && key.startsWith(prefixo))
      : draftClientId ? [criarChaveCacheRascunho(usuarioId, draftClientId)] : []
    return chaves.flatMap((key) => {
      try {
        const parsed = JSON.parse(storage.getItem(key) ?? 'null') as RascunhoCache | null
        if (!parsed || parsed.usuarioId !== usuarioId || typeof parsed.draftClientId !== 'string') return []
        if (typeof parsed.atualizadoEm !== 'string' || typeof parsed.sincronizado !== 'boolean') return []
        if (parsed.basesRecuperacao !== undefined && (!Array.isArray(parsed.basesRecuperacao)
          || !parsed.basesRecuperacao.every((payload) => typeof payload === 'string'))) return []
        const entradas = parsed.entradasLocais
        if (entradas && (!entradas.novoCliente || !entradas.dataPrevistaInputs
          || !Object.values(entradas.novoCliente).every((valor) => typeof valor === 'string')
          || !Object.values(entradas.dataPrevistaInputs).every((valor) => typeof valor === 'string')
          || ![entradas.viradaCartaoInput, entradas.produtoDigitado, entradas.numeroLancamento].every((valor) => typeof valor === 'string')
          || (entradas.telefonePendente !== null && (typeof entradas.telefonePendente?.clienteId !== 'string' || typeof entradas.telefonePendente?.valor !== 'string')))) return []
        if (draftClientId && parsed.draftClientId !== draftClientId) return []
        if (key !== criarChaveCacheRascunho(usuarioId, parsed.draftClientId, parsed.editorId)) return []
        if (!validarFichaDadosRascunho(parsed.dadosRascunho).ok) return []
        if (parsed.clienteId !== undefined && parsed.clienteId !== null && typeof parsed.clienteId !== 'string') return []
        return [parsed]
      } catch {
        return []
      }
    }).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
  } catch {
    return []
  }
}

export function carregarCacheRascunho(storage: StorageLike, usuarioId: string, draftClientId: string, editorId?: string) {
  const caches = listarCachesRascunho(storage, usuarioId, draftClientId).filter((cache) => !cache.arquivado && (!editorId || cache.editorId === editorId))
  return caches.find((cache) => !cache.sincronizado) ?? caches[0] ?? null
}

export function removerCacheRascunho(storage: StorageLike, usuarioId: string, draftClientId: string, editorId?: string) {
  try {
    if (editorId) storage.removeItem(criarChaveCacheRascunho(usuarioId, draftClientId, editorId))
    else {
      for (const cache of listarCachesRascunho(storage, usuarioId, draftClientId)) {
        storage.removeItem(criarChaveCacheRascunho(usuarioId, draftClientId, cache.editorId))
      }
      storage.removeItem(criarChaveCacheRascunho(usuarioId, draftClientId))
    }
  } catch {
    return false
  }
  return true
}

export function planejarRecuperacaoRascunho(cache: RascunhoCache | null, servidor: { id: string; version: number; clienteId: string | null; dadosRascunho?: FichaDadosRascunho }) {
  if (!cache || cache.atendimentoId !== servidor.id) return { usarCache: false, conflito: false, clienteId: servidor.clienteId }
  const usarCache = !cache.sincronizado
  const validacao = validarFichaDadosRascunho(cache.dadosRascunho)
  const incluirEntradas = cache.entradasLocais
    && (temEntradasLocaisPendentes(cache.entradasLocais) || servidor.dadosRascunho?.entradasFormulario)
  const dadosCache = validacao.ok ? {
    ...validacao.dados,
    ...(incluirEntradas ? { entradasFormulario: cache.entradasLocais } : {}),
  } : cache.dadosRascunho
  const validacaoServidor = servidor.dadosRascunho ? validarFichaDadosRascunho(servidor.dadosRascunho) : null
  const dadosServidorCanonicos = validacaoServidor?.ok ? validacaoServidor.dados : servidor.dadosRascunho
  const payloadServidorCanonico = dadosServidorCanonicos
    ? serializarPayloadAutosave({ dadosRascunho: dadosServidorCanonicos, clienteId: servidor.clienteId })
    : null
  const payloadServidorOriginal = servidor.dadosRascunho
    ? serializarPayloadAutosave({ dadosRascunho: servidor.dadosRascunho, clienteId: servidor.clienteId })
    : null
  const igual = !!servidor.dadosRascunho && validacao.ok
    && serializarPayloadAutosave({ dadosRascunho: dadosCache, clienteId: cache.clienteId === undefined ? servidor.clienteId : cache.clienteId })
      === payloadServidorCanonico
  const servidorNaBasePropria = !!servidor.dadosRascunho && Array.isArray(cache.basesRecuperacao)
    && (cache.basesRecuperacao.includes(payloadServidorOriginal ?? '') || cache.basesRecuperacao.includes(payloadServidorCanonico ?? ''))
  return {
    usarCache,
    conflito: usarCache && cache.version !== servidor.version && !igual && !servidorNaBasePropria,
    clienteId: usarCache && cache.clienteId !== undefined ? cache.clienteId : servidor.clienteId,
  }
}
