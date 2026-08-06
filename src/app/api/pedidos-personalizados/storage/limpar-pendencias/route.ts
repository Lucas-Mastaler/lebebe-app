import { limparPendenciasStorage } from '@/lib/pedidos-personalizados/server/storage-fila'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return limparPendenciasStorage(request)
}
