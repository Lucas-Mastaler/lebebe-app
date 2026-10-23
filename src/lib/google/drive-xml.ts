import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { XmlImportError, XML_MAX_BYTES } from '@/lib/recebimento/xml-upload'

export function criarClienteDriveXml() {
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN } = process.env
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) {
    throw new XmlImportError('drive_configuracao', 'A nota foi cadastrada, mas falta configurar o acesso ao Drive.')
  }
  const auth = new OAuth2Client(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET)
  auth.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN })
  return google.drive({ version: 'v3', auth })
}

export function sha256Xml(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex') }

type Drive = ReturnType<typeof criarClienteDriveXml>
type UploadXml = {
  bytes: Uint8Array
  numeroNf: string
  fileId: string | null
  reservarId: (id: string) => Promise<string>
  folderId?: string
  drive?: Drive
}

function statusGoogle(error: unknown): number | undefined {
  if (typeof error !== 'object' || !error) return undefined
  const response = 'response' in error ? error.response : null
  if (typeof response === 'object' && response && 'status' in response) return Number(response.status)
  return undefined
}

// Os bytes não são reserializados: o arquivo enviado é o XML original.
export async function salvarXmlDrive(input: UploadXml): Promise<{ fileId: string; status: 'salvo' | 'existente' }> {
  const folderId = input.folderId ?? process.env.GOOGLE_DRIVE_RECEBIMENTO_XML_FOLDER_ID
  if (!folderId) throw new XmlImportError('drive_configuracao', 'A nota foi cadastrada, mas falta configurar a pasta de XML no Drive.')
  const drive = input.drive ?? criarClienteDriveXml()
  const nome = `${input.numeroNf}.xml`
  const hash = sha256Xml(input.bytes)
  const options = { timeout: 15000, retry: false } as const
  const verificar = async (id: string) => {
    const { data } = await drive.files.get({ fileId: id, fields: 'id,parents,trashed,size', supportsAllDrives: true }, options)
    if (data.trashed || !data.parents?.includes(folderId) || Number(data.size) > XML_MAX_BYTES) {
      throw new XmlImportError('drive_conflito', 'O arquivo existente no Drive não corresponde ao destino esperado. Solicite conferência.')
    }
    const content = await drive.files.get({ fileId: id, alt: 'media', supportsAllDrives: true }, { ...options, responseType: 'arraybuffer' })
    if (sha256Xml(Buffer.from(content.data as unknown as ArrayBuffer)) !== hash) {
      throw new XmlImportError('drive_conflito', 'Já existe um XML diferente para essa nota no Drive. Nenhum arquivo foi substituído.')
    }
  }
  try {
    const { data: folder } = await drive.files.get({ fileId: folderId, fields: 'mimeType,trashed,capabilities(canAddChildren)', supportsAllDrives: true }, options)
    if (folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder' || !folder.capabilities?.canAddChildren) {
      throw new XmlImportError('drive_permissao', 'A nota foi cadastrada, mas não há permissão para gravar na pasta do Drive.')
    }
    let id = input.fileId
    if (!id) {
      let pageToken: string | undefined
      const encontrados: string[] = []
      do {
        const { data } = await drive.files.list({
          q: `'${folderId.replace(/['\\]/g, '\\$&')}' in parents and trashed = false and (name = '${nome}' or name = '${input.numeroNf} (FEITO).xml')`,
          fields: 'nextPageToken,files(id)', pageSize: 100, pageToken, supportsAllDrives: true, includeItemsFromAllDrives: true,
        }, options)
        for (const file of data.files ?? []) if (file.id) encontrados.push(file.id)
        pageToken = data.nextPageToken ?? undefined
      } while (pageToken)
      for (const existente of encontrados) await verificar(existente)
      if (encontrados.length) id = await input.reservarId(encontrados[0])
      else {
        const { data } = await drive.files.generateIds({ count: 1, space: 'drive', type: 'files' }, options)
        if (!data.ids?.[0]) throw new XmlImportError('drive_falha', 'Não foi possível preparar o arquivo no Drive. Tente novamente.')
        id = await input.reservarId(data.ids[0])
      }
    }
    // Mesmo após timeout ou envio concorrente, o identificador reservado é único.
    try {
      await verificar(id)
      return { fileId: id, status: 'existente' }
    } catch (error) { if (statusGoogle(error) !== 404) throw error }
    try {
      await drive.files.create({
        requestBody: { id, name: nome, parents: [folderId] },
        media: { mimeType: 'application/xml', body: Readable.from([Buffer.from(input.bytes)]) },
        fields: 'id', supportsAllDrives: true,
      }, options)
    } catch (error) {
      // 409: outro envio criou o mesmo ID. Outros erros podem ser respostas perdidas.
      try { await verificar(id) } catch { throw error }
    }
    await verificar(id)
    return { fileId: id, status: 'salvo' }
  } catch (error) {
    if (error instanceof XmlImportError) throw error
    const status = statusGoogle(error)
    throw new XmlImportError(status === 401 || status === 403 ? 'drive_permissao' : 'drive_falha',
      status === 401 || status === 403
        ? 'A nota foi cadastrada, mas o acesso ao Drive precisa ser verificado. Envie o mesmo XML após corrigir o acesso.'
        : 'A nota foi cadastrada, mas o XML está pendente no Drive. Envie o mesmo arquivo para tentar novamente.')
  }
}
