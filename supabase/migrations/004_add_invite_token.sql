-- Migration: Adicionar token de convite seguro contra scanners de email
-- Evita que links sejam consumidos por scanners antes do usuário clicar

-- 1. Adicionar campo invite_token
ALTER TABLE usuarios_permitidos
ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS invite_token_expires_at TIMESTAMPTZ;

-- 2. Criar índice para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_usuarios_permitidos_invite_token 
ON usuarios_permitidos(invite_token) WHERE invite_token IS NOT NULL;

-- 3. Comentários
COMMENT ON COLUMN usuarios_permitidos.invite_token IS 
'Token único para convite. Usado na URL do email. Não expira no primeiro acesso (proteção contra scanners).';

COMMENT ON COLUMN usuarios_permitidos.invite_token_expires_at IS 
'Data de expiração do token de convite (24 horas após envio). Token pode ser acessado múltiplas vezes até expirar.';
