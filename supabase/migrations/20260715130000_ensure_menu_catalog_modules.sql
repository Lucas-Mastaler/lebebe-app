-- Ensure menu-controlled modules present in the app_modulos catalog.
-- Idempotent catalog-only migration. Does not grant profile permissions.

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
VALUES
  (
    'digisac_finalizacoes_automaticas',
    'FINALIZACOES AUTOMATICAS DIGISAC',
    'Automacao de finalizacoes Digisac',
    '/digisac/finalizacoes-automaticas',
    'digisac',
    false,
    true,
    true,
    14
  ),
  (
    'procurar_datas_performance',
    'PERFORMANCE DATAS',
    'Diagnostico de performance do Procurar Datas',
    '/procurar-datas/performance',
    'interno',
    false,
    false,
    true,
    32
  )
ON CONFLICT (chave) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota_base = EXCLUDED.rota_base,
  categoria = EXCLUDED.categoria,
  publico = EXCLUDED.publico,
  somente_superadmin = EXCLUDED.somente_superadmin,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = now();
