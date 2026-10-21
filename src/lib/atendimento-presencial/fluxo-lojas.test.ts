import { describe, expect, it } from 'vitest'
import { allowedUnits, compare, localParts, pageRecords, readFlowFilters, selectRecords, type FlowRow } from './fluxo-lojas'
import type { ExternalFlow } from '@/lib/altervision/contracts'
const units = [{id:'m',chave:'marechal',nome:'Marechal'},{id:'p',chave:'portao',nome:'Portão'},{id:'f',chave:'feira',nome:'Feira'}]
const filters = readFlowFilters(new URLSearchParams('de=2026-10-19&ate=2026-10-19&horaDe=10&horaAte=12'))
const base: FlowRow = {id:'a',unidade_id:'m',status:'concluido',versao_fluxo:2,tipo_atendimento:'cliente',cliente_id:'c',iniciado_em:'2026-10-19T13:00:00Z',concluido_em:'2026-10-19T14:00:00Z',consultora_nome:'ANA',resultado_atendimento:'sim',motivo_visita:null}
const now = new Date('2026-10-20T18:00:00Z')
const external: ExternalFlow = { state:'ok', hourly:[{storeId:1510,day:'2026-10-19',hour:10,count:0},{storeId:1510,day:'2026-10-19',hour:11,count:3}],daily:[{storeId:1510,day:'2026-10-19',count:3}],adjusted:[{storeId:1510,day:'2026-10-19',count:4}],fetchedAt:now.toISOString(),warnings:[] }
describe('fluxo lojas: autorização, agregação e contagem', () => {
  it('Gestão/superadmin nas mapeadas; supervisora apenas vínculos; demais bloqueados', () => {
    expect(allowedUnits('gestao',units,[]).map(u => u.id)).toEqual(['m','p'])
    expect(allowedUnits('superadmin',units,[])).toHaveLength(2)
    expect(allowedUnits('supervisora_loja',units,[units[1]]).map(u=>u.id)).toEqual(['p'])
    expect(allowedUnits('supervisora_loja',units,[])).toEqual([])
    expect(allowedUnits('consultora',units,units)).toEqual([])
  })
  it('inclui linhas únicas de atendimento, legado e não cliente; exclui rascunho/homologação/fora do escopo', () => {
    const rows = [base,{...base,id:'b'}, {...base,id:'legado',versao_fluxo:null,tipo_atendimento:null}, {...base,id:'nc',cliente_id:null,tipo_atendimento:'nao_cliente',resultado_atendimento:null}, {...base,id:'draft',status:'rascunho'}, {...base,id:'test',consultora_nome:'HOMOLOGACAO AGENTE'}, {...base,id:'outra',unidade_id:'p'}]
    const result = selectRecords(rows,[units[0]],filters)
    expect(result.selected).toHaveLength(4)
    const dashboard = compare(result.selected,[units[0]],filters,external,now)
    expect(dashboard.resumo).toMatchObject({clientes:3,naoClientes:1,total:4,grupos:3,diferenca:-1,cobertura:'complete'})
    expect(dashboard.porHora[0]).toMatchObject({grupos:0,diferenca:-4})
  })
  it('conclusão posterior permanece no início, com duração e marcador entre dias', () => {
    const result = selectRecords([{...base,concluido_em:'2026-10-26T14:00:00Z'}],[units[0]],filters).selected
    expect(result[0]).toMatchObject({conclusaoOutroDia:true,duracaoMinutos:10140})
    expect(compare(result,[units[0]],filters,external,now).porHora[0].total).toBe(1)
  })
  it('início inclusivo/fim exclusivo e timezone cruzando meia noite', () => {
    expect(localParts('2026-10-20T02:59:59Z')).toEqual({day:'2026-10-19',hour:23})
    expect(localParts('2026-10-20T03:00:00Z')).toEqual({day:'2026-10-20',hour:0})
    expect(selectRecords([{...base,iniciado_em:'2026-10-19T14:59:59Z'},{...base,id:'fim',iniciado_em:'2026-10-19T15:00:00Z'}],[units[0]],filters).selected).toHaveLength(1)
  })
  it('recorte consistente conserva grupos totais e mostra aviso', () => {
    const scoped = {...filters,tipo:'nao_cliente'}
    const records = selectRecords([base,{...base,id:'nc',tipo_atendimento:'nao_cliente',cliente_id:null,resultado_atendimento:null}],[units[0]],scoped).selected
    const data = compare(records,[units[0]],scoped,external,now)
    expect(data.resumo).toMatchObject({clientes:0,naoClientes:1,total:1,grupos:3,diferenca:2})
    expect(data.avisos.join(' ')).toContain('Pranchetas filtradas')
    expect(selectRecords([base],units,{...filters,consultora:'OUTRA'}).selected).toEqual([])
    expect(selectRecords([base],units,{...filters,situacao:'nao'}).selected).toEqual([])
  })
  it('zero, ausente, parcial e falha nunca se confundem', () => {
    const partial = compare([],[units[0]],filters,{...external,hourly:external.hourly.slice(0,1)},now)
    expect(partial.resumo).toMatchObject({grupos:0,cobertura:'partial',diferenca:null})
    expect(partial.porHora[1]).toMatchObject({grupos:null,cobertura:'missing',diferenca:null})
    expect(compare([],[units[0]],filters,{...external,state:'unavailable',hourly:[]},now).resumo.grupos).toBeNull()
    expect(compare([],[units[0]],filters,{...external,state:'partial'},now).resumo.diferenca).toBeNull()
  })
  it('dia em andamento não produz diferença definitiva', () => {
    expect(compare([],[units[0]],filters,external,new Date('2026-10-19T14:30:00Z')).resumo.diferenca).toBeNull()
  })
  it('ajustado diário separado, reconciliação e classificação inválida explícita', () => {
    const data = compare([],[units[0]],filters,{...external,daily:[{storeId:1510,day:'2026-10-19',count:8}]},now)
    expect(data.diario[0]).toMatchObject({medido:8,ajustado:4,somaHoraria:3,divergente:true})
    expect(data.resumo.diferenca).toBeNull()
    expect(selectRecords([{...base,tipo_atendimento:null}],units,filters).invalid).toBe(1)
  })
  it('paginação após contagem não trunca totais e possui ordenação estável', () => {
    const rows = selectRecords(Array.from({length:41},(_,i)=>({...base,id:String(i).padStart(3,'0')})),[units[0]],filters).selected
    expect(pageRecords(rows,'2')).toMatchObject({page:2,total:41,pages:3,pageSize:20})
    expect(pageRecords(rows,'2').registros).toHaveLength(20)
    expect(pageRecords(rows,'99').registros).toHaveLength(1)
    expect(pageRecords(rows,'1').registros[0].id).toBe('040')
    expect(() => pageRecords(rows,'NaN')).toThrow()
  })
  it.each(['de=2026-02-30','de=2026-09-01&ate=2026-10-19','horaDe=12&horaAte=10','horaDe=0&horaAte=25','tipo=desconhecido','situacao=x'])('valida filtros %s', query => expect(() => readFlowFilters(new URLSearchParams(query),now)).toThrow())
})
