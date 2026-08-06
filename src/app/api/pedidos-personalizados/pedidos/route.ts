import {
  criarPedido,
  listarPedidos,
} from '@/lib/pedidos-personalizados/server/handlers'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return listarPedidos(request)
}

export async function POST(request: Request) {
  return criarPedido(request)
}
