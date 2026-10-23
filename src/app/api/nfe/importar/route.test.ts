import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { xmlDeTeste } from '@/lib/recebimento/xml-upload.fixture'

vi.mock('googleapis', () => ({ google: { gmail: vi.fn() } }))
vi.mock('google-auth-library', () => ({ JWT: class {} }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/recebimento/email-retry', async original => {
  const real = await original<typeof import('@/lib/recebimento/email-retry')>()
  return { ...real, lerEmailComRepeticao: (ler: () => Promise<unknown>) => real.lerEmailComRepeticao(ler, async () => {}) }
})
const fixture = xmlDeTeste()
function request() { return new NextRequest('http://localhost/api/nfe/importar', { method: 'POST', body: JSON.stringify({ inicio: '2026-10-01', fim: '2026-10-23' }) }) }
function setup(cached = false) {
  const gmail = { users: { messages: {
    list: vi.fn().mockResolvedValue({ data: { messages: [{ id: 'm1' }] } }),
    get: vi.fn().mockResolvedValue({ data: { payload: { parts: [{ filename: 'nota.xml', body: { attachmentId: 'a1' } }] } } }),
    attachments: { get: vi.fn().mockResolvedValue({ data: { data: Buffer.from(fixture.xml).toString('base64url') } }) },
  } } }
  const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn().mockResolvedValue({ data: cached ? { nfe_id: 'nfe-1' } : null, error: null }) }
  const rpc = vi.fn().mockResolvedValue({ data: { nfe_id: 'nfe-1', banco: 'cadastrada' }, error: null })
  const from = vi.fn((table: string) => { if (table !== 'nfe_email_anexos') throw new Error('Escrita direta proibida'); return chain })
  vi.mocked(google.gmail).mockReturnValue(gmail as never)
  vi.mocked(createClient).mockResolvedValue({ from, rpc } as never)
  return { gmail, rpc, chain, from }
}
describe('Gmail incremental, sem reimportar anexo concluído', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GMAIL_SERVICE_EMAIL', 'servico@teste.invalid')
    vi.stubEnv('GMAIL_PRIVATE_KEY', 'ficticia')
    vi.stubEnv('GMAIL_IMPERSONATE_USER', 'caixa@teste.invalid')
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true })
  })
  it('mantém o filtro e importa em uma transação, sem deletar notas ou itens', async () => {
    const { gmail, rpc } = setup()
    const body = await (await POST(request())).json()
    expect(body).toMatchObject({ ok: true, total_salvas: 1, total_ignorados: 0, erros: [] })
    expect(gmail.users.messages.list.mock.calls[0][0].q).toBe('from:nfe@maticmoveis.com.br subject:"Nota Fiscal Eletronica" after:2026/10/01 before:2026/10/24 has:attachment')
    expect(rpc).toHaveBeenCalledWith('importar_anexo_email_recebimento', expect.objectContaining({ p_origem_sha256: expect.stringMatching(/^[a-f0-9]{64}$/), p_nota: expect.objectContaining({ chave_acesso: fixture.chave }) }))
    expect(body.nfs[0].itens[0].codigo_produto).toBe('000123')
  })
  it('anexo já concluído não baixa, não parseia e não chama RPC', async () => {
    const { gmail, rpc } = setup(true)
    expect(await (await POST(request())).json()).toMatchObject({ total_ignorados: 1, total_salvas: 0 })
    expect(gmail.users.messages.attachments.get).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('repete só a listagem temporária, até três chamadas', async () => {
    const { gmail, rpc } = setup()
    gmail.users.messages.list.mockReset().mockRejectedValueOnce({ response: { status: 503 } }).mockRejectedValueOnce({ code: 'ETIMEDOUT' }).mockResolvedValue({ data: { messages: [{ id: 'm1' }] } })
    expect((await POST(request())).status).toBe(200)
    expect(gmail.users.messages.list).toHaveBeenCalledTimes(3)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('repete apenas o download que falhou, não a gravação', async () => {
    const { gmail, rpc } = setup()
    gmail.users.messages.attachments.get.mockRejectedValueOnce({ response: { status: 500 } })
    expect((await (await POST(request())).json()).total_salvas).toBe(1)
    expect(gmail.users.messages.list).toHaveBeenCalledTimes(1)
    expect(gmail.users.messages.attachments.get).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('falha definitiva no Gmail para após três tentativas', async () => {
    const { gmail, rpc } = setup()
    gmail.users.messages.list.mockRejectedValue({ response: { status: 503 } })
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(gmail.users.messages.list).toHaveBeenCalledTimes(3)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('sem acesso ao Gmail não repete nem expõe detalhes', async () => {
    const { gmail } = setup()
    gmail.users.messages.list.mockRejectedValue({ response: { status: 401 }, message: 'SEGREDO' })
    const response = await POST(request())
    expect(gmail.users.messages.list).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(await response.json())).not.toContain('SEGREDO')
  })
  it('falha no controle não baixa XML nem faz cadastro sem comprovante', async () => {
    const { gmail, rpc, chain } = setup()
    chain.maybeSingle.mockResolvedValue({ data: null, error: { code: '42P01' } })
    expect((await (await POST(request())).json()).erros).toHaveLength(1)
    expect(gmail.users.messages.attachments.get).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('anexo falho não prejudica outro anexo nem ganha comprovante', async () => {
    const { gmail, rpc } = setup()
    gmail.users.messages.get.mockResolvedValue({ data: { payload: { parts: [{ filename: 'erro.xml', body: { attachmentId: 'a0' } }, { filename: 'certo.xml', body: { attachmentId: 'a1' } }] } } })
    gmail.users.messages.attachments.get.mockResolvedValueOnce({ data: { data: Buffer.from('<invalido/>').toString('base64url') } })
    const body = await (await POST(request())).json()
    expect(body.total_salvas).toBe(1)
    expect(body.erros).toHaveLength(1)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('falha no banco não repete importação automaticamente', async () => {
    const { rpc } = setup()
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'XML_CONFLITO' } })
    expect((await (await POST(request())).json()).erros).toHaveLength(1)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('preserva caixa alternativa somente quando a principal não tem mensagens', async () => {
    const { gmail } = setup()
    gmail.users.messages.list.mockResolvedValueOnce({ data: { messages: [] } })
    expect((await (await POST(request())).json()).total_salvas).toBe(1)
    expect(google.gmail).toHaveBeenCalledTimes(2)
  })
  it('não inicia Gmail quando usuário não é autorizado', async () => {
    setup()
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: false })
    expect((await POST(request())).status).toBe(403)
    expect(google.gmail).not.toHaveBeenCalled()
  })
})
