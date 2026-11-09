import { criar, listarAdmin } from '@/lib/promocoes-mes/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return listarAdmin()
}

export async function POST(request: Request) {
  return criar(request)
}
