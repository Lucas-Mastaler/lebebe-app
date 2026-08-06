import { uploadAnexoGestao } from '@/lib/pedidos-personalizados/server/anexos-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; tapeteId: string }> }
) {
  const { id, tapeteId } = await context.params
  return uploadAnexoGestao(request, id, tapeteId)
}
