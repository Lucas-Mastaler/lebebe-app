import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { ErroConsumoLocalizacao } from '@/lib/procurar-datas/consumo-localizacao'
const mocks=vi.hoisted(()=>({cache:vi.fn(),location:vi.fn(),google:vi.fn(),apps:vi.fn(),externo:vi.fn()}))
vi.mock('@/lib/procurar-datas/api',async(original)=>({ ...await original<typeof import('@/lib/procurar-datas/api')>(),validarAcessoProcurarDatas:async()=>({response:null}) }))
vi.mock('@/lib/procurar-datas/endereco-cache',()=>({buscarEnderecoNoGeoCache:mocks.cache,salvarEnderecoNoGeoCache:vi.fn()}))
vi.mock('@/lib/procurar-datas/locationiq',()=>({buscarEnderecoLocationIq:mocks.location}))
vi.mock('@/lib/procurar-datas/google-geocoding',()=>({consultarGoogleGeocodingEnderecoDificil:mocks.google,ehEnderecoDificilRodoviaOuRural:()=>false}))
vi.mock('@/lib/procurar-datas/apps-script',()=>({chamarAppsScriptProcurarDatas:mocks.apps,isTimeoutError:()=>false}))
vi.mock('@/lib/procurar-datas/consumo-localizacao',async(original)=>({ ...await original<typeof import('@/lib/procurar-datas/consumo-localizacao')>(),fetchLocalizacao:mocks.externo }))
const form={cep:'80010000',numero:'10',logradouro:'Rua Teste',bairro:'Centro',cidade:'Curitiba',uf:'PR'}
const request=(body:object)=>new NextRequest('http://localhost/api/procurar-datas/validar-endereco',{method:'POST',body:JSON.stringify(body)})
beforeEach(()=>vi.clearAllMocks())
it('cache tradicional continua disponível sem consumir cota',async()=>{
  mocks.cache.mockResolvedValue({status:'hit',resultado:{lat:-25,lng:-49}})
  expect((await POST(request(form))).status).toBe(200)
  expect(mocks.externo).not.toHaveBeenCalled();expect(mocks.location).not.toHaveBeenCalled()
})
it('cota esgotada interrompe a cadeia externa sem tentar outro provedor',async()=>{
  mocks.cache.mockResolvedValue({status:'miss'})
  mocks.externo.mockRejectedValue(new ErroConsumoLocalizacao('limite-mensal'))
  mocks.location.mockImplementation(async(_form,options)=>{
    try { await options.fetchFn('https://example.org'); } catch { /* Mesmo contrato de falha do geocodificador existente. */ }
    return {status:'failed',motivo:'sem_resultado'}
  })
  const response=await POST(request(form))
  expect(response.status).toBe(429)
  expect((await response.json()).error).toContain('Limite mensal')
  expect(mocks.externo).toHaveBeenCalledTimes(1)
  expect(mocks.google).not.toHaveBeenCalled();expect(mocks.apps).not.toHaveBeenCalled()
})
it('endereço tradicional incompleto permanece inválido',async()=>{
  expect((await POST(request({...form,numero:''}))).status).toBe(400)
  expect(mocks.cache).not.toHaveBeenCalled();expect(mocks.externo).not.toHaveBeenCalled()
})
