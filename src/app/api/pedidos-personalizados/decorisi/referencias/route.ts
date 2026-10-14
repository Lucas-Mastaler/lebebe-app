import { executarApiDecorisi } from '@/lib/pedidos-personalizados/server/decorisi-handlers'
export const runtime = 'nodejs'
export async function GET(request: Request) { return executarApiDecorisi(request, 'referencias') }
