-- ============================================================
-- MIGRATION: create_atendimento_automatico_posvenda_tables
-- Fase 1A — Atendimento Automatico Pos-Venda (Mere)
-- Referencia: docs/atendimento-automatico-posvenda-mere-plano.md
--
-- Cria 4 tabelas novas:
--   atendimento_automatico_sessoes
--   atendimento_automatico_mensagens
--   atendimento_automatico_eventos
--   atendimento_automatico_bloqueios
--
-- RLS: apenas superadmin (via is_superadmin())
-- Modulo: pos_venda_atendimento_automatico (somente_superadmin=true)
--
-- NOTA: Aplicada via MCP Supabase em 2026-07-07 (version 20260707201710).
-- Os triggers de updated_at foram aplicados em migration separada
-- (20260707203049_add_updated_at_triggers_atendimento_automatico.sql).
-- Este arquivo reflete o estado real aplicado no banco.
--
-- ROLLBACK (nao executar automaticamente):
--   DROP TABLE IF EXISTS public.atendimento_automatico_bloqueios CASCADE;
--   DROP TABLE IF EXISTS public.atendimento_automatico_eventos CASCADE;
--   DROP TABLE IF EXISTS public.atendimento_automatico_mensagens CASCADE;
--   DROP TABLE IF EXISTS public.atendimento_automatico_sessoes CASCADE;
--   DELETE FROM public.app_modulos WHERE chave = 'pos_venda_atendimento_automatico';
-- ============================================================


-- ============================================================
-- 1. TABELA: atendimento_automatico_sessoes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_automatico_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digisac_ticket_id text NOT NULL,
  digisac_contact_id text,
  digisac_service_id text,
  digisac_department_id text,
  telefone text,
  cliente_nome text,
  status text NOT NULL DEFAULT 'ativa',
  estado text NOT NULL DEFAULT 'inicio',
  tipo_solicitacao text,
  documento_informado text,
  pedido_encontrado boolean DEFAULT false,
  pedido_confirmado boolean DEFAULT false,
  endereco_confirmado boolean DEFAULT false,
  chamou_procurar_datas boolean DEFAULT false,
  datas_candidatas jsonb,
  data_escolhida text,
  alterou_agenda boolean DEFAULT false,
  motivo_falha text,
  pausa_ate timestamptz,
  bloqueio_permanente boolean DEFAULT false,
  ultima_mensagem_cliente text,
  ultima_mensagem_bot text,
  ultima_mensagem_em timestamptz,
  resumo_contexto text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_atendimento_auto_sessoes_ticket_id
  ON public.atendimento_automatico_sessoes (digisac_ticket_id);

CREATE INDEX IF NOT EXISTS idx_atendimento_auto_sessoes_status
  ON public.atendimento_automatico_sessoes (status);

CREATE INDEX IF NOT EXISTS idx_atendimento_auto_sessoes_contact_id
  ON public.atendimento_automatico_sessoes (digisac_contact_id);


-- ============================================================
-- 2. TABELA: atendimento_automatico_mensagens
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_automatico_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.atendimento_automatico_sessoes(id) ON DELETE CASCADE,
  digisac_message_id text NOT NULL,
  digisac_ticket_id text,
  digisac_contact_id text,
  origem text NOT NULL,
  texto text,
  tipo_mensagem text,
  timestamp_digisac timestamptz,
  timestamp_recebimento timestamptz DEFAULT now(),
  status text DEFAULT 'pendente',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_atendimento_auto_msgs_message_id
  ON public.atendimento_automatico_mensagens (digisac_message_id);

CREATE INDEX IF NOT EXISTS idx_atendimento_auto_msgs_sessao_id
  ON public.atendimento_automatico_mensagens (sessao_id);

CREATE INDEX IF NOT EXISTS idx_atendimento_auto_msgs_status
  ON public.atendimento_automatico_mensagens (status);


-- ============================================================
-- 3. TABELA: atendimento_automatico_eventos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_automatico_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.atendimento_automatico_sessoes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atendimento_auto_eventos_sessao_id
  ON public.atendimento_automatico_eventos (sessao_id);


-- ============================================================
-- 4. TABELA: atendimento_automatico_bloqueios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_automatico_bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digisac_contact_id text,
  telefone text,
  tipo text NOT NULL,
  motivo text,
  bloqueado_por text,
  bloqueado_ate timestamptz,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atendimento_auto_bloqueios_contact_id
  ON public.atendimento_automatico_bloqueios (digisac_contact_id);

CREATE INDEX IF NOT EXISTS idx_atendimento_auto_bloqueios_ativo
  ON public.atendimento_automatico_bloqueios (ativo);


-- ============================================================
-- 5. RLS — todas as tabelas: apenas superadmin
-- ============================================================

ALTER TABLE public.atendimento_automatico_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_automatico_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_automatico_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_automatico_bloqueios ENABLE ROW LEVEL SECURITY;

-- Sessoes
DROP POLICY IF EXISTS aas_select_superadmin ON public.atendimento_automatico_sessoes;
CREATE POLICY aas_select_superadmin ON public.atendimento_automatico_sessoes
  FOR SELECT TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS aas_insert_superadmin ON public.atendimento_automatico_sessoes;
CREATE POLICY aas_insert_superadmin ON public.atendimento_automatico_sessoes
  FOR INSERT TO authenticated WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS aas_update_superadmin ON public.atendimento_automatico_sessoes;
CREATE POLICY aas_update_superadmin ON public.atendimento_automatico_sessoes
  FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS aas_delete_superadmin ON public.atendimento_automatico_sessoes;
CREATE POLICY aas_delete_superadmin ON public.atendimento_automatico_sessoes
  FOR DELETE TO authenticated USING (is_superadmin());

-- Mensagens
DROP POLICY IF EXISTS aam_select_superadmin ON public.atendimento_automatico_mensagens;
CREATE POLICY aam_select_superadmin ON public.atendimento_automatico_mensagens
  FOR SELECT TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS aam_insert_superadmin ON public.atendimento_automatico_mensagens;
CREATE POLICY aam_insert_superadmin ON public.atendimento_automatico_mensagens
  FOR INSERT TO authenticated WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS aam_update_superadmin ON public.atendimento_automatico_mensagens;
CREATE POLICY aam_update_superadmin ON public.atendimento_automatico_mensagens
  FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS aam_delete_superadmin ON public.atendimento_automatico_mensagens;
CREATE POLICY aam_delete_superadmin ON public.atendimento_automatico_mensagens
  FOR DELETE TO authenticated USING (is_superadmin());

-- Eventos
DROP POLICY IF EXISTS aae_select_superadmin ON public.atendimento_automatico_eventos;
CREATE POLICY aae_select_superadmin ON public.atendimento_automatico_eventos
  FOR SELECT TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS aae_insert_superadmin ON public.atendimento_automatico_eventos;
CREATE POLICY aae_insert_superadmin ON public.atendimento_automatico_eventos
  FOR INSERT TO authenticated WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS aae_update_superadmin ON public.atendimento_automatico_eventos;
CREATE POLICY aae_update_superadmin ON public.atendimento_automatico_eventos
  FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS aae_delete_superadmin ON public.atendimento_automatico_eventos;
CREATE POLICY aae_delete_superadmin ON public.atendimento_automatico_eventos
  FOR DELETE TO authenticated USING (is_superadmin());

-- Bloqueios
DROP POLICY IF EXISTS aab_select_superadmin ON public.atendimento_automatico_bloqueios;
CREATE POLICY aab_select_superadmin ON public.atendimento_automatico_bloqueios
  FOR SELECT TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS aab_insert_superadmin ON public.atendimento_automatico_bloqueios;
CREATE POLICY aab_insert_superadmin ON public.atendimento_automatico_bloqueios
  FOR INSERT TO authenticated WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS aab_update_superadmin ON public.atendimento_automatico_bloqueios;
CREATE POLICY aab_update_superadmin ON public.atendimento_automatico_bloqueios
  FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS aab_delete_superadmin ON public.atendimento_automatico_bloqueios;
CREATE POLICY aab_delete_superadmin ON public.atendimento_automatico_bloqueios
  FOR DELETE TO authenticated USING (is_superadmin());


-- ============================================================
-- 6. Cadastro do modulo em app_modulos
-- ============================================================
INSERT INTO public.app_modulos (chave, nome, rota_base, publico, somente_superadmin, ativo, ordem)
VALUES ('pos_venda_atendimento_automatico', 'ATENDIMENTO AUTOMATICO POS-VENDA', '/pos-venda/atendimento-automatico', false, true, true, 61)
ON CONFLICT (chave) DO NOTHING;
