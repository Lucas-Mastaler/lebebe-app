-- Cadastro apenas. Liberação de perfis é manual; não altera dados de atendimentos/RLS.
INSERT INTO public.app_modulos
  (chave, nome, descricao, rota_base, categoria, publico, somente_superadmin, ativo, ordem)
VALUES
  ('atendimento_presencial_fluxo_lojas', 'Fluxo das lojas',
   'Comparação de grupos AlterVision e Pranchetas concluídas',
   '/atendimento-presencial/fluxo-lojas', 'atendimento_presencial', false, false, true, 64)
ON CONFLICT (chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota_base = EXCLUDED.rota_base,
  categoria = EXCLUDED.categoria,
  publico = EXCLUDED.publico,
  somente_superadmin = EXCLUDED.somente_superadmin,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem;
