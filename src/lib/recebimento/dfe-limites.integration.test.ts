import { randomUUID } from 'node:crypto'
import { Redis } from '@upstash/redis'
import { describe, expect, it } from 'vitest'
import { reservarConsulta, type RedisDfe } from './dfe-limites'

// Opt-in: somente chaves aleatórias com TTL, nunca usa o namespace operacional.
// Nenhuma comunicação com SEFAZ, Supabase ou Drive.
describe.skipIf(process.env.DFE_TEST_REDIS !== '1')('Lua em Redis real isolado', () => {
  it('bloqueia concorrência, repetições, 21ª consulta e CNPJ bloqueado', async () => {
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN!, retry: { retries: 0 } })
    const prefix = `teste-dfe:${randomUUID()}:`
    const usadas = new Set<string>()
    const isolado = { eval: (script: string, keys: string[], args: unknown[]) => {
      const testKeys = keys.map(key => `${prefix}${key}`)
      testKeys.forEach(key => usadas.add(key))
      return redis.eval(script, testKeys, args)
    } } as RedisDfe
    const now = Date.now()
    try {
      const first = await reservarConsulta('FICTICIO', '2', 'chave-0', isolado, now)
      await expect(reservarConsulta('FICTICIO', '2', 'chave-0', isolado, now)).rejects.toMatchObject({ estado: 'limite', retryAfter: 10 })
      await first.finalizar()
      await expect(reservarConsulta('FICTICIO', '2', 'chave-0', isolado, now)).rejects.toMatchObject({ estado: 'limite' })
      for (let i = 1; i < 20; i++) {
        const reserva = await reservarConsulta('FICTICIO', '2', `chave-${i}`, isolado, now)
        await reserva.finalizar()
      }
      await expect(reservarConsulta('FICTICIO', '2', 'chave-20', isolado, now)).rejects.toMatchObject({ estado: 'limite' })
      const blocked = await reservarConsulta('OUTRO-FICTICIO', '2', 'chave', isolado, now)
      await blocked.finalizar(3600)
      await expect(reservarConsulta('OUTRO-FICTICIO', '2', 'outra-chave', isolado, now)).rejects.toMatchObject({ estado: 'limite', retryAfter: expect.any(Number) })
    } finally {
      // Allowlist exata, sem scan/flush e sem alcançar chaves existentes.
      const keys = [...usadas]
      if (keys.some(key => !key.startsWith(prefix))) throw new Error('namespace')
      if (keys.length) await redis.del(...keys)
    }
  }, 60_000)
})
