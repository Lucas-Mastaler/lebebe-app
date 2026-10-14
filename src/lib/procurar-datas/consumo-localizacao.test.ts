import { describe, expect, it, vi } from 'vitest'
import { ErroConsumoLocalizacao, fetchLocalizacao } from './consumo-localizacao'
const controle = () => ({ reservar: vi.fn().mockResolvedValue('reserva'), concluir: vi.fn().mockResolvedValue(undefined) })
describe('consumo externo de localização', () => {
  it('reserva antes de chamar o provedor e conclui sucesso', async () => {
    const c = controle()
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => {
      expect(c.reservar).toHaveBeenCalledWith('nominatim',expect.any(AbortSignal))
      return Response.json({ address: {} })
    })
    await fetchLocalizacao('nominatim','https://example.org',undefined,{ controle:c,fetchImpl })
    expect(c.concluir).toHaveBeenCalledExactlyOnceWith('reserva',true,200)
  })
  it.each([new Error('rede'), new DOMException('tempo','TimeoutError')])('contabiliza tentativa que falha sem retry', async (error) => {
    const c = controle(), fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(error)
    await expect(fetchLocalizacao('nominatim','https://example.org',undefined,{controle:c,fetchImpl})).rejects.toBe(error)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(c.concluir).toHaveBeenCalledExactlyOnceWith('reserva',false,undefined)
  })
  it.each([429,500])('registra HTTP %s como falha', async (status) => {
    const c=controle(), fetchImpl=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status}))
    await fetchLocalizacao('nominatim','https://example.org',undefined,{controle:c,fetchImpl})
    expect(c.concluir).toHaveBeenCalledExactlyOnceWith('reserva',false,status)
  })
  it('erro de Google Geocoding HTTP 200 não é sucesso', async () => {
    const c=controle(), fetchImpl=vi.fn<typeof fetch>().mockResolvedValue(Response.json({status:'REQUEST_DENIED'}))
    await fetchLocalizacao('google-geocoding','https://example.org',undefined,{controle:c,fetchImpl})
    expect(c.concluir).toHaveBeenCalledWith('reserva',false,200)
  })
  it('falha de leitura do corpo fica registrada', async () => {
    const c=controle(), fetchImpl=vi.fn<typeof fetch>().mockResolvedValue(new Response('não é JSON'))
    await expect(fetchLocalizacao('nominatim','https://example.org',undefined,{controle:c,fetchImpl})).rejects.toThrow()
    expect(c.concluir).toHaveBeenCalledWith('reserva',false,200)
  })
  it('redirecionamento do Google Maps é consulta externa bem-sucedida', async () => {
    const c=controle(),fetchImpl=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:302}))
    await fetchLocalizacao('google-maps-link','https://example.org',undefined,{controle:c,fetchImpl})
    expect(c.concluir).toHaveBeenCalledWith('reserva',true,302)
  })
  it.each(['limite','indisponivel'])('sem reserva (%s) não inicia rede', async (motivo) => {
    const c=controle(),fetchImpl=vi.fn<typeof fetch>()
    if (motivo === 'limite') c.reservar.mockResolvedValue(null); else c.reservar.mockRejectedValue(new Error('banco'))
    await expect(fetchLocalizacao('nominatim','https://example.org',undefined,{controle:c,fetchImpl})).rejects.toBeInstanceOf(ErroConsumoLocalizacao)
    expect(fetchImpl).not.toHaveBeenCalled();expect(c.concluir).not.toHaveBeenCalled()
  })
  it('falha na conclusão não libera consumo nem repete chamada', async () => {
    const c=controle(),fetchImpl=vi.fn<typeof fetch>().mockResolvedValue(Response.json({}))
    c.concluir.mockRejectedValue(new Error('banco'))
    expect((await fetchLocalizacao('nominatim','https://example.org',undefined,{controle:c,fetchImpl})).ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('requisições concorrentes respeitam a última reserva disponível',async()=>{
    let total=9899
    const c=controle()
    c.reservar.mockImplementation(async()=>total<9900 ? `reserva-${++total}` : null)
    const fetchImpl=vi.fn<typeof fetch>().mockImplementation(async()=>Response.json({}))
    const resultados=await Promise.allSettled(Array.from({length:20},()=>fetchLocalizacao('nominatim','https://example.org',undefined,{controle:c,fetchImpl})))
    expect(resultados.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(total).toBe(9900)
  })
})
