-- =========================================================
-- MIGRATION 015: Problemas Pendentes de Recebimento
-- =========================================================

-- Tabela para armazenar problemas que devem ser resolvidos nos próximos carregamentos
CREATE TABLE IF NOT EXISTS recebimento_problemas_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id UUID NOT NULL REFERENCES recebimentos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  resolvido BOOLEAN NOT NULL DEFAULT FALSE,
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problemas_pendentes_recebimento ON recebimento_problemas_pendentes(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_problemas_pendentes_resolvido ON recebimento_problemas_pendentes(resolvido);

-- RLS
ALTER TABLE recebimento_problemas_pendentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recebimento_problemas_pendentes_select" ON recebimento_problemas_pendentes 
  FOR SELECT USING (is_matic_user());
  
CREATE POLICY "recebimento_problemas_pendentes_insert" ON recebimento_problemas_pendentes 
  FOR INSERT WITH CHECK (is_matic_user());
  
CREATE POLICY "recebimento_problemas_pendentes_update" ON recebimento_problemas_pendentes 
  FOR UPDATE USING (is_matic_user());
