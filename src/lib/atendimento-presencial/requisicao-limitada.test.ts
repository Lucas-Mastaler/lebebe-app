import { afterEach, describe, expect, it, vi } from 'vitest'
import { requisicaoLimitada } from './requisicao-limitada'
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})
describe('requisição limitada sem perda da identidade',()=>{
  it('encerra espera indefinida e permite repetir o mesmo payload',async()=>{
    vi.useFakeTimers()
    vi.stubGlobal('fetch',vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('aborted'))))))
    const promise=requisicaoLimitada('/api/rascunhos',{method:'POST',body:'mesmo-draft'},30)
    const assertion=expect(promise).rejects.toThrow('preenchimento foi preservado')
    await vi.advanceTimersByTimeAsync(31);await assertion
    expect(fetch).toHaveBeenCalledWith('/api/rascunhos',expect.objectContaining({body:'mesmo-draft'}))
  })
  it('preserva erro operacional e resposta do servidor',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:503})));expect((await requisicaoLimitada('/api')).status).toBe(503)})
})
