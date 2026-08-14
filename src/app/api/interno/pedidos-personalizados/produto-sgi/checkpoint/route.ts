import { registrarCheckpointProdutoSgi } from '@/lib/pedidos-personalizados/server/produto-sgi'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return registrarCheckpointProdutoSgi(request)
}
