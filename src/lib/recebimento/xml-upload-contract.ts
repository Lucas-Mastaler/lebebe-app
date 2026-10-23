export const XML_MAX_BYTES = 2 * 1024 * 1024
export const XML_MAX_FILES = 10

export type ResultadoXml = {
  file: string
  status: 'ok' | 'parcial' | 'erro'
  banco: 'cadastrada' | 'existente' | 'erro'
  drive: 'salvo' | 'existente' | 'pendente' | 'nao_enviado'
  numero_nf?: string
  nfe_id?: string
  error?: string
  error_code?: string
}
