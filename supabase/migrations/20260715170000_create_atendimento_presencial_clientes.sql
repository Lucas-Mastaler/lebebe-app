-- Create the Atendimento Presencial clients base table.
-- Fase 2: client identity, phone normalization and duplicate prevention only.

CREATE TABLE IF NOT EXISTS public.atendimento_presencial_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone_informado text,
  telefone_normalizado text,
  telefone_normalizado_ddi text,
  parentesco text NOT NULL,
  parentesco_outro text,
  status text NOT NULL DEFAULT 'ativo',
  version integer NOT NULL DEFAULT 1,
  criado_por uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  atualizado_por uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atendimento_presencial_clientes_nome_check
    CHECK (char_length(btrim(nome)) BETWEEN 2 AND 120),
  CONSTRAINT atendimento_presencial_clientes_parentesco_check
    CHECK (
      parentesco IN (
        'mae',
        'pai',
        'avo_masculino',
        'avo_feminino',
        'tio',
        'tia',
        'irmao',
        'irma',
        'padrinho',
        'madrinha',
        'amigo',
        'amiga',
        'outro'
      )
    ),
  CONSTRAINT atendimento_presencial_clientes_parentesco_outro_check
    CHECK (
      (
        parentesco = 'outro'
        AND parentesco_outro IS NOT NULL
        AND char_length(btrim(parentesco_outro)) BETWEEN 2 AND 60
      )
      OR (
        parentesco <> 'outro'
        AND parentesco_outro IS NULL
      )
    ),
  CONSTRAINT atendimento_presencial_clientes_status_check
    CHECK (status IN ('ativo', 'inativo')),
  CONSTRAINT atendimento_presencial_clientes_telefone_check
    CHECK (
      telefone_normalizado IS NULL
      OR (
        telefone_normalizado ~ '^[0-9]{10,11}$'
        AND telefone_normalizado_ddi = ('55' || telefone_normalizado)
      )
    ),
  CONSTRAINT atendimento_presencial_clientes_version_check
    CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_clientes_nome
  ON public.atendimento_presencial_clientes (lower(nome));

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_clientes_telefone
  ON public.atendimento_presencial_clientes (telefone_normalizado)
  WHERE telefone_normalizado IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_atendimento_presencial_clientes_telefone_ativo
  ON public.atendimento_presencial_clientes (telefone_normalizado)
  WHERE status = 'ativo'
    AND telefone_normalizado IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_clientes_criado_por
  ON public.atendimento_presencial_clientes (criado_por);

CREATE OR REPLACE FUNCTION public.atendimento_presencial_clientes_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atendimento_presencial_clientes_touch
  ON public.atendimento_presencial_clientes;

CREATE TRIGGER trg_atendimento_presencial_clientes_touch
  BEFORE UPDATE ON public.atendimento_presencial_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.atendimento_presencial_clientes_touch();

ALTER TABLE public.atendimento_presencial_clientes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.atendimento_presencial_clientes FROM anon, authenticated;

DROP POLICY IF EXISTS atendimento_presencial_clientes_no_direct_select
  ON public.atendimento_presencial_clientes;
DROP POLICY IF EXISTS atendimento_presencial_clientes_no_direct_insert
  ON public.atendimento_presencial_clientes;
DROP POLICY IF EXISTS atendimento_presencial_clientes_no_direct_update
  ON public.atendimento_presencial_clientes;

CREATE POLICY atendimento_presencial_clientes_no_direct_select
  ON public.atendimento_presencial_clientes
  FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY atendimento_presencial_clientes_no_direct_insert
  ON public.atendimento_presencial_clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY atendimento_presencial_clientes_no_direct_update
  ON public.atendimento_presencial_clientes
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

GRANT ALL ON public.atendimento_presencial_clientes TO service_role;
