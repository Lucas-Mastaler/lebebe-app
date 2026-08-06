import { obterDetalhePedido } from '@/lib/pedidos-personalizados/server/handlers'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return obterDetalhePedido(request, id)
}
