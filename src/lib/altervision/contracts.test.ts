import { describe, expect, it } from 'vitest'
import { parseDaily, parseHourly, parseResolution } from './contracts'
import { ADJUSTED_FIXTURE, DAILY_FIXTURE, HOURLY_FIXTURE, RESOLUTION_FIXTURE } from './fixtures'
describe('contratos AlterVision documentados e resolução explícita', () => {
  it('não inventa configuração ou associação numérica', () => {
    expect(parseResolution(undefined)).toBeNull()
    expect(parseHourly([{store_identifier:1510, day:'2026-10-19',hour:10,count:3}], {}).rows).toEqual([])
    expect(parseHourly(HOURLY_FIXTURE, RESOLUTION_FIXTURE.hourly).rows[0]).toEqual({storeId:1510,day:'2026-10-19',hour:10,count:0})
  })
  it('cada fonte resolve seu identificador independente', () => {
    expect(parseDaily(DAILY_FIXTURE, RESOLUTION_FIXTURE.daily).rows[0].count).toBe(4)
    expect(parseDaily(ADJUSTED_FIXTURE, RESOLUTION_FIXTURE.adjusted).rows[0].count).toBe(5)
    expect(parseDaily(DAILY_FIXTURE, RESOLUTION_FIXTURE.adjusted).unknown).toBe(true)
    expect(parseResolution(JSON.stringify(RESOLUTION_FIXTURE))).toEqual(RESOLUTION_FIXTURE)
  })
  it.each(['{}','not-json',JSON.stringify({...RESOLUTION_FIXTURE,timezone:'UTC'}),JSON.stringify({...RESOLUTION_FIXTURE,hourly:{a:1510,b:1510}}),JSON.stringify({...RESOLUTION_FIXTURE,hourly:{a:999}})])('rejeita resolução insegura %s', raw => expect(() => parseResolution(raw)).toThrow())
  it.each([-1,1.5,'4',null])('rejeita contagem inválida %s', count => expect(() => parseHourly([{...HOURLY_FIXTURE[0],count}],RESOLUTION_FIXTURE.hourly)).toThrow())
  it.each([24,-1,10.5])('rejeita hora inválida %s', hour => expect(() => parseHourly([{...HOURLY_FIXTURE[0],hour}],RESOLUTION_FIXTURE.hourly)).toThrow())
  it('rejeita duplicatas, formato horário inventado e datas inválidas', () => {
    expect(() => parseHourly([HOURLY_FIXTURE[0],HOURLY_FIXTURE[0]],RESOLUTION_FIXTURE.hourly)).toThrow()
    expect(() => parseDaily({'2026-02-30':{x:1}},{})).toThrow()
    expect(() => parseHourly({day:'2026-10-19',count:1},{})).toThrow()
  })
})
