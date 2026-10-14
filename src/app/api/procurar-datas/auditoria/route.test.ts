import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET } from './route'
const mocks=vi.hoisted(()=>({acesso:vi.fn(),resumo:vi.fn()}))
vi.mock('@/lib/auth/module-access',()=>({requireModuleAccess:mocks.acesso}))
vi.mock('@/lib/procurar-datas/consumo-localizacao',()=>({consultarResumoConsumoLocalizacao:mocks.resumo}))
beforeEach(()=>{vi.clearAllMocks();mocks.acesso.mockResolvedValue({ok:true});mocks.resumo.mockResolvedValue({total:10,limite:9900,restantes:9890,mes:'2026-10-01',proximoReinicio:'2026-11-01',provedores:[]})})
it('exige a mesma permissão da auditoria antes de expor consumo',async()=>{
  mocks.acesso.mockResolvedValue({ok:false,response:NextResponse.json({ok:false},{status:403})})
  expect((await GET(new NextRequest('http://localhost/api/procurar-datas/auditoria?consumo=1'))).status).toBe(403)
  expect(mocks.resumo).not.toHaveBeenCalled()
})
it('expõe resumo discreto e sem cache público na rota existente',async()=>{
  const response=await GET(new NextRequest('http://localhost/api/procurar-datas/auditoria?consumo=1'))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect((await response.json()).consumo).toMatchObject({total:10,restantes:9890,limite:9900})
})
it('indisponibilidade do resumo não transforma a auditoria em erro',async()=>{
  mocks.resumo.mockResolvedValue(null)
  const response=await GET(new NextRequest('http://localhost/api/procurar-datas/auditoria?consumo=1'))
  expect(response.status).toBe(200)
  expect((await response.json()).consumo).toBeNull()
})
