import { atualizar, excluir, obter } from '@/lib/promocoes-mes/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Contexto) {
  return obter((await context.params).id)
}

export async function PATCH(request: Request, context: Contexto) {
  return atualizar(request, (await context.params).id)
}

export async function DELETE(_request: Request, context: Contexto) {
  return excluir((await context.params).id)
}
