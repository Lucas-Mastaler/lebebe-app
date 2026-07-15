-- Create the Atendimento Presencial draft attendances table.
-- Fase 3: basic draft structure only. No completed attendance workflow.

CREATE TABLE IF NOT EXISTS public.atendimento_presencial_atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.atendimento_presencial_clientes(id) ON DELETE SET NULL,
  consultora_usuario_id uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  unidade_id uuid NOT NULL REFERENCES public.app_unidades(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'rascunho',
  draft_client_id uuid NOT NULL,
  dados_rascunho jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  ultima_atividade_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '5 days'),
  version integer NOT NULL DEFAULT 1,
  criado_por uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  atualizado_por uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atendimento_presencial_atendimentos_status_check
    CHECK (status IN ('rascunho')),
  CONSTRAINT atendimento_presencial_atendimentos_version_check
    CHECK (version >= 1),
  CONSTRAINT atendimento_presencial_atendimentos_expira_check
    CHECK (expira_em >= ultima_atividade_em),
  CONSTRAINT atendimento_presencial_atendimentos_dados_check
    CHECK (
      jsonb_typeof(dados_rascunho) = 'object'
      AND pg_column_size(dados_rascunho) <= 8192
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_atendimento_presencial_atendimentos_draft_client_id
  ON public.atendimento_presencial_atendimentos (draft_client_id);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_atendimentos_status_expira
  ON public.atendimento_presencial_atendimentos (status, expira_em);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_atendimentos_consultora
  ON public.atendimento_presencial_atendimentos (consultora_usuario_id);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_atendimentos_unidade
  ON public.atendimento_presencial_atendimentos (unidade_id);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_atendimentos_cliente
  ON public.atendimento_presencial_atendimentos (cliente_id)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_atendimentos_criado_por
  ON public.atendimento_presencial_atendimentos (criado_por);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_atendimentos_atualizado_por
  ON public.atendimento_presencial_atendimentos (atualizado_por);

CREATE OR REPLACE FUNCTION public.atendimento_presencial_atendimentos_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_atendimento_presencial_atendimentos_touch
  ON public.atendimento_presencial_atendimentos;

CREATE TRIGGER trg_atendimento_presencial_atendimentos_touch
  BEFORE UPDATE ON public.atendimento_presencial_atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.atendimento_presencial_atendimentos_touch();

ALTER TABLE public.atendimento_presencial_atendimentos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.atendimento_presencial_atendimentos FROM anon, authenticated;

DROP POLICY IF EXISTS atendimento_presencial_atendimentos_no_direct_select
  ON public.atendimento_presencial_atendimentos;
DROP POLICY IF EXISTS atendimento_presencial_atendimentos_no_direct_insert
  ON public.atendimento_presencial_atendimentos;
DROP POLICY IF EXISTS atendimento_presencial_atendimentos_no_direct_update
  ON public.atendimento_presencial_atendimentos;
DROP POLICY IF EXISTS atendimento_presencial_atendimentos_no_direct_delete
  ON public.atendimento_presencial_atendimentos;

CREATE POLICY atendimento_presencial_atendimentos_no_direct_select
  ON public.atendimento_presencial_atendimentos
  FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY atendimento_presencial_atendimentos_no_direct_insert
  ON public.atendimento_presencial_atendimentos
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY atendimento_presencial_atendimentos_no_direct_update
  ON public.atendimento_presencial_atendimentos
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY atendimento_presencial_atendimentos_no_direct_delete
  ON public.atendimento_presencial_atendimentos
  FOR DELETE
  TO authenticated
  USING (false);

GRANT ALL ON public.atendimento_presencial_atendimentos TO service_role;
