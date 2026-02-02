import { createServiceClient } from '@/lib/supabase/service'
import { RegistrarAuditoriaParams } from '@/types/supabase'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body: RegistrarAuditoriaParams = await request.json()
    const { acao, email, metadata } = body

    if (!acao) {
      return NextResponse.json(
        { error: 'Ação é obrigatória' },
        { status: 400 }
      )
    }

    const headersList = await headers()
    const ip = 
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('auditoria_acessos')
      .insert({
        acao,
        email: email || null,
        ip,
        user_agent: userAgent,
        metadata: metadata || null,
      })

    if (error) {
      console.error('Erro ao registrar auditoria:', error)
      return NextResponse.json(
        { error: 'Erro ao registrar auditoria' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao processar requisição de auditoria:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
