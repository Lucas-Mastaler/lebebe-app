-- ============================================
-- MIGRATION 001: Initial Schema
-- Authentication + Superadmin + Audit System
-- ============================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: usuarios_permitidos
-- Controla quem pode acessar o sistema
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios_permitidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'superadmin')),
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES usuarios_permitidos(id),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_usuarios_email ON usuarios_permitidos(email);
CREATE INDEX idx_usuarios_ativo ON usuarios_permitidos(ativo);
CREATE INDEX idx_usuarios_role ON usuarios_permitidos(role);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usuarios_permitidos_updated_at
    BEFORE UPDATE ON usuarios_permitidos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: auditoria_acessos
-- Registra todas as ações no sistema
-- ============================================
CREATE TABLE IF NOT EXISTS auditoria_acessos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acao TEXT NOT NULL,
    email TEXT,
    ip TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas comuns
CREATE INDEX idx_auditoria_acao ON auditoria_acessos(acao);
CREATE INDEX idx_auditoria_email ON auditoria_acessos(email);
CREATE INDEX idx_auditoria_created_at ON auditoria_acessos(created_at DESC);

-- ============================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================

-- Ativar RLS nas tabelas
ALTER TABLE usuarios_permitidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_acessos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES: usuarios_permitidos
-- Apenas superadmins podem ler/escrever
-- ============================================

-- Policy: Superadmin pode ler todos os usuários
CREATE POLICY "Superadmin pode ler usuarios_permitidos"
    ON usuarios_permitidos
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios_permitidos up
            WHERE up.email = auth.jwt()->>'email'
            AND up.role = 'superadmin'
            AND up.ativo = true
        )
    );

-- Policy: Superadmin pode inserir novos usuários
CREATE POLICY "Superadmin pode inserir usuarios_permitidos"
    ON usuarios_permitidos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios_permitidos up
            WHERE up.email = auth.jwt()->>'email'
            AND up.role = 'superadmin'
            AND up.ativo = true
        )
    );

-- Policy: Superadmin pode atualizar usuários
CREATE POLICY "Superadmin pode atualizar usuarios_permitidos"
    ON usuarios_permitidos
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios_permitidos up
            WHERE up.email = auth.jwt()->>'email'
            AND up.role = 'superadmin'
            AND up.ativo = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios_permitidos up
            WHERE up.email = auth.jwt()->>'email'
            AND up.role = 'superadmin'
            AND up.ativo = true
        )
    );

-- Policy: Superadmin pode deletar usuários (se necessário)
CREATE POLICY "Superadmin pode deletar usuarios_permitidos"
    ON usuarios_permitidos
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios_permitidos up
            WHERE up.email = auth.jwt()->>'email'
            AND up.role = 'superadmin'
            AND up.ativo = true
        )
    );

-- ============================================
-- POLICIES: auditoria_acessos
-- Apenas superadmins podem ler
-- Escrita apenas via service role (server-side)
-- ============================================

-- Policy: Superadmin pode ler auditoria
CREATE POLICY "Superadmin pode ler auditoria_acessos"
    ON auditoria_acessos
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios_permitidos up
            WHERE up.email = auth.jwt()->>'email'
            AND up.role = 'superadmin'
            AND up.ativo = true
        )
    );

-- Auditoria: Inserção apenas via service role (sem policy para authenticated)
-- O servidor usará service_role_key para escrever

-- ============================================
-- SEED: Superadmins Iniciais
-- ============================================

-- Inserir superadmins iniciais (se não existirem)
INSERT INTO usuarios_permitidos (email, role, ativo, created_at)
VALUES 
    ('lucas@lebebe.com.br', 'superadmin', true, now()),
    ('robyson@lebebe.com.br', 'superadmin', true, now())
ON CONFLICT (email) DO UPDATE
SET 
    role = 'superadmin',
    ativo = true;

-- ============================================
-- FUNCTION: Validar que sempre existe pelo menos um superadmin ativo
-- ============================================
CREATE OR REPLACE FUNCTION validar_superadmin_ativo()
RETURNS TRIGGER AS $$
DECLARE
    superadmin_count INTEGER;
BEGIN
    -- Conta superadmins ativos após a operação
    IF TG_OP = 'DELETE' THEN
        SELECT COUNT(*) INTO superadmin_count
        FROM usuarios_permitidos
        WHERE role = 'superadmin' AND ativo = true AND id != OLD.id;
        
        IF superadmin_count = 0 THEN
            RAISE EXCEPTION 'Não é permitido remover o último superadmin ativo';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Se está tentando desativar ou mudar role de um superadmin
        IF OLD.role = 'superadmin' AND OLD.ativo = true THEN
            IF NEW.ativo = false OR NEW.role != 'superadmin' THEN
                SELECT COUNT(*) INTO superadmin_count
                FROM usuarios_permitidos
                WHERE role = 'superadmin' AND ativo = true AND id != OLD.id;
                
                IF superadmin_count = 0 THEN
                    RAISE EXCEPTION 'Não é permitido desativar ou alterar o último superadmin ativo';
                END IF;
            END IF;
        END IF;
        
        -- Proteger superadmins iniciais
        IF OLD.email IN ('lucas@lebebe.com.br', 'robyson@lebebe.com.br') THEN
            IF NEW.ativo = false THEN
                RAISE EXCEPTION 'Não é permitido desativar os superadmins iniciais';
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar superadmin
CREATE TRIGGER trigger_validar_superadmin_ativo
    BEFORE UPDATE OR DELETE ON usuarios_permitidos
    FOR EACH ROW
    EXECUTE FUNCTION validar_superadmin_ativo();

-- ============================================
-- FUNCTION: Helper para verificar se usuário pode acessar
-- ============================================
CREATE OR REPLACE FUNCTION pode_acessar_sistema(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    usuario_permitido BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM usuarios_permitidos
        WHERE LOWER(email) = LOWER(user_email)
        AND ativo = true
    ) INTO usuario_permitido;
    
    RETURN usuario_permitido;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Helper para obter role do usuário
-- ============================================
CREATE OR REPLACE FUNCTION obter_role_usuario(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM usuarios_permitidos
    WHERE LOWER(email) = LOWER(user_email)
    AND ativo = true;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMENTÁRIOS NAS TABELAS
-- ============================================
COMMENT ON TABLE usuarios_permitidos IS 'Lista de usuários permitidos a acessar o sistema';
COMMENT ON TABLE auditoria_acessos IS 'Log de auditoria de todas as ações no sistema';

COMMENT ON COLUMN usuarios_permitidos.email IS 'Email do usuário (sempre lowercase)';
COMMENT ON COLUMN usuarios_permitidos.role IS 'Papel do usuário: user ou superadmin';
COMMENT ON COLUMN usuarios_permitidos.ativo IS 'Se false, usuário está bloqueado';

COMMENT ON COLUMN auditoria_acessos.acao IS 'Tipo da ação realizada';
COMMENT ON COLUMN auditoria_acessos.email IS 'Email do usuário que realizou a ação';
COMMENT ON COLUMN auditoria_acessos.ip IS 'Endereço IP de origem';
COMMENT ON COLUMN auditoria_acessos.metadata IS 'Dados adicionais em formato JSON';
