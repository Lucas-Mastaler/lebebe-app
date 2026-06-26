-- Migration: Criar tabelas de auditoria operacional para /procurar-datas v2
-- Data: 2026-06-26
-- Autor: Cascade
-- Descricao: Tabelas separadas para auditoria operacional (pesquisas e pre-agendamentos)
--          Nao substitui search_execution_audit (telemetria/performance)

-- Tabela 1: Auditoria de pesquisas
CREATE TABLE IF NOT EXISTS public.procurar_datas_pesquisas_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Identificadores
  usuario_id uuid NULL,
  usuario_email text NOT NULL,
  client_token text NULL,
  run_id text NULL,
  
  -- Metadados
  motor_versao text NOT NULL DEFAULT 'v2',
  origem text NOT NULL DEFAULT 'procurar-datas-v2',
  
  -- Endereco estruturado
  cep text NULL,
  numero_residencia text NULL,
  logradouro text NULL,
  bairro text NULL,
  cidade text NULL,
  uf text NULL,
  endereco_completo text NULL,
  latitude numeric NULL,
  longitude numeric NULL,
  
  -- Parametros e resultados
  parametros_json jsonb NOT NULL DEFAULT '{}',
  resultados_json jsonb NULL,
  
  -- Status e performance
  status text NOT NULL,
  erro_mensagem text NULL,
  duracao_ms integer NULL,
  
  -- Vinculo com telemetria (opcional)
  search_execution_audit_id uuid NULL
);

-- Tabela 2: Auditoria de pre-agendamentos
CREATE TABLE IF NOT EXISTS public.procurar_datas_pre_agendamentos_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Vinculo com pesquisa
  pesquisa_auditoria_id uuid NULL,
  usuario_id uuid NULL,
  usuario_email text NOT NULL,
  client_token text NULL,
  run_id text NULL,
  
  -- Dados do pre-agendamento
  data_pre_agendada date NULL,
  tipo_resultado text NULL,
  resultado_escolhido_json jsonb NOT NULL,
  payload_pre_agendamento_json jsonb NULL,
  
  -- Status
  status text NOT NULL,
  erro_mensagem text NULL
);

-- Indices para pesquisas_auditoria
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pesquisas_auditoria_created_at 
  ON public.procurar_datas_pesquisas_auditoria (created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pesquisas_auditoria_usuario_email 
  ON public.procurar_datas_pesquisas_auditoria (usuario_email, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pesquisas_auditoria_cep 
  ON public.procurar_datas_pesquisas_auditoria (cep);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pesquisas_auditoria_cidade 
  ON public.procurar_datas_pesquisas_auditoria (cidade);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pesquisas_auditoria_uf 
  ON public.procurar_datas_pesquisas_auditoria (uf);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pesquisas_auditoria_client_token 
  ON public.procurar_datas_pesquisas_auditoria (client_token);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pesquisas_auditoria_run_id 
  ON public.procurar_datas_pesquisas_auditoria (run_id);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pesquisas_auditoria_status 
  ON public.procurar_datas_pesquisas_auditoria (status);

-- Indices para pre_agendamentos_auditoria
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pre_agendamentos_auditoria_created_at 
  ON public.procurar_datas_pre_agendamentos_auditoria (created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pre_agendamentos_auditoria_pesquisa_auditoria_id 
  ON public.procurar_datas_pre_agendamentos_auditoria (pesquisa_auditoria_id);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pre_agendamentos_auditoria_usuario_email 
  ON public.procurar_datas_pre_agendamentos_auditoria (usuario_email, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pre_agendamentos_auditoria_data_pre_agendada 
  ON public.procurar_datas_pre_agendamentos_auditoria (data_pre_agendada);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pre_agendamentos_auditoria_status 
  ON public.procurar_datas_pre_agendamentos_auditoria (status);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pre_agendamentos_auditoria_client_token 
  ON public.procurar_datas_pre_agendamentos_auditoria (client_token);
  
CREATE INDEX IF NOT EXISTS idx_procurar_datas_pre_agendamentos_auditoria_run_id 
  ON public.procurar_datas_pre_agendamentos_auditoria (run_id);

-- Habilitar RLS nas duas tabelas
ALTER TABLE public.procurar_datas_pesquisas_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurar_datas_pre_agendamentos_auditoria ENABLE ROW LEVEL SECURITY;

-- Policies: SELECT apenas para superadmin (mesmo padrao auditoria_acessos)
-- INSERT bloqueado para anon/auth (apenas service_role pode inserir via backend)

-- Policy para pesquisas_auditoria
CREATE POLICY "pesquisas_auditoria_select_superadmin" ON public.procurar_datas_pesquisas_auditoria
  FOR SELECT USING (is_superadmin());

-- Policy para pre_agendamentos_auditoria  
CREATE POLICY "pre_agendamentos_auditoria_select_superadmin" ON public.procurar_datas_pre_agendamentos_auditoria
  FOR SELECT USING (is_superadmin());

-- Chave estrangeira opcional para search_execution_audit (se existir)
-- ALTER TABLE public.procurar_datas_pesquisas_auditoria 
--   ADD CONSTRAINT fk_pesquisas_audit_search_execution_audit 
--   FOREIGN KEY (search_execution_audit_id) 
--   REFERENCES public.search_execution_audit(id) 
--   ON DELETE SET NULL;

-- Comentarios
COMMENT ON TABLE public.procurar_datas_pesquisas_auditoria IS 'Auditoria operacional de pesquisas da tela /procurar-datas v2. Separa da telemetria (search_execution_audit).';
COMMENT ON TABLE public.procurar_datas_pre_agendamentos_auditoria IS 'Auditoria operacional de pre-agendamentos vinculados a pesquisas da tela /procurar-datas v2.';
COMMENT ON COLUMN public.procurar_datas_pesquisas_auditoria.parametros_json IS 'Parametros completos da tela: dataInicial, encomenda, areaRural, condominio, bercoCama, comoda, roupeiro, poltrona, painel, tempoNecessario, valorInicialMinimo';
COMMENT ON COLUMN public.procurar_datas_pesquisas_auditoria.resultados_json IS 'Resultados exatamente como mostrados ao usuario (array de CandidatoFinal)';
COMMENT ON COLUMN public.procurar_datas_pre_agendamentos_auditoria.resultado_escolhido_json IS 'Candidato completo escolhido pelo usuario para pre-agendamento';
COMMENT ON COLUMN public.procurar_datas_pre_agendamentos_auditoria.payload_pre_agendamento_json IS 'Payload completo enviado para a rota de pre-agendamento';
