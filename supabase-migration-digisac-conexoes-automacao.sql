-- Migration: digisac_conexoes_automacao
-- Cria tabela de configuracao de conexoes habilitadas para fechamento automatico

CREATE TABLE IF NOT EXISTS public.digisac_conexoes_automacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL UNIQUE,
  service_name text,
  my_number text,
  default_department_id text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indice para busca por service_id ativo
CREATE INDEX IF NOT EXISTS idx_digisac_conexoes_automacao_ativo
  ON public.digisac_conexoes_automacao (service_id)
  WHERE ativo = true;

-- RLS
ALTER TABLE public.digisac_conexoes_automacao ENABLE ROW LEVEL SECURITY;

-- Recria policies com segurança
DROP POLICY IF EXISTS "digisac_conexoes_automacao_select_superadmin"
  ON public.digisac_conexoes_automacao;

DROP POLICY IF EXISTS "digisac_conexoes_automacao_insert_superadmin"
  ON public.digisac_conexoes_automacao;

DROP POLICY IF EXISTS "digisac_conexoes_automacao_update_superadmin"
  ON public.digisac_conexoes_automacao;

-- Policy: apenas superadmin pode ler
CREATE POLICY "digisac_conexoes_automacao_select_superadmin"
  ON public.digisac_conexoes_automacao
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuarios_permitidos up
      WHERE up.email = (select auth.jwt() ->> 'email')
        AND up.ativo = true
        AND up.role = 'superadmin'
    )
  );

-- Policy: apenas superadmin pode inserir
CREATE POLICY "digisac_conexoes_automacao_insert_superadmin"
  ON public.digisac_conexoes_automacao
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.usuarios_permitidos up
      WHERE up.email = (select auth.jwt() ->> 'email')
        AND up.ativo = true
        AND up.role = 'superadmin'
    )
  );

-- Policy: apenas superadmin pode atualizar
CREATE POLICY "digisac_conexoes_automacao_update_superadmin"
  ON public.digisac_conexoes_automacao
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuarios_permitidos up
      WHERE up.email = (select auth.jwt() ->> 'email')
        AND up.ativo = true
        AND up.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.usuarios_permitidos up
      WHERE up.email = (select auth.jwt() ->> 'email')
        AND up.ativo = true
        AND up.role = 'superadmin'
    )
  );

-- Seed inicial: Bigorrilho ativo
INSERT INTO public.digisac_conexoes_automacao (
  service_id,
  service_name,
  my_number,
  default_department_id,
  ativo
)
VALUES (
  '0973f84b-8294-4615-9657-ba95b6346246',
  'BIGORRILHO (41 8804-3042)',
  '554188043042',
  '4de92f03-ff0a-49c3-b167-07603ae01569',
  true
)
ON CONFLICT (service_id) DO UPDATE SET
  service_name = EXCLUDED.service_name,
  my_number = EXCLUDED.my_number,
  default_department_id = EXCLUDED.default_department_id,
  ativo = EXCLUDED.ativo,
  updated_at = now();