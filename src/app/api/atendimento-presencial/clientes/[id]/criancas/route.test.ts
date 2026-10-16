import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET, POST } from './route'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAtendimentoPresencialFichaAccess } from '@/lib/atendimento-presencial/rascunhos'
vi.mock('@/lib/supabase/service',()=>({createServiceClient:vi.fn()}))
vi.mock('@/lib/atendimento-presencial/rascunhos',()=>({requireAtendimentoPresencialFichaAccess:vi.fn()}))
const cliente='10000000-0000-4000-8000-000000000001'
const draft='20000000-0000-4000-8000-000000000001'
const origem='30000000-0000-4000-8000-000000000001'
const context={params:Promise.resolve({id:cliente})}
const rpc=vi.fn()
const req=(body: unknown)=>new Request('http://localhost/api/criancas',{method:'POST',body:JSON.stringify(body)})
describe('API crianças com autorização e isolamento',()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireAtendimentoPresencialFichaAccess).mockResolvedValue({ok:true,allowedUser:{id:'executor-real'}} as never);vi.mocked(createServiceClient).mockReturnValue({rpc} as never);rpc.mockResolvedValue({data:{permanentes:[],historicas:[]},error:null})})
  it('consulta por cliente/rascunho e executor autenticado',async()=>{const response=await GET(new Request(`http://localhost/api/criancas?rascunhoId=${draft}`),context);expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect(rpc).toHaveBeenCalledWith('atendimento_presencial_listar_criancas',{p_cliente:cliente,p_rascunho:draft,p_executor:'executor-real'})})
  it('nega módulo ou janela antes de acessar dados',async()=>{vi.mocked(requireAtendimentoPresencialFichaAccess).mockResolvedValue({ok:false,response:NextResponse.json({}, {status:403})} as never);expect((await GET(new Request('http://localhost'),context)).status).toBe(403);expect(rpc).not.toHaveBeenCalled()})
  it('ignora executor enviado pelo browser',async()=>{await POST(req({rascunhoId:draft,origemId:origem,parentesco:'Filha',dados:{},executor:'fraude'}),context);expect(rpc.mock.calls[0][1].p_executor).toBe('executor-real')})
  it('não consulta lista após falha na confirmação',async()=>{rpc.mockResolvedValue({error:{code:'42501'}});expect((await POST(req({rascunhoId:draft,origemId:origem,parentesco:'Filha',dados:{}}),context)).status).toBe(403);expect(rpc).toHaveBeenCalledTimes(1)})
  it('retorna lista atual após confirmação idempotente',async()=>{expect((await POST(req({rascunhoId:draft,origemId:origem,parentesco:'Neta',dados:{}}),context)).status).toBe(200);expect(rpc.mock.calls.map(c=>c[0])).toEqual(['atendimento_presencial_confirmar_crianca','atendimento_presencial_listar_criancas'])})
  it('gate fechado ou migration ausente não vira sucesso',async()=>{rpc.mockResolvedValue({error:{message:'criancas_nao_homologadas'}});expect((await POST(req({rascunhoId:draft,origemId:origem,parentesco:'Filha',dados:{}}),context)).status).toBe(409)})
  it('rejeita identificações e parentesco inválidos',async()=>{expect((await POST(req({rascunhoId:'outro',origemId:origem,parentesco:'Filha'}),context)).status).toBe(400);expect((await POST(req({rascunhoId:draft,origemId:origem,parentesco:''}),context)).status).toBe(422);expect(rpc).not.toHaveBeenCalled()})
})
