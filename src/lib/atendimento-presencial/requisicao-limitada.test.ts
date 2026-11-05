import { afterEach, describe, expect, it, vi } from 'vitest'
import { requisicaoLimitada, mensagemErroRequisicao } from './requisicao-limitada'
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
  it('consulta mesmo sem timeout e any estáticos no navegador', async () => {
    vi.stubGlobal('AbortSignal', class {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    expect((await requisicaoLimitada('/api/clientes')).status).toBe(200)
  })
  it('cancela a consulta anterior sem confundir com demora do servidor', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError'))))))
    const promise = requisicaoLimitada('/api/clientes', { signal: controller.signal })
    const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await assertion
  })
  it('preserva sinal já cancelado e remove listener ao terminar', async () => {
    const controller = new AbortController()
    controller.abort()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      expect(init.signal.aborted).toBe(true)
      throw new DOMException('cancelled', 'AbortError')
    }))
    await expect(requisicaoLimitada('/api/clientes', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(remove).toHaveBeenCalled()
  })
  it('explica demora na conferência sem instruir salvar um cadastro não confirmado', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))))
    const assertion = expect(requisicaoLimitada('/api/clientes', {}, 30, 'Confira sua conexão e tente conferir o telefone novamente.')).rejects.toThrow('tente conferir o telefone novamente')
    await vi.advanceTimersByTimeAsync(31)
    await assertion
  })
  it.each([new TypeError('AbortSignal.timeout is not a function'), new SyntaxError('Unexpected token'), new DOMException('aborted', 'AbortError')])('não exibe falha técnica nativa: %s', error => {
    expect(mensagemErroRequisicao(error, 'Confira sua conexão e tente novamente.')).toBe('Confira sua conexão e tente novamente.')
  })
  it('mantém orientação comercial recebida e usa alternativa para erro desconhecido', () => {
    expect(mensagemErroRequisicao(new Error('Entre novamente para continuar.'), 'Tente novamente.')).toBe('Entre novamente para continuar.')
    expect(mensagemErroRequisicao(null, 'Tente novamente.')).toBe('Tente novamente.')
  })
})
