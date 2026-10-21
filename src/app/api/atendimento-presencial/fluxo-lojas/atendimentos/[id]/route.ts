import { loadOriginal } from '@/lib/atendimento-presencial/fluxo-lojas-server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { return loadOriginal((await context.params).id) }
