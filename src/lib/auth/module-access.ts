import { createServiceClient } from '@/lib/supabase/service'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { AllowedUser } from '@/lib/auth/api-auth'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import type { AccessWindowCheckResult } from '@/lib/auth/access-window'

// ---------------------------------------------------------------------------
// Types públicos
// ---------------------------------------------------------------------------

export type ModuleKey =
  | 'dashboard'
  | 'agendamentos'
  | 'procurar_datas'
  | 'procurar_datas_auditoria'
  | 'chamados_finalizados'
  | 'inteligencia_comercial'
  | 'pos_venda'
  | 'recebimento'
  | 'superadmin'
  | 'configuracoes'

export type OrigemPermissao = 'superadmin' | 'usuario' | 'perfil'

export type RequireModuleAccessSuccess = {
  ok: true
  user: User
  email: string
  allowedUser: AllowedUser
  acessoTotal: boolean
  moduleKey: ModuleKey
  origem: OrigemPermissao
}

export type RequireModuleAccessError = {
  ok: false
  response: NextResponse
}

export type RequireModuleAccessResult = RequireModuleAccessSuccess | RequireModuleAccessError

// Resultado puro para uso em Server Components (sem NextResponse)
export type CheckModuleAccessResult =
  | (RequireModuleAccessSuccess & { ok: true })
  | { ok: false; reason: 'unauthenticated' | 'forbidden' | 'error' }

// ---------------------------------------------------------------------------
// Tipo interno de diagnóstico (usado pela rota diagnóstica)
// ---------------------------------------------------------------------------

export type ModuleAccessDiagnostico = {
  moduleKey: ModuleKey
  moduloEncontrado: boolean
  moduloAtivo: boolean
  acessoTotal: boolean
  perfilAtual: { id: string; chave: string; nome: string } | null
  origem: OrigemPermissao | null
  permitido: boolean
  motivo: string
}

// ---------------------------------------------------------------------------
// checkModuleAccess — versão para Server Components (sem NextResponse)
// ---------------------------------------------------------------------------

/**
 * Valida acesso ao módulo retornando objeto puro.
 * Use em Server Components (page.tsx). Para API handlers, use requireModuleAccess.
 *
 * NOTA: Bloqueio por janela de horário NÃO está implementado nesta fase.
 */
export async function checkModuleAccess(
  moduleKey: ModuleKey
): Promise<CheckModuleAccessResult> {
  // --- 1. Autenticação base ---
  const auth = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
  })

  if (!auth.ok) {
    return { ok: false, reason: 'unauthenticated' }
  }

  const allowedUser = auth.allowedUser!
  const supabaseAdmin = createServiceClient()

  // --- 2. Superadmin tem acesso total ---
  if (allowedUser.role === 'superadmin') {
    return {
      ok: true,
      user: auth.user,
      email: auth.email,
      allowedUser,
      acessoTotal: true,
      moduleKey,
      origem: 'superadmin',
    }
  }

  // --- 3. Busca módulo por chave ---
  const { data: moduloRow, error: moduloError } = await supabaseAdmin
    .from('app_modulos')
    .select('id, chave, ativo, publico, somente_superadmin')
    .eq('chave', moduleKey)
    .single()

  if (moduloError || !moduloRow) {
    console.error(`[MODULE ACCESS] Módulo não encontrado: ${moduleKey}`, moduloError)
    return { ok: false, reason: 'forbidden' }
  }

  // --- 4. Módulo inativo ---
  if (!moduloRow.ativo) {
    return { ok: false, reason: 'forbidden' }
  }

  // --- 5. Somente superadmin ---
  if (moduloRow.somente_superadmin) {
    return { ok: false, reason: 'forbidden' }
  }

  // --- 6. Módulo público ---
  if (moduloRow.publico) {
    return {
      ok: true,
      user: auth.user,
      email: auth.email,
      allowedUser,
      acessoTotal: false,
      moduleKey,
      origem: 'perfil',
    }
  }

  // --- 7 & 8. Exceção individual e permissão do perfil em paralelo ---
  const [excecaoResult, perfilResult] = await Promise.all([
    supabaseAdmin
      .from('app_permissoes_usuario')
      .select('permitido')
      .eq('usuario_id', allowedUser.id)
      .eq('modulo_id', moduloRow.id)
      .maybeSingle(),

    supabaseAdmin
      .from('app_usuarios_perfis')
      .select('perfil_id, app_perfis_acesso!inner(id, chave, nome, ativo)')
      .eq('usuario_id', allowedUser.id)
      .single(),
  ])

  // Exceção individual prevalece se existir
  if (!excecaoResult.error && excecaoResult.data !== null) {
    const permitido = excecaoResult.data.permitido === true
    if (permitido) {
      return {
        ok: true,
        user: auth.user,
        email: auth.email,
        allowedUser,
        acessoTotal: false,
        moduleKey,
        origem: 'usuario',
      }
    }
    return { ok: false, reason: 'forbidden' }
  }

  // Sem perfil ativo → bloqueia
  type PerfilRow = { id: string; chave: string; nome: string; ativo: boolean }
  const perfilRaw = perfilResult.data as { perfil_id: string; app_perfis_acesso: PerfilRow } | null
  const perfilInfo = perfilRaw?.app_perfis_acesso
  const perfilAtivo = perfilInfo?.ativo === true ? perfilInfo : null

  if (!perfilAtivo) {
    return { ok: false, reason: 'forbidden' }
  }

  // Busca permissão do perfil para este módulo
  const { data: permPerfil, error: permPerfilError } = await supabaseAdmin
    .from('app_permissoes_perfil')
    .select('permitido')
    .eq('perfil_id', perfilAtivo.id)
    .eq('modulo_id', moduloRow.id)
    .maybeSingle()

  if (permPerfilError) {
    console.error(`[MODULE ACCESS] Erro ao buscar permissão do perfil:`, permPerfilError)
    return { ok: false, reason: 'error' }
  }

  if (permPerfil?.permitido === true) {
    return {
      ok: true,
      user: auth.user,
      email: auth.email,
      allowedUser,
      acessoTotal: false,
      moduleKey,
      origem: 'perfil',
    }
  }

  return { ok: false, reason: 'forbidden' }
}

// ---------------------------------------------------------------------------
// requireModuleAccess — versão para API handlers (retorna NextResponse)
// ---------------------------------------------------------------------------

/**
 * Wrapper de checkModuleAccess para API Route handlers.
 * Converte o resultado puro em NextResponse quando necessário.
 *
 * NOTA: Bloqueio por janela de horário NÃO está implementado nesta fase.
 */
export async function requireModuleAccess(
  moduleKey: ModuleKey
): Promise<RequireModuleAccessResult> {
  const result = await checkModuleAccess(moduleKey)

  if (result.ok) {
    return result
  }

  const status = result.reason === 'unauthenticated' ? 401 : result.reason === 'error' ? 500 : 403
  const message =
    result.reason === 'unauthenticated'
      ? 'Não autenticado'
      : result.reason === 'error'
      ? 'Erro ao processar requisição'
      : 'Acesso negado'

  return {
    ok: false,
    response: NextResponse.json({ ok: false, message }, { status }),
  }
}

// ---------------------------------------------------------------------------
// Diagnóstico (usado pela rota /api/superadmin/diagnostico/module-access)
// ---------------------------------------------------------------------------

/**
 * Versão diagnóstica: retorna resultado sem emitir NextResponse.
 * Para uso exclusivo em rotas de diagnóstico protegidas por superadmin.
 * Não expõe dados sensíveis.
 */
export async function diagnosticoModuleAccess(
  usuarioId: string,
  usuarioRole: string,
  moduleKey: ModuleKey
): Promise<ModuleAccessDiagnostico> {
  const supabaseAdmin = createServiceClient()

  // Superadmin: acesso total
  if (usuarioRole === 'superadmin') {
    return {
      moduleKey,
      moduloEncontrado: true,
      moduloAtivo: true,
      acessoTotal: true,
      perfilAtual: null,
      origem: 'superadmin',
      permitido: true,
      motivo: 'Superadmin tem acesso total',
    }
  }

  // Busca módulo
  const { data: moduloRow, error: moduloError } = await supabaseAdmin
    .from('app_modulos')
    .select('id, chave, ativo, publico, somente_superadmin')
    .eq('chave', moduleKey)
    .single()

  if (moduloError || !moduloRow) {
    return {
      moduleKey,
      moduloEncontrado: false,
      moduloAtivo: false,
      acessoTotal: false,
      perfilAtual: null,
      origem: null,
      permitido: false,
      motivo: 'Módulo não encontrado em app_modulos',
    }
  }

  if (!moduloRow.ativo) {
    return {
      moduleKey,
      moduloEncontrado: true,
      moduloAtivo: false,
      acessoTotal: false,
      perfilAtual: null,
      origem: null,
      permitido: false,
      motivo: 'Módulo inativo',
    }
  }

  if (moduloRow.somente_superadmin) {
    return {
      moduleKey,
      moduloEncontrado: true,
      moduloAtivo: true,
      acessoTotal: false,
      perfilAtual: null,
      origem: null,
      permitido: false,
      motivo: 'Módulo restrito a superadmin',
    }
  }

  if (moduloRow.publico) {
    return {
      moduleKey,
      moduloEncontrado: true,
      moduloAtivo: true,
      acessoTotal: false,
      perfilAtual: null,
      origem: 'perfil',
      permitido: true,
      motivo: 'Módulo público',
    }
  }

  // Exceção individual + perfil em paralelo
  const [excecaoResult, perfilResult] = await Promise.all([
    supabaseAdmin
      .from('app_permissoes_usuario')
      .select('permitido')
      .eq('usuario_id', usuarioId)
      .eq('modulo_id', moduloRow.id)
      .maybeSingle(),

    supabaseAdmin
      .from('app_usuarios_perfis')
      .select('perfil_id, app_perfis_acesso!inner(id, chave, nome, ativo)')
      .eq('usuario_id', usuarioId)
      .single(),
  ])

  if (!excecaoResult.error && excecaoResult.data !== null) {
    const permitido = excecaoResult.data.permitido === true
    return {
      moduleKey,
      moduloEncontrado: true,
      moduloAtivo: true,
      acessoTotal: false,
      perfilAtual: null,
      origem: 'usuario',
      permitido,
      motivo: permitido
        ? 'Exceção individual: permitido'
        : 'Exceção individual: bloqueado',
    }
  }

  type PerfilRow = { id: string; chave: string; nome: string; ativo: boolean }
  const perfilRaw = perfilResult.data as { perfil_id: string; app_perfis_acesso: PerfilRow } | null
  const perfilInfo = perfilRaw?.app_perfis_acesso
  const perfilAtivo = perfilInfo?.ativo === true ? perfilInfo : null

  if (!perfilAtivo) {
    return {
      moduleKey,
      moduloEncontrado: true,
      moduloAtivo: true,
      acessoTotal: false,
      perfilAtual: null,
      origem: null,
      permitido: false,
      motivo: 'Usuário sem perfil ativo',
    }
  }

  const perfilAtual = { id: perfilAtivo.id, chave: perfilAtivo.chave, nome: perfilAtivo.nome }

  const { data: permPerfil } = await supabaseAdmin
    .from('app_permissoes_perfil')
    .select('permitido')
    .eq('perfil_id', perfilAtivo.id)
    .eq('modulo_id', moduloRow.id)
    .maybeSingle()

  if (permPerfil?.permitido === true) {
    return {
      moduleKey,
      moduloEncontrado: true,
      moduloAtivo: true,
      acessoTotal: false,
      perfilAtual,
      origem: 'perfil',
      permitido: true,
      motivo: `Permitido pelo perfil: ${perfilAtivo.nome}`,
    }
  }

  return {
    moduleKey,
    moduloEncontrado: true,
    moduloAtivo: true,
    acessoTotal: false,
    perfilAtual,
    origem: 'perfil',
    permitido: false,
    motivo: permPerfil === null
      ? `Perfil ${perfilAtivo.nome} não tem linha para este módulo`
      : `Bloqueado pelo perfil: ${perfilAtivo.nome}`,
  }
}

// ---------------------------------------------------------------------------
// checkModuleAndWindowAccess — helper combinado para Server Components
// ---------------------------------------------------------------------------

export type CheckPageAccessResult =
  | {
      ok: true
      moduleAccess: RequireModuleAccessSuccess & { ok: true }
      windowAccess: AccessWindowCheckResult & { ok: true }
    }
  | {
      ok: false
      reason: 'module' | 'window'
      redirectTo: '/acesso-negado' | '/fora-do-horario'
    }

/**
 * Helper combinado: valida módulo e janela de horário em sequência.
 * Use em Server Components (page.tsx).
 *
 * - Falha de módulo → redirectTo: '/acesso-negado'
 * - Falha de janela → redirectTo: '/fora-do-horario'
 * - Superadmin ignora janela de horário (delegado a checkAccessWindowForUser).
 */
export async function checkModuleAndWindowAccess(
  moduleKey: ModuleKey
): Promise<CheckPageAccessResult> {
  const moduleAccess = await checkModuleAccess(moduleKey)

  if (!moduleAccess.ok) {
    return { ok: false, reason: 'module', redirectTo: '/acesso-negado' }
  }

  const windowAccess = await checkAccessWindowForUser({
    usuarioId: moduleAccess.allowedUser.id,
    role: moduleAccess.allowedUser.role as 'user' | 'superadmin',
  })

  if (!windowAccess.ok) {
    return { ok: false, reason: 'window', redirectTo: '/fora-do-horario' }
  }

  return { ok: true, moduleAccess, windowAccess }
}
