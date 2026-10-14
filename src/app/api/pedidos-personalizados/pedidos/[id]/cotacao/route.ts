import { executarApiDecorisi } from '@/lib/pedidos-personalizados/server/decorisi-handlers'
export const runtime = 'nodejs'
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) { return executarApiDecorisi(request, 'cotar', (await ctx.params).id) }
