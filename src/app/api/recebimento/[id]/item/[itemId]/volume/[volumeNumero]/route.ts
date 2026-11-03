import { NextRequest, NextResponse } from 'next/server'
import { conferirVolumes } from '@/lib/recebimento/conferencia-volumes'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; volumeNumero: string }> },
) {
  const { id, itemId, volumeNumero } = await params
  let body: { delta?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
  if (!body || (body.delta !== 1 && body.delta !== -1) || !/^[1-9]\d*$/.test(volumeNumero)) {
    return NextResponse.json({ error: 'Volume inválido ou delta diferente de +1/-1' }, { status: 400 })
  }
  return conferirVolumes(id, itemId, { volumeNumero: Number(volumeNumero), delta: body.delta })
}
