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
  metadata: Record<string, any> | null
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
  metadata?: Record<string, any>
}

export interface SessaoLogoutAutomatico {
  id: string
  usuario_id: string
  email: string
  ultimo_logout_automatico: string
  created_at: string
  updated_at: string
}
