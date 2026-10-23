import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { salvarXmlDrive } from '@/lib/google/drive-xml'
import { xmlDeTeste } from '@/lib/recebimento/xml-upload.fixture'
import { XmlImportError } from '@/lib/recebimento/xml-upload'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/auth/module-access', () => ({ requireModuleAccess: vi.fn() }))
vi.mock('@/lib/google/drive-xml', async original => ({ ...await original<typeof import('@/lib/google/drive-xml')>(), salvarXmlDrive: vi.fn() }))

function request(files = [{ name: 'nota.xml', content: xmlDeTeste().xml }]) {
  const body = new FormData()
  for (const file of files) body.append('xml', new File([file.content], file.name))
  return new NextRequest('http://localhost/api/recebimento/importar-xml', { method: 'POST', body })
}
function banco() {
  const chain = {
    update: vi.fn(() => chain), eq: vi.fn(() => chain), is: vi.fn(() => chain), select: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: { xml_drive_file_id: 'drive-1' }, error: null })),
    then: (resolve: (result: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  }
  const client = { from: vi.fn((table: string) => { if (table !== 'nfe') throw new Error('Persistência fora da transação fiscal'); return chain }), rpc: vi.fn(async () => ({ data: { nfe_id: 'nfe-1', numero_nf: '371272', banco: 'cadastrada', drive_file_id: null }, error: null as null | { code: string; message: string } })) }
  vi.mocked(createClient).mockResolvedValue(client as never)
  return { client, chain }
}

describe('POST importar XML', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireModuleAccess).mockResolvedValue({ ok: true } as never)
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true })
    vi.mocked(salvarXmlDrive).mockResolvedValue({ fileId: 'drive-1', status: 'salvo' })
  })
  it('nega acesso ao módulo antes de ler arquivos ou gravar', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) })
    expect((await POST(request())).status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
    expect(salvarXmlDrive).not.toHaveBeenCalled()
  })
  it('nega usuário fora da autorização Matic', async () => {
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: false })
    expect((await POST(request())).status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
  })
  it('rejeita sessão ausente', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) })
    expect((await POST(request())).status).toBe(401)
  })
  it('grava via transação, incluindo n_item, antes do Drive', async () => {
    const { client } = banco()
    const body = await (await POST(request())).json()
    expect(body.results[0]).toMatchObject({ status: 'ok', banco: 'cadastrada', drive: 'salvo', numero_nf: '371272' })
    expect(client.rpc).toHaveBeenCalledWith('importar_xml_recebimento', expect.objectContaining({ p_nota: expect.objectContaining({ itens: expect.arrayContaining([expect.objectContaining({ n_item: 1, quantidade: 2, codigo_produto: '000123' })]) }), p_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }))
    expect(client.rpc.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(salvarXmlDrive).mock.invocationCallOrder[0])
    expect(client.from.mock.calls.every(([table]) => table === 'nfe')).toBe(true)
  })
  it('não declara sucesso integral quando o Drive falha', async () => {
    banco()
    vi.mocked(salvarXmlDrive).mockRejectedValueOnce(new XmlImportError('drive_falha', 'XML pendente no Drive.'))
    expect((await (await POST(request())).json()).results[0]).toMatchObject({ status: 'parcial', banco: 'cadastrada', drive: 'pendente', error: 'XML pendente no Drive.' })
  })
  it('repetição retorna existente sem recriar itens', async () => {
    const { client } = banco()
    client.rpc.mockResolvedValueOnce({ data: { nfe_id: 'nfe-1', numero_nf: '371272', banco: 'existente', drive_file_id: null }, error: null })
    expect((await (await POST(request())).json()).results[0].banco).toBe('existente')
  })
  it('conflito fiscal não envia XML ao Drive nem expõe erro interno', async () => {
    const { client } = banco()
    client.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'XML_CONFLITO_IDENTIDADE SEGREDO' } } as never)
    const body = await (await POST(request())).json()
    expect(body.results[0].status).toBe('erro')
    expect(JSON.stringify(body)).not.toContain('SEGREDO')
    expect(salvarXmlDrive).not.toHaveBeenCalled()
  })
  it('erro de item na transação não declara sucesso nem inicia Drive', async () => {
    const { client } = banco()
    client.rpc.mockResolvedValueOnce({ data: null, error: { code: '23502', message: 'item incompleto' } } as never)
    expect((await (await POST(request())).json()).results[0]).toMatchObject({ status: 'erro', banco: 'erro', drive: 'nao_enviado' })
    expect(salvarXmlDrive).not.toHaveBeenCalled()
  })
  it('valida extensão e conteúdo sem persistir', async () => {
    const { client } = banco()
    const body = await (await POST(request([{ name: 'nota.pdf', content: xmlDeTeste().xml }, { name: 'nota.xml', content: '<teste/>' }]))).json()
    expect(body.results.every((r: { status: string }) => r.status === 'erro')).toBe(true)
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('aceita lote com resultados independentes', async () => {
    const { client } = banco()
    const body = await (await POST(request([{ name: 'invalido.xml', content: '<teste/>' }, { name: 'valido.xml', content: xmlDeTeste().xml }]))).json()
    expect(body.results.map((r: { status: string }) => r.status)).toEqual(['erro', 'ok'])
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })
  it('reserva um único ID e confirma a reserva antes do upload', async () => {
    const { chain } = banco()
    vi.mocked(salvarXmlDrive).mockImplementationOnce(async input => {
      expect(await input.reservarId('drive-gerado')).toBe('drive-1')
      return { fileId: 'drive-1', status: 'salvo' }
    })
    await POST(request())
    expect(chain.update).toHaveBeenCalledWith({ xml_drive_file_id: 'drive-gerado' })
    expect(chain.is).toHaveBeenCalledWith('xml_drive_file_id', null)
  })
  it('rejeita entrada vazia, multipart inválido e quantidade excessiva', async () => {
    expect((await POST(request([]))).status).toBe(400)
    expect((await POST(request(Array.from({ length: 11 }, () => ({ name: 'nota.xml', content: '<teste/>' }))))).status).toBe(400)
    expect((await POST(new NextRequest('http://localhost/api/recebimento/importar-xml', { method: 'POST', body: 'invalido' }))).status).toBe(400)
  })
  it('rejeita tamanho excessivo', async () => {
    banco()
    expect((await (await POST(request([{ name: 'nota.xml', content: 'x'.repeat(2 * 1024 * 1024 + 1) }]))).json()).results[0].status).toBe('erro')
  })
})
