import { executarApiDecorisi } from '@/lib/pedidos-personalizados/server/decorisi-handlers'
export const runtime = 'nodejs'
export async function POST(request: Request) { return executarApiDecorisi(request, 'criar') }
