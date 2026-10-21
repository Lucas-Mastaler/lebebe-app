import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
const state = vi.hoisted(() => ({ perfil:'gestao', moduleAllowed:true, windowAllowed:true, calls: [] as Array<{table:string;filters:Array<[string,string,unknown]>}>, rows:[] as Array<Record<string,unknown>>, fail:false }))
vi.mock('server-only',()=>({}))
vi.mock('@/lib/auth/module-access',()=>({requireModuleAccess:vi.fn(async () => state.moduleAllowed ? {ok:true,allowedUser:{id:'actor',role:state.perfil==='superadmin'?'superadmin':'user'}} : {ok:false,response:NextResponse.json({ok:false},{status:403})})}))
vi.mock('@/lib/auth/access-window',()=>({checkAccessWindowForUser:vi.fn(async () => ({ok:state.windowAllowed}))}))
vi.mock('@/lib/atendimento-presencial/rascunhos',async importOriginal=>({...await importOriginal<typeof import('@/lib/atendimento-presencial/rascunhos')>(),carregarPerfilAtendimento:vi.fn(async()=>state.perfil)}))
const unitM = {id:'078e42b2-ba21-4478-81bd-5b25d5c72766',chave:'marechal',nome:'Marechal'}
const unitP = {id:'b555a87c-ad0e-4e87-b7a3-5ce6a80a1852',chave:'portao',nome:'Portão'}
vi.mock('@/lib/supabase/service',()=>({createServiceClient:()=>({from:(table:string)=>{
  const call = {table,filters:[] as Array<[string,string,unknown]>}; state.calls.push(call)
  let from=0,to=499
  const query = {
    select:()=>query,eq:(key:string,value:unknown)=>{call.filters.push(['eq',key,value]);return query},
    in:(key:string,value:unknown)=>{call.filters.push(['in',key,value]);return query},
    gte:()=>query,lt:()=>query,order:()=>query,range:(a:number,b:number)=>{from=a;to=b;return query},
    maybeSingle:async()=>{const result = await query; return {data:result.data[0]??null,error:result.error}},
    then:(resolve:(value:{data:Array<Record<string,unknown>>;error:unknown})=>unknown)=>{
      let rows: Array<Record<string,unknown>> = table==='app_unidades'?[unitM,unitP,{id:'feira',chave:'feira',nome:'Feira'}]:table==='app_usuarios_unidades'?[{unidade_id:unitM.id}]:table==='atendimento_presencial_atendimentos'?state.rows:table==='atendimento_presencial_clientes'?[{id:'private-client-id',nome:'Cliente sintética',telefone_informado:'41999990000'}]:[]
      if(table==='atendimento_presencial_atendimentos'||table==='atendimento_presencial_clientes') rows=rows.filter(row=>call.filters.every(([op,key,value])=>op==='eq'?row[key]===value:(value as unknown[]).includes(row[key])))
      return Promise.resolve({data:rows.slice(from,to+1),error:state.fail?{message:'privado'}:null}).then(resolve)
    },
  }
  return query
}})}))
vi.mock('@/lib/altervision/service',()=>({getExternalFlow:vi.fn(async()=>({state:'not_configured',hourly:[],daily:[],adjusted:[],fetchedAt:null,warnings:[]}))}))
import { GET } from './route'
import { GET as tableGET } from './atendimentos/route'
import { GET as originalGET } from './atendimentos/[id]/route'
import { POST } from './atualizar/route'
import { getExternalFlow } from '@/lib/altervision/service'
import { requireModuleAccess } from '@/lib/auth/module-access'
const base = {id:'51f795e3-5466-41cb-9887-32659775f67a',unidade_id:unitM.id,status:'concluido',versao_fluxo:2,tipo_atendimento:'cliente',cliente_id:'private-client-id',iniciado_em:'2026-10-19T13:00:00Z',concluido_em:'2026-10-20T14:00:00Z',consultora_nome:'ANA',resultado_atendimento:'sim',motivo_visita:null}
const url='http://localhost/api/atendimento-presencial/fluxo-lojas?de=2026-10-19&ate=2026-10-19&horaDe=10&horaAte=12'
beforeEach(()=>{state.perfil='gestao';state.moduleAllowed=true;state.windowAllowed=true;state.calls=[];state.fail=false;state.rows=[base,{...base,id:'c75501a1-e4dc-4a32-985a-266900d3c36f',unidade_id:unitP.id},{...base,id:'test',consultora_nome:'HOMOLOGACAO TESTE'},{...base,id:'draft',status:'rascunho'}];vi.clearAllMocks()})
describe('API real com Supabase e REST simulados: isolamento por unidade',()=>{
  it('Gestão consulta todas as mapeadas sem expor clientes/payloads',async()=>{
    const response=await GET(new Request(url));const body=await response.json()
    expect(response.status).toBe(200);expect(body.resumo.total).toBe(2);expect(body.tabela.total).toBe(2)
    expect(body.unidades).toHaveLength(2);expect(JSON.stringify(body)).not.toContain('private-client-id')
    expect(body.externo.state).toBe('not_configured');expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
  it('supervisora consulta apenas vínculo e não aquece cache para outra filial',async()=>{
    state.perfil='supervisora_loja'
    const body=await (await GET(new Request(url))).json();expect(body.resumo.total).toBe(1)
    expect(body.porFilial).toHaveLength(1);expect(body.unidades[0].id).toBe(unitM.id)
    const query=state.calls.find(call=>call.table==='atendimento_presencial_atendimentos')
    expect(query?.filters).toContainEqual(['in','unidade_id',[unitM.id]])
    const response=await GET(new Request(url+'&unidadeId='+unitP.id));expect(response.status).toBe(403)
    expect(vi.mocked(getExternalFlow)).toHaveBeenCalledTimes(1)
  })
  it.each(['consultora','pos_venda','inexistente'])('bloqueia perfil %s mesmo com módulo liberado',async perfil=>{
    state.perfil=perfil;expect((await GET(new Request(url))).status).toBe(403);expect(state.calls).toHaveLength(0)
  })
  it('bloqueia módulo/janela antes da leitura',async()=>{
    state.moduleAllowed=false;expect((await GET(new Request(url))).status).toBe(403)
    state.moduleAllowed=true;state.windowAllowed=false;expect((await GET(new Request(url))).status).toBe(403)
    expect(state.calls).toHaveLength(0)
  })
  it('propaga 401 antes de consultar qualquer fonte',async()=>{
    vi.mocked(requireModuleAccess).mockResolvedValueOnce({ok:false,response:NextResponse.json({ok:false},{status:401})})
    expect((await GET(new Request(url))).status).toBe(401);expect(state.calls).toHaveLength(0);expect(getExternalFlow).not.toHaveBeenCalled()
  })
  it('cache externo compartilhado nunca vaza valores de outra unidade',async()=>{
    const shared={state:'ok' as const,hourly:[{storeId:1510,day:'2026-10-19',hour:10,count:2},{storeId:1546,day:'2026-10-19',hour:10,count:999}],daily:[],adjusted:[],fetchedAt:new Date().toISOString(),warnings:[]}
    vi.mocked(getExternalFlow).mockResolvedValueOnce(shared).mockResolvedValueOnce(shared)
    const management=await (await GET(new Request(url))).json();expect(management.resumo.grupos).toBe(1001)
    state.perfil='supervisora_loja'
    const supervisor=await (await GET(new Request(url))).json();expect(supervisor.resumo.grupos).toBe(2)
    expect(supervisor.porFilial).toHaveLength(1);expect(supervisor.externo.hourly).toBeUndefined();expect(supervisor.diario.every((row:{unidadeId:string})=>row.unidadeId===unitM.id)).toBe(true)
  })
  it('paginação backend 20 e totais acima de 500',async()=>{
    state.rows=Array.from({length:521},(_,i)=>({...base,id:String(i).padStart(4,'0')}))
    const body=await (await tableGET(new Request(url+'&page=2'))).json()
    expect(body.total).toBe(521);expect(body.registros).toHaveLength(20);expect(body.page).toBe(2);expect(getExternalFlow).not.toHaveBeenCalled()
  })
  it('mesmos filtros nos totais/tabela; filial manipulada rejeitada',async()=>{
    state.rows.push({...base,id:'nc',tipo_atendimento:'nao_cliente',cliente_id:null,resultado_atendimento:null})
    const body=await (await GET(new Request(url+'&tipo=nao_cliente'))).json()
    expect(body.resumo.total).toBe(1);expect(body.tabela.registros[0].tipo).toBe('nao_cliente')
    expect(body.resumo.clientes).toBe(0)
    expect((await tableGET(new Request(url+'&unidadeId=feira'))).status).toBe(403)
  })
  it('detalhe relê original e não permite unidade alheia/homologação/rascunho',async()=>{
    state.perfil='supervisora_loja'
    const response=await originalGET(new Request(url),{params:Promise.resolve({id:base.id})})
    const body=await response.json();expect(body.registro.conclusaoOutroDia).toBe(true);expect(body.registro.id).toBe(base.id)
    expect(body.detalhe.atendimento.id).toBe(base.id);expect(body.detalhe.cliente.nome).toBe('Cliente sintética');expect(body.detalhe.podeEditar).toBe(false);expect(body.unidadeNome).toBe('Marechal')
    expect((await originalGET(new Request(url),{params:Promise.resolve({id:'c75501a1-e4dc-4a32-985a-266900d3c36f'})})).status).toBe(404)
    state.rows=[{...base,consultora_nome:'HOMOLOGACAO TESTE'}]
    expect((await originalGET(new Request(url),{params:Promise.resolve({id:base.id})})).status).toBe(404)
  })
  it('atualização exige origem e autorização, sem conceder privilégios',async()=>{
    expect((await POST(new Request(url,{method:'POST'}))).status).toBe(403)
    expect((await POST(new Request(url,{method:'POST',headers:{origin:'https://intruso.invalid'}}))).status).toBe(403)
    expect((await POST(new Request(url,{method:'POST',headers:{origin:'http://localhost'}}))).status).toBe(200)
    expect(getExternalFlow).toHaveBeenLastCalledWith('2026-10-19','2026-10-19',true)
  })
  it('filtros inválidos não consultam registros; falhas internas não vazam dados',async()=>{
    expect((await GET(new Request(url+'&horaAte=25'))).status).toBe(400)
    state.fail=true;const response=await GET(new Request(url));expect(response.status).toBe(500);expect(await response.text()).not.toContain('privado')
  })
})
