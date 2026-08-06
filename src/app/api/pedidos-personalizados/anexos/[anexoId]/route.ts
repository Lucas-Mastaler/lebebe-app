import { abrirAnexo, removerAnexo, substituirAnexo } from '@/lib/pedidos-personalizados/server/anexos-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ anexoId: string }> }

export async function GET(request: Request, context: Contexto) {
  return abrirAnexo(request, (await context.params).anexoId)
}

export async function PUT(request: Request, context: Contexto) {
  return substituirAnexo(request, (await context.params).anexoId)
}

export async function DELETE(request: Request, context: Contexto) {
  return removerAnexo(request, (await context.params).anexoId)
}
