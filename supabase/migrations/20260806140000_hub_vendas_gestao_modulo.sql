-- Novo módulo administrativo para a tela de gestão/monitoramento do Hub/Vendas.
-- Acesso exclusivo de superadmin (somente_superadmin = true) para proteger
-- a automação ativa em produção.
INSERT INTO app_modulos (chave, nome, descricao, rota_base, categoria, publico, somente_superadmin, ativo, ordem)
VALUES (
  'hub_vendas_gestao',
  'GESTAO HUB VENDAS',
  'Tela administrativa de gestao, monitoramento e configuracao da automacao Hub/Vendas',
  '/hub-vendas',
  'admin',
  false,
  true,
  true,
  64
)
ON CONFLICT (chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota_base = EXCLUDED.rota_base,
  categoria = EXCLUDED.categoria,
  publico = EXCLUDED.publico,
  somente_superadmin = EXCLUDED.somente_superadmin,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = now();
