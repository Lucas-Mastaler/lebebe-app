-- =========================================================
-- MIGRATION 017: Habilita RLS na tabela recebimento_os
-- A tabela foi criada na migration 013 sem RLS.
-- Políticas espelham o padrão das demais tabelas do módulo.
-- =========================================================

ALTER TABLE recebimento_os ENABLE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS "recebimento_os_select" ON recebimento_os;
CREATE POLICY "recebimento_os_select" ON recebimento_os
  FOR SELECT USING (is_matic_user());

-- INSERT
DROP POLICY IF EXISTS "recebimento_os_insert" ON recebimento_os;
CREATE POLICY "recebimento_os_insert" ON recebimento_os
  FOR INSERT WITH CHECK (is_matic_user());

-- UPDATE
DROP POLICY IF EXISTS "recebimento_os_update" ON recebimento_os;
CREATE POLICY "recebimento_os_update" ON recebimento_os
  FOR UPDATE USING (is_matic_user()) WITH CHECK (is_matic_user());