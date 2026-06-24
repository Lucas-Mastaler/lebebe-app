/**
 * progresso-compat-store.ts
 *
 * Helper de estado Redis para o polling compatível simulado v2.
 *
 * Chave: procurar-datas:v2:progress:{clientToken}
 * TTL: 10 minutos (600 segundos) — acima do timeout UI legado de 7 minutos.
 *
 * IMPORTANTE: Este módulo é polling compatível SIMULADO, não parcial real.
 * O POST executa o orquestrador completo e salva status "done" antes de responder.
 * Não emite candidatos parciais durante a busca.
 * Publicação incremental de candidatos fica para fase futura.
 */

import { Redis } from '@upstash/redis'
import type { ProgressoPesquisa, ProgressoPesquisaStatus, CandidatoFinal } from '../contratos'

export const PROGRESSO_COMPAT_TTL_S = 600

const REDIS_KEY_PREFIX = 'procurar-datas:v2:progress:'

function buildKey(clientToken: string): string {
  return `${REDIS_KEY_PREFIX}${clientToken}`
}

function criarRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

export function criarProgressoInicial(clientToken: string): ProgressoPesquisa {
  return {
    status: 'queued',
    clientToken,
    normais: [],
    extras: [],
    timestamp: Date.now(),
    startedAt: new Date().toISOString(),
  }
}

export async function salvarProgressoCompat(
  clientToken: string,
  progresso: ProgressoPesquisa,
  redisImpl?: Redis | null
): Promise<void> {
  const redis = redisImpl !== undefined ? redisImpl : criarRedis()
  if (!redis) return
  const key = buildKey(clientToken)
  await redis.set(key, JSON.stringify(progresso), { ex: PROGRESSO_COMPAT_TTL_S })
}

export async function buscarProgressoCompat(
  clientToken: string,
  redisImpl?: Redis | null
): Promise<ProgressoPesquisa | null> {
  const redis = redisImpl !== undefined ? redisImpl : criarRedis()
  if (!redis) return null
  const key = buildKey(clientToken)
  const raw = await redis.get<string>(key)
  if (!raw) return null
  try {
    return JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) as ProgressoPesquisa
  } catch {
    return null
  }
}

export function separarNormaisExtras(candidates: CandidatoFinal[]): {
  normais: CandidatoFinal[]
  extras: CandidatoFinal[]
} {
  const normais: CandidatoFinal[] = []
  const extras: CandidatoFinal[] = []
  for (const c of candidates) {
    if (c.isExtra) {
      extras.push(c)
    } else {
      normais.push(c)
    }
  }
  return { normais, extras }
}

export function montarProgressoDone(
  clientToken: string,
  candidates: CandidatoFinal[],
  payload: ProgressoPesquisa['payload'],
  startedAt: string,
  inicioMs: number,
  diagnosticoPerformanceV2?: unknown,
  diagnosticoResultadoTelaV2SantoAmaro?: unknown,
  diagnosticoDeltaSantoAmaro16Jul?: unknown
): ProgressoPesquisa {
  const agora = Date.now()
  const { normais, extras } = separarNormaisExtras(candidates)
  const progresso: ProgressoPesquisa = {
    status: 'done',
    clientToken,
    normais,
    extras,
    payload,
    timestamp: agora,
    startedAt,
    finishedAt: new Date(agora).toISOString(),
    durationMs: agora - inicioMs,
  }
  if (diagnosticoPerformanceV2 !== undefined) {
    progresso.diagnosticoPerformanceV2 = diagnosticoPerformanceV2
  }
  if (diagnosticoResultadoTelaV2SantoAmaro !== undefined) {
    progresso.diagnosticoResultadoTelaV2SantoAmaro = diagnosticoResultadoTelaV2SantoAmaro
  }
  if (diagnosticoDeltaSantoAmaro16Jul !== undefined) {
    progresso.diagnosticoDeltaSantoAmaro16Jul = diagnosticoDeltaSantoAmaro16Jul
  }
  return progresso
}

export function montarProgressoError(
  clientToken: string,
  erro: string,
  startedAt: string,
  inicioMs: number
): ProgressoPesquisa {
  const agora = Date.now()
  return {
    status: 'error',
    clientToken,
    normais: [],
    extras: [],
    error: erro,
    timestamp: agora,
    startedAt,
    finishedAt: new Date(agora).toISOString(),
    durationMs: agora - inicioMs,
  }
}

export function progressoWaiting(): ProgressoPesquisa {
  return {
    status: 'waiting',
    normais: [],
    extras: [],
    timestamp: Date.now(),
  }
}

export type ProgressoCompatStatusValido = ProgressoPesquisaStatus
