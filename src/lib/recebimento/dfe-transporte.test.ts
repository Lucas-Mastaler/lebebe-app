import { EventEmitter } from 'node:events'
import https from 'node:https'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enviarSoap } from './dfe-soap'
import type { ConfigDfe } from './dfe-config'

vi.mock('node:https', () => ({ default: { request: vi.fn() } }))
const config: ConfigDfe = { cnpj: '12345678000195', uf: '35', ambiente: '2', key: 'CHAVE PRIVADA FICTICIA', cert: 'CERTIFICADO FICTICIO' }
function transporte(status = 200, data = '<SOAP/>', erro?: string) {
  const request = new EventEmitter() as EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }
  request.end = vi.fn(() => {
    if (erro) { request.emit('error', Object.assign(new Error('SEGREDO'), { code: erro })); request.emit('close'); return }
    const response = Object.assign(new EventEmitter(), { statusCode: status, resume: vi.fn(), destroy: vi.fn() })
    const callback = vi.mocked(https.request).mock.calls[0][2] as unknown as (response: unknown) => void
    callback(response)
    response.emit('data', Buffer.from(data))
    response.emit('end')
    request.emit('close')
  })
  request.destroy = vi.fn((error: Error) => { request.emit('error', error); request.emit('close') })
  vi.mocked(https.request).mockReturnValue(request as never)
  return request
}
describe('mTLS Node direto, sem proxy na VPS', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())
  it('usa somente endpoint oficial, SOAP 1.2, TLS verificado e certificado no servidor', async () => {
    const request = transporte()
    expect(await enviarSoap(config, '1'.repeat(44))).toBe('<SOAP/>')
    expect(https.request).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledWith('https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx', expect.objectContaining({ method: 'POST', minVersion: 'TLSv1.2', rejectUnauthorized: true, key: config.key, cert: config.cert, headers: expect.objectContaining({ 'Content-Type': expect.stringContaining('application/soap+xml;') }) }), expect.any(Function))
    expect(request.end.mock.calls[0][0]).not.toContain(config.key)
    expect(request.end.mock.calls[0][0]).not.toContain(config.cert)
  })
  it.each([401, 403])('HTTP %s retorna erro de autenticação seguro', async status => {
    transporte(status)
    await expect(enviarSoap(config, '1'.repeat(44))).rejects.toMatchObject({ estado: 'autenticacao' })
    expect(https.request).toHaveBeenCalledTimes(1)
  })
  it.each([301, 429, 500, 503])('HTTP %s não redireciona nem repete', async status => {
    transporte(status)
    await expect(enviarSoap(config, '1'.repeat(44))).rejects.toMatchObject({ estado: 'temporario' })
    expect(https.request).toHaveBeenCalledTimes(1)
  })
  it('conexão interrompida é segura', async () => {
    transporte(200, '', 'ECONNRESET')
    await expect(enviarSoap(config, '1'.repeat(44))).rejects.toMatchObject({ estado: 'temporario', message: expect.not.stringContaining('SEGREDO') })
  })
  it.each(['ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'])('falha TLS %s distingue autenticação', async code => {
    transporte(200, '', code)
    await expect(enviarSoap(config, '1'.repeat(44))).rejects.toMatchObject({ estado: 'autenticacao', message: expect.not.stringContaining('SEGREDO') })
    expect(https.request).toHaveBeenCalledTimes(1)
  })
  it('timeout absoluto encerra sem retry', async () => {
    vi.useFakeTimers()
    const request = transporte()
    request.end.mockImplementationOnce(() => {})
    const pending = expect(enviarSoap(config, '1'.repeat(44))).rejects.toMatchObject({ estado: 'temporario' })
    await vi.advanceTimersByTimeAsync(25_001)
    await pending
    expect(request.destroy).toHaveBeenCalledTimes(1)
    expect(https.request).toHaveBeenCalledTimes(1)
  })
  it('limita corpo SOAP', async () => {
    transporte(200, 'x'.repeat(8 * 1024 * 1024 + 1))
    await expect(enviarSoap(config, '1'.repeat(44))).rejects.toMatchObject({ estado: 'temporario' })
  })
})
