import { describe, expect, it } from 'vitest'
import { compare, readFlowFilters } from './fluxo-lojas'
import { retainLastMeasurement } from './fluxo-lojas-stale'
const filters=readFlowFilters(new URLSearchParams('de=2026-10-19&ate=2026-10-19&horaDe=10&horaAte=11'))
const units=[{id:'m',chave:'marechal',nome:'Marechal'}]
const previous=compare([],units,filters,{state:'ok',hourly:[{storeId:1510,day:'2026-10-19',hour:10,count:4}],daily:[],adjusted:[],fetchedAt:'2026-10-19T18:00:00Z',warnings:[]},new Date('2026-10-20T18:00:00Z'))
const failed=compare([],units,filters,{state:'timeout',hourly:[],daily:[],adjusted:[],fetchedAt:null,warnings:[]},new Date('2026-10-20T18:00:00Z'))
describe('última medição autorizada',()=>{
  it.each(['timeout','partial'] as const)('preserva referência em %s com timestamp/aviso sem diferença definitiva',state=>{
    const result=retainLastMeasurement(previous,{...failed,externo:{...failed.externo,state}})
    expect(result.resumo).toMatchObject({grupos:4,cobertura:'partial',diferenca:null})
    expect(result.externo.state).toBe(state);expect(result.externo.fetchedAt).toBe(previous.externo.fetchedAt)
    expect(result.externo.warnings.join()).toContain('desatualizada')
  })
  it('nunca reaproveita valores após mudança de filtros ou permissões',()=>{
    expect(retainLastMeasurement(previous,{...failed,filtros:{...filters,tipo:'cliente'}}).resumo.grupos).toBeNull()
    expect(retainLastMeasurement(previous,{...failed,unidades:[]}).resumo.grupos).toBeNull()
  })
})
