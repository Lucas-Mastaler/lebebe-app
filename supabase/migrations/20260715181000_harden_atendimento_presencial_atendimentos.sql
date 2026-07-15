-- Harden Atendimento Presencial draft attendances after advisor review.

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
