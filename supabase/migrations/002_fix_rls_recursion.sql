-- ============================================
-- MIGRATION 002: Fix RLS Recursion
-- Corrige a recursão infinita nas políticas RLS
-- ============================================

-- ============================================
-- PASSO 1: Remover políticas com recursão
-- ============================================
DROP POLICY IF EXISTS "Superadmin pode ler usuarios_permitidos" ON usuarios_permitidos;
DROP POLICY IF EXISTS "Superadmin pode inserir usuarios_permitidos" ON usuarios_permitidos;
DROP POLICY IF EXISTS "Superadmin pode atualizar usuarios_permitidos" ON usuarios_permitidos;
DROP POLICY IF EXISTS "Superadmin pode deletar usuarios_permitidos" ON usuarios_permitidos;
DROP POLICY IF EXISTS "Superadmin pode ler auditoria_acessos" ON auditoria_acessos;

-- ============================================
-- PASSO 2: Criar função SECURITY DEFINER
-- Esta função bypassa RLS para verificar superadmin
-- ============================================
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
DECLARE
    user_email TEXT;
    is_admin BOOLEAN;
BEGIN
    -- Pega o email do JWT do usuário autenticado
    user_email := auth.jwt()->>'email';
    
    IF user_email IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verifica se é superadmin (SECURITY DEFINER bypassa RLS)
    SELECT EXISTS (
        SELECT 1 FROM usuarios_permitidos
        WHERE LOWER(email) = LOWER(user_email)
        AND role = 'superadmin'
        AND ativo = true
    ) INTO is_admin;
    
    RETURN COALESCE(is_admin, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PASSO 3: Criar função para verificar se usuário pode se ver
-- Usuário pode ler seu próprio registro
-- ============================================
CREATE OR REPLACE FUNCTION is_own_record(record_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_email TEXT;
BEGIN
    user_email := auth.jwt()->>'email';
    
    IF user_email IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN LOWER(user_email) = LOWER(record_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PASSO 4: Novas políticas para usuarios_permitidos
-- Usando funções SECURITY DEFINER (sem recursão)
-- ============================================

-- Superadmin pode ler todos, usuário pode ler só o próprio
CREATE POLICY "usuarios_permitidos_select"
    ON usuarios_permitidos
    FOR SELECT
    TO authenticated
    USING (
        is_superadmin() OR is_own_record(email)
    );

-- Apenas superadmin pode inserir
CREATE POLICY "usuarios_permitidos_insert"
    ON usuarios_permitidos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        is_superadmin()
    );

-- Apenas superadmin pode atualizar
CREATE POLICY "usuarios_permitidos_update"
    ON usuarios_permitidos
    FOR UPDATE
    TO authenticated
    USING (
        is_superadmin()
    )
    WITH CHECK (
        is_superadmin()
    );

-- Apenas superadmin pode deletar
CREATE POLICY "usuarios_permitidos_delete"
    ON usuarios_permitidos
    FOR DELETE
    TO authenticated
    USING (
        is_superadmin()
    );

-- ============================================
-- PASSO 5: Nova política para auditoria_acessos
-- ============================================

-- Apenas superadmin pode ler auditoria
CREATE POLICY "auditoria_acessos_select"
    ON auditoria_acessos
    FOR SELECT
    TO authenticated
    USING (
        is_superadmin()
    );

-- ============================================
-- PASSO 6: Garantir que service_role pode tudo
-- (Por padrão já pode, mas vamos garantir)
-- ============================================

-- Grant para service_role poder inserir auditoria
GRANT INSERT ON auditoria_acessos TO service_role;
GRANT ALL ON usuarios_permitidos TO service_role;
GRANT ALL ON auditoria_acessos TO service_role;

-- ============================================
-- VERIFICAÇÃO: Testar se os superadmins existem
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM usuarios_permitidos 
        WHERE email = 'lucas@lebebe.com.br' AND role = 'superadmin' AND ativo = true
    ) THEN
        INSERT INTO usuarios_permitidos (email, role, ativo)
        VALUES ('lucas@lebebe.com.br', 'superadmin', true)
        ON CONFLICT (email) DO UPDATE SET role = 'superadmin', ativo = true;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM usuarios_permitidos 
        WHERE email = 'robyson@lebebe.com.br' AND role = 'superadmin' AND ativo = true
    ) THEN
        INSERT INTO usuarios_permitidos (email, role, ativo)
        VALUES ('robyson@lebebe.com.br', 'superadmin', true)
        ON CONFLICT (email) DO UPDATE SET role = 'superadmin', ativo = true;
    END IF;
END $$;
