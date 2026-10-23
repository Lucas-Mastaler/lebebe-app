import { describe, expect, it, vi } from 'vitest'
import { salvarXmlDrive, sha256Xml, type criarClienteDriveXml } from './drive-xml'

const bytes = new TextEncoder().encode('<teste>XML original</teste>')
function cliente() {
  const armazenados = new Map<string, { bytes: Uint8Array; name: string }>()
  const files = {
    get: vi.fn(async (args: { fileId: string; alt?: string }) => {
      if (args.fileId === 'pasta') return { data: { mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } } }
      const file = armazenados.get(args.fileId)
      if (!file) throw { response: { status: 404 } }
      return { data: args.alt ? Buffer.from(file.bytes) : { id: args.fileId, parents: ['pasta'], size: String(file.bytes.length) } }
    }),
    list: vi.fn(async () => ({ data: { files: Array.from(armazenados.keys()).map(id => ({ id })), nextPageToken: undefined as string | undefined } })),
    generateIds: vi.fn(async () => ({ data: { ids: ['novo-id'] } })),
    create: vi.fn(async (args: { requestBody: { id: string; name: string }; media: { body: AsyncIterable<Buffer> } }) => {
      const chunks: Buffer[] = []
      for await (const chunk of args.media.body) chunks.push(chunk)
      armazenados.set(args.requestBody.id, { name: args.requestBody.name, bytes: Buffer.concat(chunks) })
      return { data: { id: args.requestBody.id } }
    }),
  }
  const drive = { files } as unknown as ReturnType<typeof criarClienteDriveXml>
  const reservarId = vi.fn(async (id: string) => id)
  return { armazenados, files, drive, input: { bytes, numeroNf: '371272', fileId: null, folderId: 'pasta', drive, reservarId }, reservarId }
}

describe('Drive de XML', () => {
  it('grava com número sem zeros e preserva todos os bytes', async () => {
    const c = cliente()
    expect(await salvarXmlDrive(c.input)).toEqual({ fileId: 'novo-id', status: 'salvo' })
    expect(c.armazenados.get('novo-id')).toEqual({ name: '371272.xml', bytes: Buffer.from(bytes) })
    expect(c.reservarId).toHaveBeenCalledWith('novo-id')
  })
  it('reutiliza arquivo existente inclusive após renomeação para FEITO', async () => {
    const c = cliente()
    c.armazenados.set('existente', { bytes, name: '371272 (FEITO).xml' })
    expect(await salvarXmlDrive(c.input)).toEqual({ fileId: 'existente', status: 'existente' })
    expect(c.files.create).not.toHaveBeenCalled()
    expect(c.files.list.mock.calls[0]).toBeDefined()
  })
  it('não sobrescreve conteúdo divergente', async () => {
    const c = cliente()
    c.armazenados.set('divergente', { bytes: new TextEncoder().encode('<outro/>'), name: '371272.xml' })
    await expect(salvarXmlDrive(c.input)).rejects.toMatchObject({ code: 'drive_conflito' })
    expect(c.files.create).not.toHaveBeenCalled()
    expect(c.reservarId).not.toHaveBeenCalled()
  })
  it('não gera outro identificador ao repetir envio com reserva persistida', async () => {
    const c = cliente()
    await salvarXmlDrive({ ...c.input, fileId: 'reservado' })
    await salvarXmlDrive({ ...c.input, fileId: 'reservado' })
    expect(c.files.generateIds).not.toHaveBeenCalled()
    expect(c.files.create).toHaveBeenCalledTimes(1)
  })
  it('usa a reserva vencedora de requisições concorrentes', async () => {
    const c = cliente()
    c.input.reservarId.mockResolvedValue('id-da-outra-requisicao')
    expect((await salvarXmlDrive(c.input)).fileId).toBe('id-da-outra-requisicao')
    expect(c.armazenados.size).toBe(1)
  })
  it('confirma arquivo criado mesmo quando a resposta do upload se perde', async () => {
    const c = cliente()
    c.files.create.mockImplementationOnce(async () => {
      c.armazenados.set('novo-id', { bytes, name: '371272.xml' })
      throw { response: { status: 503 } }
    })
    expect((await salvarXmlDrive(c.input)).status).toBe('salvo')
    expect(c.armazenados.size).toBe(1)
  })
  it('retorna pendência segura quando o upload falha', async () => {
    const c = cliente()
    c.files.create.mockRejectedValueOnce({ response: { status: 503 }, message: 'SEGREDO QUE NAO PODE APARECER' })
    await expect(salvarXmlDrive(c.input)).rejects.toMatchObject({ code: 'drive_falha' })
    try { await salvarXmlDrive({ ...c.input, folderId: '' }) } catch (e) { expect(String(e)).not.toContain('SEGREDO') }
  })
  it('não grava sem permissão na pasta', async () => {
    const c = cliente()
    c.files.get.mockResolvedValueOnce({ data: { mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: false } } })
    await expect(salvarXmlDrive(c.input)).rejects.toMatchObject({ code: 'drive_permissao' })
    expect(c.files.create).not.toHaveBeenCalled()
  })
  it('não grava se a reserva não puder ser persistida', async () => {
    const c = cliente()
    c.reservarId.mockRejectedValueOnce(new Error('db indisponivel'))
    await expect(salvarXmlDrive(c.input)).rejects.toThrow()
    expect(c.files.create).not.toHaveBeenCalled()
  })
  it('considera todas as páginas ao procurar conflitos', async () => {
    const c = cliente()
    c.files.list.mockResolvedValueOnce({ data: { files: [], nextPageToken: 'pagina2' } })
    await salvarXmlDrive(c.input)
    expect(c.files.list).toHaveBeenCalledTimes(2)
  })
  it('não segue arquivo reservado para outra pasta', async () => {
    const c = cliente()
    c.files.get.mockResolvedValueOnce({ data: { mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } } })
    c.files.get.mockResolvedValueOnce({ data: { parents: ['outra-pasta'] } } as never)
    await expect(salvarXmlDrive({ ...c.input, fileId: 'reservado' })).rejects.toMatchObject({ code: 'drive_conflito' })
  })
  it('hash é estável e distingue alterações no original', () => {
    expect(sha256Xml(bytes)).toHaveLength(64)
    expect(sha256Xml(bytes)).not.toBe(sha256Xml(new TextEncoder().encode('<teste/>')))
  })
})
