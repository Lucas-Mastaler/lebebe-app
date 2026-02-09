import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const horarioInicioUTC = new Date().toISOString()
  const horarioInicioBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  console.log(`[AUTO-LOGOUT] ========================================`)
  console.log(`[AUTO-LOGOUT] Cron disparado em ${horarioInicioBRT} (UTC: ${horarioInicioUTC})`)
  console.log(`[AUTO-LOGOUT] CRON_SECRET configurado: ${!!process.env.CRON_SECRET}`)
  console.log(`[AUTO-LOGOUT] SUPABASE_SERVICE_ROLE_KEY configurado: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`)

  try {
    const authHeader = request.headers.get('authorization')
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[AUTO-LOGOUT] ❌ Unauthorized: CRON_SECRET não confere')
      console.error(`[AUTO-LOGOUT] Header recebido: ${authHeader ? 'Bearer ***' : '(vazio)'}`)
      console.error(`[AUTO-LOGOUT] CRON_SECRET env existe: ${!!process.env.CRON_SECRET}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[AUTO-LOGOUT] ❌ SUPABASE_SERVICE_ROLE_KEY não configurado')
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

    console.log('[AUTO-LOGOUT] Buscando todos os usuários do Supabase Auth...')
    const { data: authUsersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('[AUTO-LOGOUT] ❌ Erro ao listar usuários do Auth:', listError.message)
      return NextResponse.json({ 
        error: 'Failed to list auth users', 
        message: listError.message 
      }, { status: 500 })
    }

    const authUsersMap = new Map(
      authUsersData.users.map(user => [user.email?.toLowerCase(), user])
    )
    console.log(`[AUTO-LOGOUT] ${authUsersData.users.length} usuários encontrados no Auth`)

    let sessionsDisconnected = 0
    const errors: Array<{ email: string; error: string }> = []
    const agora = new Date().toISOString()

    for (const usuario of usuariosPermitidos) {
      try {
        console.log(`[AUTO-LOGOUT] Processando ${usuario.email}...`)

        const authUser = authUsersMap.get(usuario.email.toLowerCase())
        
        if (!authUser) {
          console.log(`[AUTO-LOGOUT] ⚠️ Usuário ${usuario.email} não encontrado no Supabase Auth (nunca fez login)`)
          continue
        }

        console.log(`[AUTO-LOGOUT] → Usuário ${usuario.email} encontrado (ID: ${authUser.id})`)

        // Ban temporário de 1s invalida TODAS as sessões/refresh tokens do usuário
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          ban_duration: '1s'
        })

        if (banError) {
          console.error(`[AUTO-LOGOUT] ❌ Erro ao banir temporariamente ${usuario.email}:`, banError.message)
          errors.push({ email: usuario.email, error: `ban: ${banError.message}` })
          continue
        }

        // Desbanir imediatamente para que o usuário possa logar novamente
        const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          ban_duration: 'none'
        })

        if (unbanError) {
          console.error(`[AUTO-LOGOUT] ⚠️ Erro ao desbanir ${usuario.email} (sessão invalidada, mas ban pode persistir):`, unbanError.message)
          errors.push({ email: usuario.email, error: `unban: ${unbanError.message}` })
          // NÃO damos continue aqui - o logout já aconteceu, só o unban falhou
        }

        console.log(`[AUTO-LOGOUT] ✓ Sessão invalidada para ${usuario.email} (ban/unban)`)
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
          console.error(`[AUTO-LOGOUT] ❌ Erro ao registrar logout na tabela de controle para ${usuario.email}:`, upsertError.message)
          errors.push({ email: usuario.email, error: `upsert sessoes_logout: ${upsertError.message}` })
        } else {
          console.log(`[AUTO-LOGOUT] ✓ Registrado em sessoes_logout_automatico: ${usuario.email}`)
        }

        const { error: auditoriaError } = await supabaseAdmin
          .from('auditoria_acessos')
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
          console.error(`[AUTO-LOGOUT] ❌ Erro ao registrar auditoria para ${usuario.email}:`, auditoriaError.message)
        } else {
          console.log(`[AUTO-LOGOUT] ✓ Auditoria registrada para user=${usuario.email}`)
        }

      } catch (err: any) {
        console.error(`[AUTO-LOGOUT] ❌ Exceção ao processar ${usuario.email}:`, err)
        errors.push({ email: usuario.email, error: `exception: ${err.message || 'Unknown error'}` })
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
