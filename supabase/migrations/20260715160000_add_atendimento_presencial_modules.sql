-- Add Atendimento Presencial modules to the app_modulos catalog.
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
    'atendimento_presencial_ficha',
    'Ficha de Atendimento',
    'Placeholder protegido da ficha de atendimento presencial',
    '/atendimento-presencial/ficha',
    'atendimento_presencial',
    false,
    false,
    true,
    61
  ),
  (
    'atendimento_presencial_registros',
    'Registros de Atendimentos',
    'Placeholder protegido dos registros de atendimentos presenciais',
    '/atendimento-presencial/registros',
    'atendimento_presencial',
    false,
    false,
    true,
    62
  ),
  (
    'atendimento_presencial_clientes',
    'Clientes',
    'Placeholder protegido de clientes do atendimento presencial',
    '/atendimento-presencial/clientes',
    'atendimento_presencial',
    false,
    false,
    true,
    63
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
