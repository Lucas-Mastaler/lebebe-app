import { adicionarObservacao } from '@/lib/pedidos-personalizados/server/handlers'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return adicionarObservacao(request, id)
}
