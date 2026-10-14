import { executarApiDecorisi } from '@/lib/pedidos-personalizados/server/decorisi-handlers'
export const runtime = 'nodejs'
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) { return executarApiDecorisi(request, 'fechar', (await ctx.params).id) }
