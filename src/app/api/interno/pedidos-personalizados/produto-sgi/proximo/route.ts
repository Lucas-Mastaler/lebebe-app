import { reivindicarProdutoSgi } from '@/lib/pedidos-personalizados/server/produto-sgi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return reivindicarProdutoSgi(request)
}
