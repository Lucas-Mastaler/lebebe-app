import { transicionarStatus } from '@/lib/pedidos-personalizados/server/status-handlers'

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return transicionarStatus(request, id)
}
