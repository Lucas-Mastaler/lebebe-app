import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ADJUSTED_FIXTURE, DAILY_FIXTURE, HOURLY_FIXTURE, RESOLUTION_FIXTURE } from './fixtures'
const cacheMock = vi.hoisted(() => ({ entries: new Map<string,{time:number,value:unknown,tags:string[]}>(), options: [] as Array<{revalidate:number}>, invalidated: [] as string[] }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>, keys: string[], options: {revalidate:number;tags?:string[]}) => async () => {
    const key = keys.join('/'); const old = cacheMock.entries.get(key); cacheMock.options.push(options)
    if (old && Date.now()-old.time < options.revalidate*1000) return old.value
    const value = await fn(); cacheMock.entries.set(key,{value,time:Date.now(),tags:options.tags ?? []}); return value
  },
  revalidateTag: (tag: string) => { cacheMock.invalidated.push(tag); for (const [key,entry] of cacheMock.entries) if (entry.tags.includes(tag)) cacheMock.entries.delete(key) },
}))
async function setup() {
  vi.resetModules(); cacheMock.entries.clear(); cacheMock.options.length=0; cacheMock.invalidated.length=0
  vi.stubEnv('ALTERVISION_BASIC_AUTH_TOKEN',Buffer.from(crypto.randomUUID()).toString('base64'))
  vi.stubEnv('ALTERVISION_STORE_IDENTIFIERS_JSON',JSON.stringify(RESOLUTION_FIXTURE))
  const fetcher = vi.fn<typeof fetch>(async url => {
    const path = new URL(String(url)).pathname
    if (path.endsWith('getStores')) return Response.json([{id:1510},{id:1546},{id:1512}])
    return Response.json(path.endsWith('countPerHour') ? HOURLY_FIXTURE : path.endsWith('countAdjusted') ? ADJUSTED_FIXTURE : DAILY_FIXTURE)
  })
  vi.stubGlobal('fetch',fetcher)
  return { service: await import('./service'),fetcher }
}
beforeEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('cache e orquestração REST com fixtures', () => {
  it('sem credencial mantém configuração pendente sem chamadas', async () => {
    const {service,fetcher} = await setup(); vi.stubEnv('ALTERVISION_BASIC_AUTH_TOKEN','')
    expect((await service.getExternalFlow('2026-10-19','2026-10-19')).state).toBe('not_configured'); expect(fetcher).not.toHaveBeenCalled()
  })
  it('sem mapa explícito não infere IDs nem faz consultas de fluxo', async () => {
    const {service,fetcher} = await setup(); vi.stubEnv('ALTERVISION_STORE_IDENTIFIERS_JSON','')
    expect((await service.getExternalFlow('2026-10-19','2026-10-19')).state).toBe('mapping_pending'); expect(fetcher).not.toHaveBeenCalled()
  })
  it('cache 300s, atualização manual e deduplicação de chamadas simultâneas', async () => {
    const {service,fetcher} = await setup()
    const [a,b] = await Promise.all([service.getExternalFlow('2026-10-19','2026-10-19'),service.getExternalFlow('2026-10-19','2026-10-19')])
    expect(a.state).toBe('ok'); expect(a).toEqual(b); expect(fetcher).toHaveBeenCalledTimes(4)
    await service.getExternalFlow('2026-10-19','2026-10-19'); expect(fetcher).toHaveBeenCalledTimes(4)
    await service.getExternalFlow('2026-10-19','2026-10-19',true); expect(fetcher).toHaveBeenCalledTimes(7)
    expect(cacheMock.invalidated).toHaveLength(3); expect(cacheMock.options.every(option=>option.revalidate===300)).toBe(true)
  })
  it('expiração e credenciais distintas não compartilham entradas', async () => {
    const {service,fetcher} = await setup(); await service.getExternalFlow('2026-10-19','2026-10-19')
    for (const entry of cacheMock.entries.values()) entry.time -= 301000
    await service.getExternalFlow('2026-10-19','2026-10-19'); expect(fetcher).toHaveBeenCalledTimes(8)
    vi.stubEnv('ALTERVISION_BASIC_AUTH_TOKEN',Buffer.from(crypto.randomUUID()).toString('base64'))
    await service.getExternalFlow('2026-10-19','2026-10-19'); expect(fetcher).toHaveBeenCalledTimes(12)
  })
  it('falha opcional resulta parcial e preserva fluxo medido', async () => {
    const {service,fetcher} = await setup()
    fetcher.mockImplementation(async url => new URL(String(url)).pathname.endsWith('getStores') ? Response.json([{id:1510},{id:1546}]) : new URL(String(url)).pathname.endsWith('countPerHour') ? Response.json(HOURLY_FIXTURE) : new Response('',{status:500}))
    const result = await service.getExternalFlow('2026-10-19','2026-10-19')
    expect(result.state).toBe('partial'); expect(result.hourly).toHaveLength(3); expect(result.adjusted).toEqual([])
  })
  it('IDs desconhecidos geram aviso seguro e cobertura parcial', async () => {
    const {service,fetcher} = await setup()
    fetcher.mockImplementation(async url => new URL(String(url)).pathname.endsWith('getStores') ? Response.json([{id:1510},{id:1546}]) : new URL(String(url)).pathname.endsWith('countPerHour') ? Response.json([...HOURLY_FIXTURE,{...HOURLY_FIXTURE[0],store_identifier:'desconhecido'}]) : Response.json({}))
    const result = await service.getExternalFlow('2026-10-19','2026-10-19')
    expect(result.state).toBe('partial'); expect(result.hourly).toHaveLength(3); expect(JSON.stringify(result)).not.toContain('desconhecido')
  })
  it('rate limit de descoberta mantém cooldown e não repete imediatamente', async () => {
    const {service,fetcher} = await setup(); fetcher.mockResolvedValue(new Response('',{status:429,headers:{'retry-after':'300'}}))
    expect((await service.getExternalFlow('2026-10-19','2026-10-19')).state).toBe('rate_limited')
    await service.getExternalFlow('2026-10-19','2026-10-19',true); expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('período é dividido em lotes semanais', async () => {
    const {service} = await setup()
    expect(service.dateChunks('2026-10-01','2026-10-19')).toEqual([['2026-10-01','2026-10-07'],['2026-10-08','2026-10-14'],['2026-10-15','2026-10-19']])
  })
  it('no máximo duas chamadas de rede em paralelo e rejeita período fora do contrato', async () => {
    const {service,fetcher} = await setup(); let active=0; let maximum=0
    fetcher.mockImplementation(async url => {
      active++; maximum=Math.max(maximum,active)
      await new Promise(resolve=>setTimeout(resolve,1)); active--
      const path=new URL(String(url)).pathname
      return Response.json(path.endsWith('getStores')?[{id:1510},{id:1546}]:path.endsWith('countPerHour')?[]:{})
    })
    await service.getExternalFlow('2026-10-01','2026-10-19')
    expect(maximum).toBe(2)
    fetcher.mockImplementation(async url => new URL(String(url)).pathname.endsWith('countPerHour')?Response.json(HOURLY_FIXTURE):Response.json({}))
    const result=await service.getExternalFlow('2026-10-01','2026-10-01',true)
    expect(result.hourly).toEqual([]);expect(result.state).toBe('partial')
  })
})
