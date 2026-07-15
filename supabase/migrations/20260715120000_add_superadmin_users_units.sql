-- Add limited Users administration module and user-unit assignments.

CREATE TABLE IF NOT EXISTS public.app_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_usuarios_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.app_unidades(id) ON DELETE RESTRICT,
  atribuido_por uuid REFERENCES public.usuarios_permitidos(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_app_usuarios_unidades_usuario
  ON public.app_usuarios_unidades(usuario_id);

CREATE INDEX IF NOT EXISTS idx_app_usuarios_unidades_unidade
  ON public.app_usuarios_unidades(unidade_id);

ALTER TABLE public.app_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_usuarios_unidades ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_unidades FROM anon, authenticated;
REVOKE ALL ON public.app_usuarios_unidades FROM anon, authenticated;

INSERT INTO public.app_unidades (chave, nome, ativo, ordem)
VALUES
  ('bigorrilho', 'BIGORRILHO', true, 10),
  ('portao', 'PORTAO', true, 20),
  ('marechal', 'MARECHAL', true, 30),
  ('feira', 'FEIRA', true, 40),
  ('pos_venda', 'POS VENDA', true, 50)
ON CONFLICT (chave) DO UPDATE
SET
  nome = EXCLUDED.nome,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = now();

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
VALUES (
  'superadmin_usuarios',
  'USUARIOS',
  'Gestao limitada de usuarios permitidos e unidades',
  '/superadmin?tab=usuarios',
  'admin',
  false,
  false,
  true,
  92
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
