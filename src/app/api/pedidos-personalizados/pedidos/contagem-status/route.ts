import { contarPedidosPorStatus } from '@/lib/pedidos-personalizados/server/handlers'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return contarPedidosPorStatus(request)
}
