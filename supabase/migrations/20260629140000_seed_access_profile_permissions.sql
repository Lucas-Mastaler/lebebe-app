-- ============================================================
-- MIGRATION: seed_access_profile_permissions
-- Fase 2A.1 — popular permissoes iniciais por perfil e desativar perfil recebimento
-- Referencia: docs/ia/plano-fase-0-7-modelagem-permissoes-usuarios.md
--
-- Acoes:
--   1. Desativar app_perfis_acesso onde chave = 'recebimento'
--   2. Inserir/atualizar permissoes em app_permissoes_perfil conforme matriz aprovada
--
-- Modulos controlados (apenas somente_superadmin=false e publico=false):
--   dashboard, agendamentos, procurar_datas, chamados_finalizados,
--   inteligencia_comercial, pos_venda, recebimento
--
-- Modulos excluidos da matriz (nao entram em permissoes de perfil):
--   superadmin        -> somente_superadmin=true (acesso por role, nao por perfil)
--   configuracoes     -> somente_superadmin=true (acesso por role, nao por perfil)
--   horarios_agendamentos -> publico=true (sem controle de login)
--
-- Matriz aprovada:
--   consultora:      procurar_datas=true; demais=false
--   supervisora_loja: dashboard, agendamentos, procurar_datas, chamados_finalizados, inteligencia_comercial=true; pos_venda, recebimento=false
--   pos_venda:       procurar_datas, pos_venda, recebimento=true; demais=false
--   gestao:          todos=true
--   recebimento:     desativado (ativo=false); permissoes nao inseridas
--
-- ROLLBACK (nao executar automaticamente):
--   UPDATE public.app_perfis_acesso SET ativo = true WHERE chave = 'recebimento';
--   DELETE FROM public.app_permissoes_perfil
--     WHERE perfil_id IN (SELECT id FROM public.app_perfis_acesso WHERE chave IN ('consultora','supervisora_loja','pos_venda','gestao'));
-- ============================================================


-- ============================================================
-- 1. Desativar perfil recebimento
-- Seguro: 0 usuarios vinculados confirmado antes desta migration.
-- ============================================================
UPDATE public.app_perfis_acesso
SET ativo = false
WHERE chave = 'recebimento';


-- ============================================================
-- 2. Seed de permissoes por perfil
-- Usa chaves de perfil e modulo para evitar hardcode de UUID.
-- ON CONFLICT (perfil_id, modulo_id) DO UPDATE garante idempotencia.
-- Inclui apenas modulos somente_superadmin=false e publico=false.
-- ============================================================

-- Matriz de permissoes: (chave_perfil, chave_modulo, permitido)
INSERT INTO public.app_permissoes_perfil (perfil_id, modulo_id, permitido)
SELECT
    p.id AS perfil_id,
    m.id AS modulo_id,
    matrix.permitido
FROM (
    VALUES
        -- consultora: apenas procurar_datas liberado
        ('consultora', 'dashboard',              false),
        ('consultora', 'agendamentos',           false),
        ('consultora', 'procurar_datas',         true),
        ('consultora', 'chamados_finalizados',   false),
        ('consultora', 'inteligencia_comercial', false),
        ('consultora', 'pos_venda',              false),
        ('consultora', 'recebimento',            false),

        -- supervisora_loja: dashboard, agendamentos, procurar_datas, chamados_finalizados, inteligencia_comercial
        ('supervisora_loja', 'dashboard',              true),
        ('supervisora_loja', 'agendamentos',           true),
        ('supervisora_loja', 'procurar_datas',         true),
        ('supervisora_loja', 'chamados_finalizados',   true),
        ('supervisora_loja', 'inteligencia_comercial', true),
        ('supervisora_loja', 'pos_venda',              false),
        ('supervisora_loja', 'recebimento',            false),

        -- pos_venda: procurar_datas, pos_venda, recebimento
        ('pos_venda', 'dashboard',              false),
        ('pos_venda', 'agendamentos',           false),
        ('pos_venda', 'procurar_datas',         true),
        ('pos_venda', 'chamados_finalizados',   false),
        ('pos_venda', 'inteligencia_comercial', false),
        ('pos_venda', 'pos_venda',              true),
        ('pos_venda', 'recebimento',            true),

        -- gestao: todos permitidos
        ('gestao', 'dashboard',              true),
        ('gestao', 'agendamentos',           true),
        ('gestao', 'procurar_datas',         true),
        ('gestao', 'chamados_finalizados',   true),
        ('gestao', 'inteligencia_comercial', true),
        ('gestao', 'pos_venda',              true),
        ('gestao', 'recebimento',            true)

) AS matrix(chave_perfil, chave_modulo, permitido)
JOIN public.app_perfis_acesso p ON p.chave = matrix.chave_perfil
JOIN public.app_modulos       m ON m.chave = matrix.chave_modulo
ON CONFLICT (perfil_id, modulo_id)
DO UPDATE SET
    permitido  = EXCLUDED.permitido,
    updated_at = now();
