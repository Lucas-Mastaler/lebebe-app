import { solicitarProdutoSgi } from '@/lib/pedidos-personalizados/server/produto-sgi'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return solicitarProdutoSgi(request, id)
}
