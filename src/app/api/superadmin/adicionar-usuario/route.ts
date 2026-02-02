import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { registrarAuditoria } from '@/lib/auth/helpers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { data: usuarioLogado } = await supabase
      .from('usuarios_permitidos')
      .select('role')
      .eq('email', user.email.toLowerCase())
      .single()

    if (usuarioLogado?.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    const { email, role } = await request.json()

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email e role são obrigatórios' },
        { status: 400 }
      )
    }

    const emailNormalizado = email.toLowerCase().trim()

    const { data: usuarioExistente } = await supabase
      .from('usuarios_permitidos')
      .select('id')
      .eq('email', emailNormalizado)
      .single()

    if (usuarioExistente) {
      return NextResponse.json(
        { error: 'Usuário já existe' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceClient()

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      emailNormalizado,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/definir-senha`,
      }
    )

    if (inviteError) {
      console.error('Erro ao convidar usuário:', inviteError)
      return NextResponse.json(
        { error: 'Erro ao enviar convite: ' + inviteError.message },
        { status: 500 }
      )
    }

    const { error: insertError } = await supabase
      .from('usuarios_permitidos')
      .insert({
        email: emailNormalizado,
        role: role,
        ativo: true,
      })

    if (insertError) {
      console.error('Erro ao inserir usuário permitido:', insertError)
      return NextResponse.json(
        { error: 'Erro ao criar registro de permissão' },
        { status: 500 }
      )
    }

    await registrarAuditoria('USUARIO_PERMITIDO_CRIADO', user.email, {
      novo_usuario: emailNormalizado,
      role: role,
    }, {
      baseUrl: request.headers.get('origin') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: 'Convite enviado com sucesso! O usuário receberá um email para definir a senha.',
      user: inviteData.user,
    })

  } catch (error) {
    console.error('Erro ao adicionar usuário:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
