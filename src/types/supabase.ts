export interface UsuarioPermitido {
  id: string
  email: string
  role: 'user' | 'superadmin'
  ativo: boolean
  created_at: string
  created_by: string | null
  updated_at: string | null
}

export interface AuditoriaAcesso {
  id: string
  acao: AcaoAuditoria
  email: string | null
  ip: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type AcaoAuditoria =
  | 'LOGIN_SUCESSO'
  | 'LOGIN_FALHA'
  | 'LOGOUT'
  | 'AUTO_LOGOUT_19H'
  | 'RESET_SOLICITADO'
  | 'RESET_CONCLUIDO'
  | 'SENHA_DEFINIDA'
  | 'USUARIO_PERMITIDO_CRIADO'
  | 'USUARIO_BLOQUEADO'
  | 'USUARIO_DESBLOQUEADO'
  | 'ROLE_ALTERADA'
  | 'INVITE_EMAIL_SENT'
  | 'INVITE_EMAIL_FAILED'
  | 'RESET_EMAIL_SENT'
  | 'RESET_EMAIL_FAILED'

export interface RegistrarAuditoriaParams {
  acao: AcaoAuditoria
  email?: string
  metadata?: Record<string, unknown>
}

export interface SessaoLogoutAutomatico {
  id: string
  usuario_id: string
  email: string
  ultimo_logout_automatico: string
  created_at: string
  updated_at: string
}

export interface AppModulo {
  id: string
  chave: string
  nome: string
  descricao: string | null
  rota_base: string | null
  categoria: string | null
  publico: boolean
  somente_superadmin: boolean
  ativo: boolean
  ordem: number | null
  created_at: string
  updated_at: string
}

export interface AppPermissaoUsuario {
  id: string
  usuario_id: string
  modulo_id: string
  permitido: boolean
  concedido_por: string | null
  motivo: string | null
  created_at: string
  updated_at: string
}

export interface AppJanelaAcessoUsuario {
  id: string
  usuario_id: string
  dias_semana: number[]
  hora_inicio: string
  hora_fim: string
  timezone: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface AppAuditoriaPermissao {
  id: string
  ator_usuario_id: string | null
  alvo_usuario_id: string | null
  acao: string
  entidade: string
  entidade_id: string | null
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AppPerfilAcesso {
  id: string
  chave: string
  nome: string
  descricao: string | null
  ativo: boolean
  sistema: boolean
  ordem: number | null
  created_at: string
  updated_at: string
}

export interface AppUsuarioPerfil {
  id: string
  usuario_id: string
  perfil_id: string
  atribuido_por: string | null
  created_at: string
  updated_at: string
}

export interface AppUnidade {
  id: string
  chave: string
  nome: string
  ativo: boolean
  ordem: number | null
  created_at: string
  updated_at: string
}

export interface AppUsuarioUnidade {
  id: string
  usuario_id: string
  unidade_id: string
  atribuido_por: string | null
  created_at: string
  updated_at: string
}

export interface AppPermissaoPerfil {
  id: string
  perfil_id: string
  modulo_id: string
  permitido: boolean
  created_at: string
  updated_at: string
}

export type TipoJanelaPerfil = 'seg_sex' | 'sabado' | 'domingo'

export interface AppJanelaAcessoPerfil {
  id: string
  perfil_id: string
  tipo: TipoJanelaPerfil
  ativo: boolean
  hora_inicio: string | null
  hora_fim: string | null
  timezone: string
  created_at: string
  updated_at: string
}
