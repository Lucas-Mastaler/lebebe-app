import { executarAnexoDecorisi } from '@/lib/pedidos-personalizados/server/decorisi-anexos'
export const runtime = 'nodejs'
type Contexto = { params: Promise<{ id: string; itemId: string }> }
export async function POST(request: Request, ctx: Contexto) { const p = await ctx.params; return executarAnexoDecorisi(request, p.id, p.itemId) }
