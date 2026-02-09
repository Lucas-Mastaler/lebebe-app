-- ============================================
-- MIGRATION 008: Tabela usuarios_info
-- Observações vinculadas ao contactId do cliente
-- ============================================

CREATE TABLE IF NOT EXISTS usuarios_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id TEXT UNIQUE NOT NULL,
    observacao TEXT CHECK (char_length(observacao) <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca rápida por contact_id
CREATE INDEX idx_usuarios_info_contact_id ON usuarios_info(contact_id);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_usuarios_info_updated_at
    BEFORE UPDATE ON usuarios_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================
ALTER TABLE usuarios_info ENABLE ROW LEVEL SECURITY;

-- Policy: Qualquer usuário autenticado pode ler
CREATE POLICY "Authenticated pode ler usuarios_info"
    ON usuarios_info
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Qualquer usuário autenticado pode inserir
CREATE POLICY "Authenticated pode inserir usuarios_info"
    ON usuarios_info
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Qualquer usuário autenticado pode atualizar
CREATE POLICY "Authenticated pode atualizar usuarios_info"
    ON usuarios_info
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON TABLE usuarios_info IS 'Informações extras vinculadas ao contactId do cliente (ex: observações)';
COMMENT ON COLUMN usuarios_info.contact_id IS 'ID do contato no Digisac';
COMMENT ON COLUMN usuarios_info.observacao IS 'Observação do cliente, máximo 100 caracteres';
