import type { ResultadoXml } from './xml-upload-contract'

export type EstadoDfe = 'importada' | 'ja_cadastrada' | 'resumo' | 'manifestacao_necessaria' | 'indisponivel' | 'autenticacao' | 'limite' | 'temporario' | 'configuracao' | 'documento_invalido' | 'rejeitada'
export interface ResultadoDfe { estado: EstadoDfe; message: string; resultado?: ResultadoXml; retryAfter?: number }

export class DfeError extends Error {
  constructor(public readonly estado: EstadoDfe, message: string, public readonly httpStatus = 503, public readonly retryAfter?: number, public readonly codigo?: string) { super(message) }
}
