import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registrarAuditoriaPesquisa } from './auditoria-pesquisa'

const insert = vi.hoisted(() => vi.fn((data: Record<string, unknown>) => { void data; return ({ select: vi.fn(() => ({
  single: vi.fn(async () => ({ data: { id: 'audit-test' }, error: null })),
})) }) }))
afterEach(() => vi.restoreAllMocks())
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => ({ insert }) }) }))
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'log').mockImplementation(() => undefined) })

it('preserva o snapshot adicional dentro do JSON existente e não altera resultados', async () => {
  const snapshotTecnico = { candidatosFinais: [], memoriaFrete: { versao: 1, distKm: 38.948,
    candidatos: [{ etapas: [{ descricao: 'Frete final', operacao: '370 × 1.2; ceil dezena', valor: 450 }], freteApresentado: 'R$ 450' }] } }
  const result = await registrarAuditoriaPesquisa({ runId: 'run-test', clientToken: 'token-test', userEmail: 'test@example.invalid',
    parametros: { dataInicial: '2026-11-19' }, snapshotTecnico, resultados: [], status: 'success' })
  expect(result.sucesso).toBe(true)
  expect(insert.mock.calls[0][0]).toMatchObject({ parametros_json: { dataInicial: '2026-11-19', snapshotTecnico }, resultados_json: [] })
  expect(JSON.parse(JSON.stringify(insert.mock.calls[0][0])).parametros_json.snapshotTecnico).toEqual(snapshotTecnico)
})
it('preserva localização declarada no JSON e coordenada zero, sem perder precisão',async()=>{
  const localizacao={versao:1 as const,metodo:'coordenadas-diretas' as const,lat:0,lng:-49.298785,origemCoordenadas:'coordenadas-diretas'}
  await registrarAuditoriaPesquisa({runId:'run-coordenadas',clientToken:'token',userEmail:'test@example.invalid',
    latitude:localizacao.lat,longitude:localizacao.lng,parametros:{localizacao},status:'success'})
  expect(insert.mock.calls[0][0]).toMatchObject({latitude:0,longitude:-49.298785,parametros_json:{localizacao}})
})
