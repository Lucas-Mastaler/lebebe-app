-- Migration: Marcar token de convite como usado
-- Evita reutilização do mesmo token após o usuário confirmar

ALTER TABLE usuarios_permitidos
ADD COLUMN IF NOT EXISTS invite_token_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usuarios_permitidos_invite_token_used_at
ON usuarios_permitidos(invite_token_used_at);

COMMENT ON COLUMN usuarios_permitidos.invite_token_used_at IS
'Quando o usuário clica em "Confirmar convite" na página /convite/<token>, o token é marcado como utilizado.';
