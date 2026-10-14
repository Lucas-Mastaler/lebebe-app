import { executarApiDecorisi } from '@/lib/pedidos-personalizados/server/decorisi-handlers'
export const runtime = 'nodejs'
type Contexto = { params: Promise<{ id: string }> }
export async function GET(request: Request, ctx: Contexto) { return executarApiDecorisi(request, 'obter', (await ctx.params).id) }
export async function PATCH(request: Request, ctx: Contexto) { return executarApiDecorisi(request, 'atualizar', (await ctx.params).id) }
