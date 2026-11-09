import { criar, listarAdmin } from '@/lib/promocoes-mes/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return listarAdmin(request)
}

export async function POST(request: Request) {
  return criar(request)
}
