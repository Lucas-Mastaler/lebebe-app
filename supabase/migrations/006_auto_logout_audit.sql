-- Migration para suportar auditoria de logout automático
-- Adiciona índice para melhorar performance nas queries de auditoria
CREATE INDEX IF NOT EXISTS idx_auditoria_acesso_acao_created_at 
ON auditoria_acesso(acao, created_at DESC);

-- Criar tabela para rastrear sessões e último logout automático
CREATE TABLE IF NOT EXISTS sessoes_logout_automatico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL,
  email TEXT NOT NULL,
  ultimo_logout_automatico TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar rapidamente por email
CREATE INDEX IF NOT EXISTS idx_sessoes_logout_email 
ON sessoes_logout_automatico(email);

-- Índice para buscar por data do último logout
CREATE INDEX IF NOT EXISTS idx_sessoes_logout_data 
ON sessoes_logout_automatico(ultimo_logout_automatico DESC);

-- Comentários
COMMENT ON TABLE sessoes_logout_automatico IS 'Rastreia quando cada usuário foi desconectado automaticamente pela última vez';
COMMENT ON COLUMN sessoes_logout_automatico.usuario_id IS 'ID do usuário no Supabase Auth';
COMMENT ON COLUMN sessoes_logout_automatico.ultimo_logout_automatico IS 'Data/hora do último logout automático (19h BRT)';
