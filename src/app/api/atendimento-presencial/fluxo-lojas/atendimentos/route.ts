import { loadFlow } from '@/lib/atendimento-presencial/fluxo-lojas-server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) { return loadFlow(request, 'table') }
