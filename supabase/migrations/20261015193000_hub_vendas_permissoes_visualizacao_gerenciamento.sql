-- Separa o Hub Vendas em visualização e gerenciamento configuráveis por perfil.
-- Não concede gerenciamento aos perfis que já tinham visualização.
-- A ausência de linha em app_permissoes_perfil continua significando bloqueado.

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
  'hub_vendas_recuperacao',
  'HUB VENDAS — VISUALIZAÇÃO',
  'Consulta de indicadores, status, filas, detalhes e alertas do Hub Vendas',
  '/hub-vendas',
  'digisac',
  false,
  false,
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
  'hub_vendas_gestao',
  'HUB VENDAS — GERENCIAMENTO',
  'Pausa, reativação, limites, ações de fila e testes de alerta do Hub Vendas',
  '/hub-vendas',
  'digisac',
  false,
  false,
  true,
  65
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
