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
  | 'RESET_SOLICITADO'
  | 'RESET_CONCLUIDO'
  | 'USUARIO_PERMITIDO_CRIADO'
  | 'USUARIO_BLOQUEADO'
  | 'USUARIO_DESBLOQUEADO'
  | 'ROLE_ALTERADA'

export interface RegistrarAuditoriaParams {
  acao: AcaoAuditoria
  email?: string
  metadata?: Record<string, any>
}
