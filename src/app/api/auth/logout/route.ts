import { createClient } from '@/lib/supabase/server'
import { registrarAuditoria } from '@/lib/auth/helpers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user?.email) {
      await registrarAuditoria('LOGOUT', user.email, undefined, {
        baseUrl: request.headers.get('origin') || undefined,
      })
    }

    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao fazer logout:', error)
    return NextResponse.json(
      { error: 'Erro ao processar logout' },
      { status: 500 }
    )
  }
}
