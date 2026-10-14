import { executarAnexoDecorisi } from '@/lib/pedidos-personalizados/server/decorisi-anexos'
export const runtime = 'nodejs'
type Contexto = { params: Promise<{ id: string; itemId: string; anexoId: string }> }
async function executar(request: Request, ctx: Contexto) { const p = await ctx.params; return executarAnexoDecorisi(request, p.id, p.itemId, p.anexoId) }
export { executar as GET, executar as PUT, executar as DELETE }
