import 'server-only'
import { AltervisionError, object, type FlowSource } from './contracts'

const API = 'https://api.painelalter.com/api'
const PATHS = { hourly: '/v2/countPerHour', daily: '/v2/count', adjusted: '/v2/countAdjusted', stores: '/getStores' } as const
export type RestSource = FlowSource | 'stores'
export function createAltervisionClient(token: string, fetcher: typeof fetch = fetch) {
  return async (source: RestSource, begin: string, end: string, signal?: AbortSignal): Promise<unknown> => {
    if (!token.trim() || /\s/.test(token) || !/^[A-Za-z0-9+/]+={0,2}$/.test(token)) throw new AltervisionError('not_configured')
    const url = new URL(API + PATHS[source])
    if (source !== 'stores') {
      url.searchParams.set('dateBegin', begin); url.searchParams.set('dateEnd', end)
      url.searchParams.set('eventType', '11')
      if (source !== 'hourly') url.searchParams.set('groupBy', 'day')
    }
    try {
      const response = await fetcher(url, {
        headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
        cache: 'no-store', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
      })
      if ([401, 403].includes(response.status)) throw new AltervisionError('auth_error')
      if (response.status === 429) {
        const retry = response.headers.get('retry-after')
        const parsed = retry && /^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry ?? '')
        throw new AltervisionError('rate_limited', new Date(Number.isFinite(parsed) ? Math.max(Date.now(), parsed) : Date.now() + 300000).toISOString())
      }
      if (!response.ok) throw new AltervisionError('unavailable')
      try { return await response.json() } catch { throw new AltervisionError('invalid_response') }
    } catch (error) {
      if (error instanceof AltervisionError) throw error
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw new AltervisionError('timeout')
      throw new AltervisionError('unavailable')
    }
  }
}
export function parseStores(input: unknown): number[] {
  if (!Array.isArray(input) || input.some(row => !object(row) || !Number.isInteger(row.id))) throw new AltervisionError('invalid_response')
  return input.map(row => Number(row.id))
}
