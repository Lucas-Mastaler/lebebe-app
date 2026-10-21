import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { createAltervisionClient, parseStores } from './client'
// Token descartável gerado em memória; nenhum segredo real ou valor de exemplo persistido.
function client(fetcher: typeof fetch) { return createAltervisionClient(Buffer.from(crypto.randomUUID()).toString('base64'),fetcher) }
describe('cliente REST AlterVision', () => {
  it('Basic server-side e grupos evento 11 sem filtros inexistentes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]))
    await client(fetcher)('hourly','2026-10-19','2026-10-19')
    const [url,options] = fetcher.mock.calls[0]
    expect(String(url)).toContain('/api/v2/countPerHour?')
    expect(new URL(String(url)).searchParams.get('eventType')).toBe('11')
    expect(new URL(String(url)).searchParams.has('storeIds')).toBe(false)
    expect(new Headers(options?.headers).get('Authorization')).toMatch(/^Basic \S+$/)
    expect(options?.redirect).toBe('error'); expect(options?.cache).toBe('no-store')
  })
  it('usa groupBy=day para total/ajustado', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}))
    await client(fetcher)('adjusted','2026-10-19','2026-10-19')
    expect(String(fetcher.mock.calls[0][0])).toContain('countAdjusted')
    expect(String(fetcher.mock.calls[0][0])).toContain('groupBy=day')
  })
  it.each([[401,'auth_error'],[403,'auth_error'],[500,'unavailable'],[429,'rate_limited']])('trata %s sem resposta bruta', async (status,state) => {
    await expect(client(vi.fn().mockResolvedValue(new Response('corpo privado',{status:Number(status)})))('hourly','2026-10-19','2026-10-19')).rejects.toMatchObject({state})
  })
  it('respeita Retry-After', async () => {
    const start = Date.now()
    await expect(client(vi.fn().mockResolvedValue(new Response('',{status:429,headers:{'retry-after':'90'}})))('hourly','2026-10-19','2026-10-19')).rejects.toSatisfy((error: {retryAt:string}) => Date.parse(error.retryAt) >= start+90000)
  })
  it('não tenta sem configuração e não expõe erro de transporte', async () => {
    const fetcher = vi.fn()
    await expect(createAltervisionClient('',fetcher)('hourly','','')).rejects.toMatchObject({state:'not_configured'})
    expect(fetcher).not.toHaveBeenCalled()
    await expect(client(vi.fn().mockRejectedValue(new Error('segredo transporte')))('hourly','','')).rejects.toMatchObject({message:'Falha na consulta AlterVision: unavailable'})
    await expect(client(vi.fn().mockRejectedValue(new DOMException('timeout','TimeoutError')))('hourly','','')).rejects.toMatchObject({state:'timeout'})
  })
  it('valida resposta JSON e lojas', async () => {
    await expect(client(vi.fn().mockResolvedValue(new Response('html')))('hourly','','')).rejects.toMatchObject({state:'invalid_response'})
    expect(parseStores([{id:1510}])).toEqual([1510]); expect(() => parseStores([{id:'1510'}])).toThrow()
  })
})
