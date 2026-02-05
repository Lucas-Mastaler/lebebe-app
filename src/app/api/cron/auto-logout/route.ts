import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[AUTO-LOGOUT] Unauthorized: Invalid CRON_SECRET')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[AUTO-LOGOUT] SUPABASE_SERVICE_ROLE_KEY não configurado')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const horarioBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    console.log(`[AUTO-LOGOUT] Iniciando processo às 19h BRT (${horarioBRT})`)

    const { data: usuariosPermitidos, error: errorUsuarios } = await supabaseAdmin
      .from('usuarios_permitidos')
      .select('id, email, role')
      .eq('ativo', true)
      .neq('role', 'superadmin')

    if (errorUsuarios) {
      console.error('[AUTO-LOGOUT] Erro ao buscar usuários:', errorUsuarios)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!usuariosPermitidos || usuariosPermitidos.length === 0) {
      console.log('[AUTO-LOGOUT] Nenhum usuário não-superadmin ativo encontrado')
      return NextResponse.json({ 
        success: true, 
        message: 'Nenhum usuário para desconectar',
        disconnected: 0 
      })
    }

    console.log(`[AUTO-LOGOUT] ${usuariosPermitidos.length} usuários não-superadmin ativos encontrados`)

    let sessionsDisconnected = 0
    const errors: Array<{ email: string; error: string }> = []
    const agora = new Date().toISOString()

    for (const usuario of usuariosPermitidos) {
      try {
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (listError) {
          console.error(`[AUTO-LOGOUT] Erro ao listar usuários auth para ${usuario.email}:`, listError)
          errors.push({ email: usuario.email, error: listError.message })
          continue
        }

        const authUser = authUsers.users.find(u => u.email?.toLowerCase() === usuario.email.toLowerCase())
        
        if (!authUser) {
          console.log(`[AUTO-LOGOUT] Usuário ${usuario.email} não tem sessão ativa no auth`)
          continue
        }

        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(authUser.id)

        if (signOutError) {
          console.error(`[AUTO-LOGOUT] Erro ao desconectar ${usuario.email}:`, signOutError)
          errors.push({ email: usuario.email, error: signOutError.message })
          continue
        }

        console.log(`[AUTO-LOGOUT] ✓ Sessão encerrada para ${usuario.email}`)
        sessionsDisconnected++

        const { error: upsertError } = await supabaseAdmin
          .from('sessoes_logout_automatico')
          .upsert({
            usuario_id: authUser.id,
            email: usuario.email,
            ultimo_logout_automatico: agora,
            updated_at: agora
          }, {
            onConflict: 'email'
          })

        if (upsertError) {
          console.error(`[AUTO-LOGOUT] Erro ao registrar logout na tabela de controle:`, upsertError)
        }

        const { error: auditoriaError } = await supabaseAdmin
          .from('auditoria_acesso')
          .insert({
            acao: 'AUTO_LOGOUT_19H',
            email: usuario.email,
            ip: null,
            user_agent: 'SYSTEM_CRON',
            metadata: {
              motivo: 'Desconectado automaticamente às 19:00 (America/Sao_Paulo)',
              usuario_id: authUser.id,
              role: usuario.role,
              sessao_id: authUser.id,
              origem: 'system',
              horario_brt: horarioBRT,
              horario_utc: agora
            }
          })

        if (auditoriaError) {
          console.error(`[AUTO-LOGOUT] Erro ao registrar auditoria para ${usuario.email}:`, auditoriaError)
        } else {
          console.log(`[AUTO-LOGOUT] ✓ Auditoria registrada para user=${usuario.email}`)
        }

      } catch (err: any) {
        console.error(`[AUTO-LOGOUT] Exceção ao processar ${usuario.email}:`, err)
        errors.push({ email: usuario.email, error: err.message || 'Unknown error' })
      }
    }

    const summary = `[AUTO-LOGOUT] 19h BRT: desconectando ${sessionsDisconnected} sessões (exceto superadmin)`
    console.log(summary)

    if (errors.length > 0) {
      console.error(`[AUTO-LOGOUT] ${errors.length} erros durante o processo:`, errors)
    }

    return NextResponse.json({
      success: true,
      message: summary,
      disconnected: sessionsDisconnected,
      totalUsuarios: usuariosPermitidos.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: agora,
      timestampBRT: horarioBRT
    })

  } catch (error: any) {
    console.error('[AUTO-LOGOUT] Erro crítico no processo:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message 
      }, 
      { status: 500 }
    )
  }
}
