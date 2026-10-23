// Apenas leituras do Gmail. Nunca envolve importação, Drive ou SEFAZ.
export function falhaTemporariaEmail(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string | number; status?: number; response?: { status?: number; data?: { error?: { errors?: Array<{ reason?: string }> } } } }
  const status = Number(e.response?.status ?? e.status ?? e.code)
  return [408, 429, 500, 502, 503, 504].includes(status)
    || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH'].includes(String(e.code))
    || status === 403 && Boolean(e.response?.data?.error?.errors?.some(item => ['rateLimitExceeded', 'userRateLimitExceeded'].includes(item.reason ?? '')))
}

export async function lerEmailComRepeticao<T>(ler: () => Promise<T>, esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try { return await ler() }
    catch (error) {
      if (tentativa === 2 || !falhaTemporariaEmail(error)) throw error
      await esperar(tentativa === 0 ? 500 : 1500)
    }
  }
}
