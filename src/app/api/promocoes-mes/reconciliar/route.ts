import { reconciliar } from '@/lib/promocoes-mes/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Relatório (sem alterar nada). */
export async function GET() {
  return reconciliar(false)
}

/** Remove objetos órfãos e pendências registradas. */
export async function POST() {
  return reconciliar(true)
}
