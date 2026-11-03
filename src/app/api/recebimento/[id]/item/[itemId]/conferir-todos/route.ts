import { NextRequest } from 'next/server'
import { conferirVolumes } from '@/lib/recebimento/conferencia-volumes'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params
  return conferirVolumes(id, itemId)
}
