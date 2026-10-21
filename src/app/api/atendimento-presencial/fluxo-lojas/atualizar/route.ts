import { flowJson, loadFlow } from '@/lib/atendimento-presencial/fluxo-lojas-server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) return flowJson({ ok: false, message: 'Origem inválida.' }, 403)
  return loadFlow(request, 'refresh')
}
