import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { carregarConfigDfe } from '@/lib/recebimento/dfe-config'
import { reservarConsulta } from '@/lib/recebimento/dfe-limites'
import { enviarSoap } from '@/lib/recebimento/dfe-soap'
import { salvarXmlDrive } from '@/lib/google/drive-xml'
import { CNPJ_DFE_TESTE, soapDeTeste, xmlDfeDeTeste } from '@/lib/recebimento/dfe.fixture'
import { DfeError } from '@/lib/recebimento/dfe-contract'
import { XmlImportError } from '@/lib/recebimento/xml-upload'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/auth/module-access', () => ({ requireModuleAccess: vi.fn() }))
vi.mock('@/lib/recebimento/dfe-config', () => ({ carregarConfigDfe: vi.fn() }))
vi.mock('@/lib/recebimento/dfe-limites', () => ({ reservarConsulta: vi.fn() }))
vi.mock('@/lib/recebimento/dfe-soap', async original => ({ ...await original<typeof import('@/lib/recebimento/dfe-soap')>(), enviarSoap: vi.fn() }))
vi.mock('@/lib/google/drive-xml', async original => ({ ...await original<typeof import('@/lib/google/drive-xml')>(), salvarXmlDrive: vi.fn() }))

const fixture = xmlDfeDeTeste()
const finalizar = vi.fn(async () => {})
function request(chave: unknown = fixture.chave) { return new NextRequest('http://localhost/api/recebimento/consultar-chave', { method: 'POST', body: JSON.stringify({ chave }) }) }
function banco(existente: object | null = null) {
  const chain = {
    update: vi.fn(() => chain), eq: vi.fn(() => chain), is: vi.fn(() => chain), select: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: existente, error: null as object | null })),
    single: vi.fn(async () => ({ data: { xml_drive_file_id: 'drive-1' }, error: null })),
    then: (resolve: (result: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  }
  const client = { from: vi.fn(() => chain), rpc: vi.fn(async () => ({ data: { nfe_id: 'nfe-1', numero_nf: '371272', banco: 'cadastrada', drive_file_id: null }, error: null as object | null })) }
  vi.mocked(createClient).mockResolvedValue(client as never)
  return { chain, client }
}
describe('consulta por chave integra o importador da etapa 1', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireModuleAccess).mockResolvedValue({ ok: true } as never)
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true })
    vi.mocked(carregarConfigDfe).mockReturnValue({ cnpj: CNPJ_DFE_TESTE, uf: '35', ambiente: '2', key: 'NUNCA RETORNAR', cert: 'NUNCA RETORNAR' })
    vi.mocked(reservarConsulta).mockResolvedValue({ finalizar })
    finalizar.mockResolvedValue(undefined)
    vi.mocked(enviarSoap).mockResolvedValue(soapDeTeste())
    vi.mocked(salvarXmlDrive).mockResolvedValue({ fileId: 'drive-1', status: 'salvo' })
  })
  it.each([401, 403])('respeita acesso ao módulo %s', async status => {
    vi.mocked(requireModuleAccess).mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Acesso negado' }, { status }) })
    expect((await POST(request())).status).toBe(status)
    expect(createClient).not.toHaveBeenCalled()
    expect(enviarSoap).not.toHaveBeenCalled()
  })
  it('não amplia autorização Matic', async () => {
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: false })
    expect((await POST(request())).status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
  })
  it.each(['123', 'a'.repeat(44), null, '0'.repeat(43) + '1'])('valida backend %s sem consumir cota', async chave => {
    expect((await POST(request(chave))).status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
    expect(reservarConsulta).not.toHaveBeenCalled()
  })
  it('rejeita JSON inválido e corpo excessivo sem Content-Length', async () => {
    for (const body of ['{', 'x'.repeat(1025)]) expect((await POST(new NextRequest('http://localhost/api', { method: 'POST', body }))).status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
  })
  it('chave cadastrada e Drive salvo não consulta nem exige A1', async () => {
    banco({ id: 'nfe-1', numero_nf: '371272', xml_sha256: 'a'.repeat(64), xml_drive_status: 'salvo' })
    const body = await (await POST(request())).json()
    expect(body).toMatchObject({ estado: 'ja_cadastrada', resultado: { status: 'ok', banco: 'existente', drive: 'existente' } })
    expect(carregarConfigDfe).not.toHaveBeenCalled()
    expect(enviarSoap).not.toHaveBeenCalled()
    expect(salvarXmlDrive).not.toHaveBeenCalled()
  })
  it('persiste pela mesma transação e envia bytes exatos ao Drive', async () => {
    const { client, chain } = banco()
    const response = await POST(request(` ${fixture.chave.slice(0, 20)} ${fixture.chave.slice(20)} `))
    const body = await response.json()
    expect(body).toMatchObject({ estado: 'importada', resultado: { status: 'ok', banco: 'cadastrada', drive: 'salvo' } })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(client.rpc).toHaveBeenCalledWith('importar_xml_recebimento', expect.objectContaining({ p_nota: expect.objectContaining({ chave_acesso: fixture.chave, itens: expect.arrayContaining([expect.objectContaining({ codigo_produto: '000123', quantidade: 2 })]) }), p_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }))
    const input = vi.mocked(salvarXmlDrive).mock.calls[0][0]
    expect(Buffer.from(input.bytes).equals(fixture.bytes)).toBe(true)
    expect(input.numeroNf).toBe('371272')
    expect(await input.reservarId('novo-id')).toBe('drive-1')
    expect(chain.update).toHaveBeenCalledWith({ xml_drive_status: 'salvo' })
    expect(client.rpc.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(salvarXmlDrive).mock.invocationCallOrder[0])
    expect(JSON.stringify(body)).not.toContain('NUNCA RETORNAR')
    expect(finalizar).toHaveBeenCalledWith(0, 60)
  })
  it('pendência no Drive justifica recuperar XML, sem duplicar nota', async () => {
    const { client } = banco({ id: 'nfe-1', numero_nf: '371272', xml_sha256: 'a'.repeat(64), xml_drive_status: 'pendente' })
    client.rpc.mockResolvedValueOnce({ data: { nfe_id: 'nfe-1', numero_nf: '371272', banco: 'existente', drive_file_id: 'drive-1' }, error: null } as never)
    expect((await (await POST(request())).json()).resultado.banco).toBe('existente')
    expect(enviarSoap).toHaveBeenCalledTimes(1)
  })
  it('falha na leitura do banco impede consulta externa', async () => {
    const { chain } = banco()
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'SEGREDO' } })
    expect((await POST(request())).status).toBe(503)
    expect(enviarSoap).not.toHaveBeenCalled()
  })
  it('certificado ausente impede reserva e consulta', async () => {
    banco()
    vi.mocked(carregarConfigDfe).mockImplementationOnce(() => { throw new DfeError('configuracao', 'Configure o A1.') })
    expect((await (await POST(request())).json()).estado).toBe('configuracao')
    expect(reservarConsulta).not.toHaveBeenCalled()
    expect(enviarSoap).not.toHaveBeenCalled()
  })
  it('concorrência/limite não inicia SOAP', async () => {
    banco()
    vi.mocked(reservarConsulta).mockRejectedValueOnce(new DfeError('limite', 'Aguarde.', 429, 10))
    const response = await POST(request())
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('10')
    expect(enviarSoap).not.toHaveBeenCalled()
  })
  it.each(['137', '656', '108', '280', '641'])('retorno %s não grava e não repete SOAP', async codigo => {
    const { client } = banco()
    vi.mocked(enviarSoap).mockResolvedValueOnce(soapDeTeste(codigo))
    const body = await (await POST(request())).json()
    expect(body.estado).not.toBe('importada')
    expect(JSON.stringify(body)).not.toContain('MENSAGEM INTERNA')
    expect(client.rpc).not.toHaveBeenCalled()
    expect(salvarXmlDrive).not.toHaveBeenCalled()
    expect(enviarSoap).toHaveBeenCalledTimes(1)
    expect(finalizar).toHaveBeenCalledWith(codigo === '656' ? 3600 : 0, codigo === '656' || codigo === '137' ? 3600 : 60)
  })
  it('resumo não vai para banco ou Drive; nenhum evento é enviado', async () => {
    const { client } = banco()
    vi.mocked(enviarSoap).mockResolvedValueOnce(soapDeTeste('138', [{ schema: 'resNFe_v1.01.xsd', xml: `<resNFe><chNFe>${fixture.chave}</chNFe></resNFe>` }]))
    const body = await (await POST(request())).json()
    expect(body.estado).toBe('resumo')
    expect(body.message).toContain('Nenhuma manifestação foi feita')
    expect(client.rpc).not.toHaveBeenCalled()
    expect(salvarXmlDrive).not.toHaveBeenCalled()
    expect(enviarSoap).toHaveBeenCalledTimes(1)
  })
  it.each([
    ['chave', fixture.xml.replaceAll(fixture.chave, '0'.repeat(44))],
    ['destinatário', fixture.xml.replace(CNPJ_DFE_TESTE, '99999999000199')],
    ['ambiente', fixture.xml.replaceAll('<tpAmb>2', '<tpAmb>1')],
  ])('XML com %s divergente não é persistido', async (_, xml) => {
    const { client } = banco()
    vi.mocked(enviarSoap).mockResolvedValueOnce(soapDeTeste('138', [{ schema: 'procNFe_v4.00.xsd', xml }]))
    expect((await POST(request())).status).toBe(422)
    expect(client.rpc).not.toHaveBeenCalled()
    expect(salvarXmlDrive).not.toHaveBeenCalled()
  })
  it('conflito fiscal não sobrescreve nem inicia Drive', async () => {
    const { client } = banco()
    client.rpc.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'XML_CONFLITO' } } as never)
    expect((await POST(request())).status).toBe(422)
    expect(salvarXmlDrive).not.toHaveBeenCalled()
  })
  it('Drive falho mantém nota disponível e pendência explícita', async () => {
    banco()
    vi.mocked(salvarXmlDrive).mockRejectedValueOnce(new XmlImportError('drive_falha', 'Não foi possível salvar no Drive.'))
    expect(await (await POST(request())).json()).toMatchObject({ estado: 'importada', resultado: { status: 'parcial', banco: 'cadastrada', drive: 'pendente' } })
  })
  it('confirmação pendente no banco permite repetir a chave sem exigir download manual', async () => {
    banco()
    vi.mocked(salvarXmlDrive).mockRejectedValueOnce(new XmlImportError('drive_confirmacao', 'Envie o mesmo XML novamente.'))
    const body = await (await POST(request())).json()
    expect(body.resultado.status).toBe('parcial')
    expect(body.resultado.error).toContain('Consulte a mesma chave novamente')
    expect(body.resultado.error).not.toContain('Envie o mesmo XML')
  })
  it('falha de rede não repete nem vaza XML e credenciais', async () => {
    const { client } = banco()
    vi.mocked(enviarSoap).mockRejectedValueOnce(new Error('SENHA XML CERTIFICADO'))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('SENHA')
    expect(client.rpc).not.toHaveBeenCalled()
    expect(enviarSoap).toHaveBeenCalledTimes(1)
    expect(finalizar).toHaveBeenCalledTimes(1)
  })
  it('falha no guard após sucesso não anuncia pendência inexistente no Drive', async () => {
    banco()
    finalizar.mockRejectedValueOnce(new Error('redis'))
    expect(await (await POST(request())).json()).toMatchObject({ resultado: { status: 'ok', drive: 'salvo' }, retryAfter: 3600 })
  })
})
