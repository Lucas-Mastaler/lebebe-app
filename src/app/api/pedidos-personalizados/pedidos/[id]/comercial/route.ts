import { atualizarComercial } from '@/lib/pedidos-personalizados/server/handlers'

export const runtime = 'nodejs'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return atualizarComercial(request, id)
}
