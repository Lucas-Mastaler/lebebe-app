-- Align profile permission module ordering with the sidebar visual order.
-- Catalog-only migration. Does not modify saved profile permissions.

UPDATE public.app_modulos AS m
SET
  ordem = v.ordem,
  updated_at = now()
FROM (
  VALUES
    ('dashboard', 10),
    ('agendamentos', 20),
    ('horarios_agendamentos', 30),
    ('chamados_finalizados', 40),
    ('inteligencia_comercial', 50),
    ('digisac_finalizacoes_automaticas', 60),
    ('procurar_datas', 70),
    ('procurar_datas_auditoria', 80),
    ('procurar_datas_performance', 90),
    ('configuracoes_procurar_datas', 100),
    ('recebimento', 110),
    ('pos_venda', 120),
    ('pos_venda_atendimento_automatico', 130),
    ('superadmin_usuarios', 140),
    ('superadmin', 150),
    ('configuracoes', 160)
) AS v(chave, ordem)
WHERE m.chave = v.chave
  AND m.ordem IS DISTINCT FROM v.ordem;
