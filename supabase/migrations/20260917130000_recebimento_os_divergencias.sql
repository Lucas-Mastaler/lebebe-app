ALTER TABLE public.recebimento_os
  ADD COLUMN divergencia_tipo TEXT,
  ADD COLUMN divergencia_obs TEXT,
  ADD CONSTRAINT recebimento_os_divergencia_tipo_check
    CHECK (divergencia_tipo IN ('faltou', 'sobrou', 'avaria') OR divergencia_tipo IS NULL);
