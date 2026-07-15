import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPERADMIN_USUARIOS_MODULE_KEY } from '@/lib/auth/superadmin-users-access'

type PerfilAtribuivelResult =
  | { ok: true; perfil: { id: string; chave: string; nome: string; ativo: boolean } }
  | { ok: false; status: number; message: string }

export async function validarPerfilAtribuivel(
  supabaseAdmin: SupabaseClient,
  perfilId: string,
  acessoLimitadoUsuarios: boolean
): Promise<PerfilAtribuivelResult> {
  const { data: perfil, error: perfilError } = await supabaseAdmin
    .from('app_perfis_acesso')
    .select('id, chave, nome, ativo')
    .eq('id', perfilId)
    .single()

  if (perfilError || !perfil) {
    return { ok: false, status: 404, message: 'Perfil não encontrado' }
  }

  if (!perfil.ativo) {
    return { ok: false, status: 422, message: 'Não é possível atribuir perfil inativo' }
  }

  if (!acessoLimitadoUsuarios) {
    return { ok: true, perfil }
  }

  const { data: moduloUsuarios, error: moduloError } = await supabaseAdmin
    .from('app_modulos')
    .select('id')
    .eq('chave', SUPERADMIN_USUARIOS_MODULE_KEY)
    .single()

  if (moduloError || !moduloUsuarios) {
    return { ok: false, status: 403, message: 'Acesso negado' }
  }

  const { data: permissaoUsuarios } = await supabaseAdmin
    .from('app_permissoes_perfil')
    .select('id')
    .eq('perfil_id', perfil.id)
    .eq('modulo_id', moduloUsuarios.id)
    .eq('permitido', true)
    .maybeSingle()

  if (permissaoUsuarios) {
    return { ok: false, status: 403, message: 'Perfil não permitido para esta operação' }
  }

  return { ok: true, perfil }
}

export function isUuidList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0)
}
