import { expect, it } from 'vitest'
import { criarClienteDriveXml, salvarXmlDrive } from './drive-xml'
import { xmlDeTeste } from '@/lib/recebimento/xml-upload.fixture'

// Opt-in explícito: cria somente subpasta isolada; nunca envia XML à raiz operacional.
it.skipIf(process.env.TESTAR_DRIVE_XML !== '1')('Drive real: grava, verifica bytes, repete e reconhece FEITO sem duplicar', async () => {
  const drive = criarClienteDriveXml()
  const parent = process.env.GOOGLE_DRIVE_RECEBIMENTO_XML_FOLDER_ID
  if (!parent) throw new Error('Configure a pasta operacional antes do teste isolado.')
  const folder = await drive.files.create({ requestBody: { name: `TESTE UPLOAD XML ${new Date().toISOString().replace(/[:.]/g, '-')}`, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }, fields: 'id' })
  const folderId = folder.data.id!
  const bytes = xmlDeTeste().bytes
  let fileId: string | null = null
  const reservarId = async (id: string) => { fileId ??= id; return fileId }
  try {
    const input = { bytes, numeroNf: '371272', folderId, drive, reservarId }
    const first = await salvarXmlDrive({ ...input, fileId })
    expect(first.status).toBe('salvo')
    expect(await salvarXmlDrive({ ...input, fileId })).toEqual({ fileId, status: 'existente' })
    await drive.files.update({ fileId: fileId!, requestBody: { name: '371272 (FEITO).xml' } })
    expect((await salvarXmlDrive({ ...input, fileId: null })).status).toBe('existente')
    const list = await drive.files.list({ q: `'${folderId}' in parents and trashed=false`, fields: 'files(id)' })
    expect(list.data.files).toHaveLength(1)
    const original = await drive.files.get({ fileId: fileId!, alt: 'media' }, { responseType: 'arraybuffer' })
    expect(Buffer.from(original.data as unknown as ArrayBuffer)).toEqual(Buffer.from(bytes))
  } finally {
    if (fileId) await drive.files.update({ fileId, requestBody: { trashed: true } })
    await drive.files.update({ fileId: folderId, requestBody: { trashed: true } })
  }
}, 120000)
