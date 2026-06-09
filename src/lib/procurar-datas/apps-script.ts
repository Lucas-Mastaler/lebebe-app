import { executarAppsScript } from '@/lib/google/apps-script'
import type { AppsScriptProcurarDatasFunction } from './types'

const DEFAULT_TIMEOUT_MS = 120_000

export class AppsScriptTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Tempo limite excedido ao chamar Apps Script (${Math.round(timeoutMs / 1000)}s).`)
    this.name = 'AppsScriptTimeoutError'
  }
}

export async function chamarAppsScriptProcurarDatas<T>(
  nomeFuncao: AppsScriptProcurarDatasFunction,
  parametros: unknown[] = [],
  options?: {
    timeoutMs?: number
    clientToken?: string
    rota?: string
  }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const inicio = Date.now()
  const prefix = `[PROCURAR_DATAS][${options?.rota || nomeFuncao}]`

  console.log(`${prefix} inicio funcao=${nomeFuncao} clientToken=${options?.clientToken || '-'}`)

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new AppsScriptTimeoutError(timeoutMs)), timeoutMs)
  })

  try {
    const resultado = await Promise.race([
      executarAppsScript({
        nomeFuncao,
        parametros,
        devMode: false,
      }),
      timeoutPromise,
    ])

    const duracaoMs = Date.now() - inicio

    if (!resultado.sucesso) {
      console.error(`${prefix} erro funcao=${nomeFuncao} clientToken=${options?.clientToken || '-'} duracaoMs=${duracaoMs} erro=${resultado.erro}`)
      throw new Error(resultado.erro || 'Erro ao executar Apps Script.')
    }

    console.log(`${prefix} sucesso funcao=${nomeFuncao} clientToken=${options?.clientToken || '-'} duracaoMs=${duracaoMs}`)
    return resultado.resultado as T
  } catch (error) {
    const duracaoMs = Date.now() - inicio
    const message = error instanceof Error ? error.message : String(error)
    console.error(`${prefix} excecao funcao=${nomeFuncao} clientToken=${options?.clientToken || '-'} duracaoMs=${duracaoMs} erro=${message}`)
    throw error
  }
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof AppsScriptTimeoutError
}
