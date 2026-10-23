import { createHash, randomUUID } from 'node:crypto'
import { Redis } from '@upstash/redis'
import { DfeError } from './dfe-contract'

// Uma reserva atômica por CNPJ/ambiente. TTL excede o maxDuration da rota.
export const RESERVAR_DFE = `
local block = redis.call('TTL', KEYS[1])
if block > 0 then return {'bloqueado', block} end
if redis.call('EXISTS', KEYS[2]) == 1 then return {'concorrente', 10} end
local cooldown = redis.call('TTL', KEYS[4])
if cooldown > 0 then return {'intervalo', cooldown} end
local now = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now - 3600000)
if redis.call('ZCARD', KEYS[3]) >= 20 then
  local oldest = redis.call('ZRANGE', KEYS[3], 0, 0, 'WITHSCORES')
  return {'limite', math.max(1, math.ceil((tonumber(oldest[2]) + 3600000 - now) / 1000))}
end
redis.call('SET', KEYS[2], ARGV[2], 'EX', 3600)
redis.call('ZADD', KEYS[3], now, ARGV[2])
redis.call('EXPIRE', KEYS[3], 3601)
redis.call('SET', KEYS[4], '1', 'EX', 60)
return {'ok', 0}
`
export const FINALIZAR_DFE = `
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
if tonumber(ARGV[2]) > 0 then redis.call('SET', KEYS[1], '1', 'EX', ARGV[2]) end
redis.call('SET', KEYS[3], '1', 'EX', ARGV[3])
redis.call('DEL', KEYS[2])
return 1
`

export type RedisDfe = Pick<Redis, 'eval'>
export function redisFiscal(): RedisDfe {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new DfeError('configuracao', 'Falta configurar o controle compartilhado de consultas fiscais. Solicite suporte.')
  // Não reutiliza o rate limit genérico, que permite chamadas quando indisponível.
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, retry: { retries: 0 } })
}

export async function reservarConsulta(cnpj: string, ambiente: string, chave: string, redis = redisFiscal(), now = Date.now()) {
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  const prefix = `{nfe-dfe:${hash(`${ambiente}:${cnpj}`)}}`
  const keys = [`${prefix}:bloqueio`, `${prefix}:execucao`, `${prefix}:hora`, `${prefix}:chave:${hash(chave)}`]
  const token = randomUUID()
  let status: string, segundos: number
  try { [status, segundos] = await redis.eval<[number, string], [string, number]>(RESERVAR_DFE, keys, [now, token]) }
  catch { throw new DfeError('temporario', 'O controle de consultas fiscais está indisponível. Nenhuma consulta foi enviada. Tente mais tarde.', 503, 60) }
  if (status !== 'ok') throw new DfeError('limite', status === 'concorrente' ? 'Já existe uma consulta fiscal em andamento para esta empresa. Aguarde a conclusão.' : `Aguarde ${Math.ceil(segundos / 60)} minuto(s) antes de consultar novamente.`, 429, segundos)
  return {
    async finalizar(bloqueio = 0, intervalo = 60) {
      try {
        const finished = await redis.eval<[string, number, number], number>(FINALIZAR_DFE, [keys[0], keys[1], keys[3]], [token, bloqueio, intervalo])
        if (finished !== 1) throw new Error('lock_expired')
      } catch {
        // Se o bloqueio da SEFAZ não puder ser registrado, a janela de 20 chamadas
        // segue consumida; erro não é escondido e não há nova tentativa fiscal.
        throw new DfeError('temporario', 'Não foi possível confirmar o intervalo de segurança da consulta. Aguarde uma hora antes de tentar novamente.', 503, 3600)
      }
    },
  }
}
