-- ============================================================
-- MIGRATION: seed_procurar_datas_auditoria_module
-- Frente 0 / Controle
--
-- Cria o modulo da tela read-only de auditoria operacional de
-- /procurar-datas v2 no modelo atual de permissoes.
-- ============================================================

INSERT INTO public.app_modulos (
    chave,
    nome,
    descricao,
    rota_base,
    categoria,
    publico,
    somente_superadmin,
    ativo,
    ordem
)
VALUES (
    'procurar_datas_auditoria',
    'AUDITORIA PROCURAR DATAS',
    'Consulta read-only de pesquisas e pre-agendamentos auditados da tela Procurar Datas',
    '/procurar-datas/auditoria',
    'interno',
    false,
    false,
    true,
    31
)
ON CONFLICT (chave)
DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    rota_base = EXCLUDED.rota_base,
    categoria = EXCLUDED.categoria,
    publico = EXCLUDED.publico,
    somente_superadmin = EXCLUDED.somente_superadmin,
    ativo = EXCLUDED.ativo,
    ordem = EXCLUDED.ordem,
    updated_at = now();

INSERT INTO public.app_permissoes_perfil (perfil_id, modulo_id, permitido)
SELECT
    p.id,
    m.id,
    matrix.permitido
FROM (
    VALUES
        ('consultora', false),
        ('supervisora_loja', false),
        ('pos_venda', false),
        ('gestao', true)
) AS matrix(chave_perfil, permitido)
JOIN public.app_perfis_acesso p ON p.chave = matrix.chave_perfil
JOIN public.app_modulos m ON m.chave = 'procurar_datas_auditoria'
ON CONFLICT (perfil_id, modulo_id)
DO UPDATE SET
    permitido = EXCLUDED.permitido,
    updated_at = now();
