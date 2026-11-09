import { vigentes } from '@/lib/promocoes-mes/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return vigentes()
}
