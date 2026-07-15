-- Fix profile-visible menu modules in app_modulos.
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
    'horarios_agendamentos',
    'HORARIOS AGENDAMENTOS',
    'Consulta de horarios disponiveis',
    '/horarios-agendamentos',
    'interno',
    false,
    false,
    true,
    21
  ),
  (
    'digisac_finalizacoes_automaticas',
    'FINALIZACOES AUTOMATICAS DIGISAC',
    'Automacao de finalizacoes Digisac',
    '/digisac/finalizacoes-automaticas',
    'digisac',
    false,
    false,
    true,
    14
  ),
  (
    'configuracoes_procurar_datas',
    'CONFIG BUSCA',
    'Configuracoes operacionais do Procurar Datas',
    '/configuracoes/procurar-datas',
    'interno',
    false,
    false,
    true,
    33
  ),
  (
    'pos_venda_atendimento_automatico',
    'ATENDIMENTO AUTOMATICO POS-VENDA',
    'Atendimento automatico de pos-venda',
    '/pos-venda/atendimento-automatico',
    'interno',
    false,
    false,
    true,
    61
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
