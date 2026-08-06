import { obterOpcoes } from '@/lib/pedidos-personalizados/server/handlers'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return obterOpcoes(request)
}
