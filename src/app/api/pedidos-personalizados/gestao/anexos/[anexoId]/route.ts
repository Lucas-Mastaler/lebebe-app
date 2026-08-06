import {
  removerAnexoGestao,
  substituirAnexoGestao,
} from '@/lib/pedidos-personalizados/server/anexos-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ anexoId: string }> }

export async function PUT(request: Request, context: Contexto) {
  return substituirAnexoGestao(request, (await context.params).anexoId)
}

export async function DELETE(request: Request, context: Contexto) {
  return removerAnexoGestao(request, (await context.params).anexoId)
}
