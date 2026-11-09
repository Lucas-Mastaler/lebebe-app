import {
  ErroArquivoAnexo,
  LIMITE_ANEXO_BYTES,
  validarArquivoAnexo,
  type ArquivoAnexoValidado,
} from '@/lib/pedidos-personalizados/server/anexos-arquivo'
import { dataIsoValida } from './vigencia'

export const BUCKET_PROMOCOES_MES = 'promocoes-mes'
export const EXPIRACAO_URL_PROMOCAO_SEGUNDOS = 900
export const MAX_ARQUIVOS_PROMOCAO = 10
export const LIMITE_TOTAL_MULTIPART_BYTES = LIMITE_ANEXO_BYTES * 5 + 1_048_576
export const TITULO_MAX = 120

export class ErroFormularioPromocao extends Error {
  constructor(readonly codigo: string, readonly status: 413 | 415 | 422, readonly mensagem: string) {
    super(codigo)
  }
}

export type FormularioPromocao = {
  titulo: string
  inicio: string
  fim: string
  arquivos: ArquivoAnexoValidado[]
  remover: string[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validarCamposPromocao(titulo: unknown, inicio: unknown, fim: unknown) {
  const tituloLimpo = typeof titulo === 'string' ? titulo.normalize('NFC').trim() : ''
  if (!tituloLimpo) throw new ErroFormularioPromocao('TITULO_OBRIGATORIO', 422, 'Informe o título.')
  if (tituloLimpo.length > TITULO_MAX) throw new ErroFormularioPromocao('TITULO_LONGO', 422, `O título aceita até ${TITULO_MAX} caracteres.`)
  if (!dataIsoValida(inicio)) throw new ErroFormularioPromocao('INICIO_INVALIDO', 422, 'Data de início inválida.')
  if (!dataIsoValida(fim)) throw new ErroFormularioPromocao('FIM_INVALIDO', 422, 'Data de fim inválida.')
  if (fim < inicio) throw new ErroFormularioPromocao('PERIODO_INVALIDO', 422, 'A data final não pode ser anterior à inicial.')
  return { titulo: tituloLimpo, inicio, fim }
}

async function lerCorpoLimitado(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    throw new ErroFormularioPromocao('CONTENT_TYPE_INVALIDO', 422, 'Requisição inválida.')
  }
  const declarado = Number(request.headers.get('content-length'))
  if (Number.isFinite(declarado) && declarado > LIMITE_TOTAL_MULTIPART_BYTES) {
    throw new ErroFormularioPromocao('PAYLOAD_GRANDE', 413, 'Os arquivos somam mais de 50 MB.')
  }
  const reader = request.body?.getReader()
  if (!reader) throw new ErroFormularioPromocao('PAYLOAD_INVALIDO', 422, 'Requisição inválida.')
  const partes: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > LIMITE_TOTAL_MULTIPART_BYTES) {
      await reader.cancel()
      throw new ErroFormularioPromocao('PAYLOAD_GRANDE', 413, 'Os arquivos somam mais de 50 MB.')
    }
    partes.push(value)
  }
  const corpo = new Uint8Array(total)
  let offset = 0
  for (const parte of partes) { corpo.set(parte, offset); offset += parte.byteLength }
  return new Response(corpo, { headers: { 'content-type': contentType } }).formData()
}

export async function lerFormularioPromocao(request: Request): Promise<FormularioPromocao> {
  let form: FormData
  try {
    form = await lerCorpoLimitado(request)
  } catch (erro) {
    if (erro instanceof ErroFormularioPromocao) throw erro
    throw new ErroFormularioPromocao('PAYLOAD_INVALIDO', 422, 'Requisição inválida.')
  }
  const campos = validarCamposPromocao(form.get('titulo'), form.get('inicio'), form.get('fim'))
  const brutos = form.getAll('arquivos')
  if (brutos.length > MAX_ARQUIVOS_PROMOCAO) {
    throw new ErroFormularioPromocao('ARQUIVOS_DEMAIS', 422, `Envie até ${MAX_ARQUIVOS_PROMOCAO} arquivos.`)
  }
  const arquivos: ArquivoAnexoValidado[] = []
  for (const bruto of brutos) {
    if (!(bruto instanceof File)) throw new ErroFormularioPromocao('ARQUIVO_INVALIDO', 422, 'Arquivo inválido.')
    try {
      arquivos.push(await validarArquivoAnexo(bruto))
    } catch (erro) {
      if (erro instanceof ErroArquivoAnexo) {
        throw new ErroFormularioPromocao(erro.codigo, erro.status, mensagemArquivo(erro.codigo, bruto.name))
      }
      throw erro
    }
  }
  const remover = form.getAll('remover').map(String)
  if (remover.some((id) => !UUID.test(id))) throw new ErroFormularioPromocao('REMOVER_INVALIDO', 422, 'Requisição inválida.')
  return { ...campos, arquivos, remover: [...new Set(remover)] }
}

function mensagemArquivo(codigo: string, nome: string) {
  switch (codigo) {
    case 'ARQUIVO_MUITO_GRANDE': return `"${nome}" excede 10 MB.`
    case 'TIPO_ARQUIVO_NAO_SUPORTADO': return `"${nome}" não é PDF, JPG, PNG ou WebP.`
    case 'ARQUIVO_VAZIO': return `"${nome}" está vazio.`
    default: return `"${nome}" não pôde ser aceito.`
  }
}
