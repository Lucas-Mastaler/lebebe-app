const DURACAO_LOCAL_MS = 8 * 60 * 60 * 1000

export function requisicaoDecorisiLocal(request: Request): boolean {
  if (process.env.NODE_ENV !== 'development' || process.env.VERCEL_ENV) return false
  return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
}

export function backendDecorisiHabilitado(request: Request): boolean {
  return process.env.PEDIDOS_DECORISI_BACKEND === 'true' || requisicaoDecorisiLocal(request)
}

/** Prazo fixo por processo: HMR e novas requisições não renovam o acesso. */
export function expiracaoDecorisiLocal(request: Request): string | undefined {
  if (!requisicaoDecorisiLocal(request)) return undefined
  const estado = globalThis as typeof globalThis & { decorisiLocalExpiraEm?: number }
  estado.decorisiLocalExpiraEm ??= Date.now() + DURACAO_LOCAL_MS
  if (Date.now() >= estado.decorisiLocalExpiraEm) return undefined
  return new Date(estado.decorisiLocalExpiraEm).toISOString()
}
