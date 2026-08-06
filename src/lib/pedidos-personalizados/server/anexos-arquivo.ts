export const BUCKET_ANEXOS_PEDIDOS = 'pedidos-personalizados-anexos'
export const LIMITE_ANEXO_BYTES = 10_485_760
export const EXPIRACAO_URL_ASSINADA_SEGUNDOS = 300
export const LIMITE_MULTIPART_BYTES = LIMITE_ANEXO_BYTES + 262_144

export type ArquivoAnexoValidado = {
  bytes: ArrayBuffer
  nomeOriginal: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
  extensao: 'jpg' | 'png' | 'webp' | 'pdf'
  tamanhoBytes: number
}

export class ErroArquivoAnexo extends Error {
  constructor(
    readonly codigo: string,
    readonly status: 413 | 415 | 422
  ) {
    super(codigo)
  }
}

function comecaCom(bytes: Uint8Array, assinatura: readonly number[]) {
  return assinatura.every((valor, indice) => bytes[indice] === valor)
}

export function detectarTipoArquivo(bytes: Uint8Array): Pick<ArquivoAnexoValidado, 'mimeType' | 'extensao'> | null {
  if (bytes.length >= 3 && comecaCom(bytes, [0xff, 0xd8, 0xff])) {
    return { mimeType: 'image/jpeg', extensao: 'jpg' }
  }
  if (bytes.length >= 8 && comecaCom(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: 'image/png', extensao: 'png' }
  }
  if (
    bytes.length >= 12 &&
    comecaCom(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extensao: 'webp' }
  }
  if (bytes.length >= 5 && comecaCom(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mimeType: 'application/pdf', extensao: 'pdf' }
  }
  return null
}

export async function validarArquivoAnexo(file: File): Promise<ArquivoAnexoValidado> {
  const nomeOriginal = file.name.normalize('NFC').trim()
  if (!nomeOriginal || nomeOriginal.length > 255 || /[\\/]/.test(nomeOriginal)) {
    throw new ErroArquivoAnexo('NOME_ARQUIVO_INVALIDO', 422)
  }
  if (file.size === 0) throw new ErroArquivoAnexo('ARQUIVO_VAZIO', 422)
  if (file.size > LIMITE_ANEXO_BYTES) throw new ErroArquivoAnexo('ARQUIVO_MUITO_GRANDE', 413)

  const bytes = await file.arrayBuffer()
  const tipo = detectarTipoArquivo(new Uint8Array(bytes))
  if (!tipo) throw new ErroArquivoAnexo('TIPO_ARQUIVO_NAO_SUPORTADO', 415)
  if (file.type !== tipo.mimeType) throw new ErroArquivoAnexo('MIME_DIVERGENTE', 422)

  return { bytes, nomeOriginal, tamanhoBytes: file.size, ...tipo }
}

export function gerarCaminhoAnexo(params: {
  pedidoId: string
  tapeteId: string
  anexoId: string
  arquivoId?: string
  extensao: ArquivoAnexoValidado['extensao']
}) {
  const arquivoId = params.arquivoId ?? crypto.randomUUID()
  return `${params.pedidoId}/${params.tapeteId}/${params.anexoId}/${arquivoId}.${params.extensao}`
}

export async function lerMultipartAnexo(request: Request, exigirSlot: boolean) {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    throw new ErroArquivoAnexo('CONTENT_TYPE_INVALIDO', 422)
  }
  const tamanhoDeclarado = Number(request.headers.get('content-length'))
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > LIMITE_MULTIPART_BYTES) {
    throw new ErroArquivoAnexo('ARQUIVO_MUITO_GRANDE', 413)
  }

  const reader = request.body?.getReader()
  if (!reader) throw new ErroArquivoAnexo('PAYLOAD_INVALIDO', 422)
  const partes: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > LIMITE_MULTIPART_BYTES) {
      await reader.cancel()
      throw new ErroArquivoAnexo('ARQUIVO_MUITO_GRANDE', 413)
    }
    partes.push(value)
  }
  const corpo = new Uint8Array(total)
  let offset = 0
  for (const parte of partes) {
    corpo.set(parte, offset)
    offset += parte.byteLength
  }
  const form = await new Response(corpo, { headers: { 'content-type': contentType } }).formData()
  const arquivos = form.getAll('arquivo')
  if (arquivos.length !== 1 || !(arquivos[0] instanceof File)) {
    throw new ErroArquivoAnexo('ARQUIVO_INVALIDO', 422)
  }
  const expectedVersion = Number(form.get('expectedVersion'))
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new ErroArquivoAnexo('EXPECTED_VERSION_INVALIDA', 422)
  }
  const slot = exigirSlot ? Number(form.get('slot')) : undefined
  if (exigirSlot && slot !== 1 && slot !== 2) throw new ErroArquivoAnexo('SLOT_INVALIDO', 422)

  return {
    expectedVersion,
    slot,
    arquivo: await validarArquivoAnexo(arquivos[0]),
  }
}
