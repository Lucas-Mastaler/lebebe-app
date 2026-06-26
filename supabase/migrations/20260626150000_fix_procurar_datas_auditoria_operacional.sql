-- Migration corretiva para tabelas de auditoria operacional
-- Problemas identificados:
-- 1. Campo search_execution_audit_id era uuid mas deveria ser bigint (ou não existir)
-- 2. Faltavam campos started_at e finished_at que o helper tentava inserir
-- 3. Decisão: remover search_execution_audit_id (vínculo por run_id é suficiente)

-- Remover campo search_execution_audit_id (tipo incorreto e desnecessário)
ALTER TABLE public.procurar_datas_pesquisas_auditoria 
  DROP COLUMN IF EXISTS search_execution_audit_id;

-- Adicionar campos started_at e finished_at para tracking de tempo
ALTER TABLE public.procurar_datas_pesquisas_auditoria 
  ADD COLUMN IF NOT EXISTS started_at timestamptz NULL;

ALTER TABLE public.procurar_datas_pesquisas_auditoria 
  ADD COLUMN IF NOT EXISTS finished_at timestamptz NULL;

-- Comentário atualizado
COMMENT ON TABLE public.procurar_datas_pesquisas_auditoria IS 'Auditoria operacional de pesquisas da tela /procurar-datas v2. Separa da telemetria (search_execution_audit). Vinculo com telemetria via run_id e client_token.';
