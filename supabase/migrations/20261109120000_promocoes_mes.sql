-- Promoções do Mês: tabelas, bucket privado e módulo administrativo.
-- Idempotente. Acesso só via service role (RLS ligado, sem policies);
-- decisão por perfil fica no TypeScript (requireModuleAccess).

CREATE TABLE IF NOT EXISTS public.promocoes_mes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  inicio date NOT NULL,
  fim date NOT NULL,
  criado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promocoes_mes_titulo_chk CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 120),
  CONSTRAINT promocoes_mes_periodo_chk CHECK (fim >= inicio)
);

CREATE TABLE IF NOT EXISTS public.promocoes_mes_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promocao_id uuid NOT NULL REFERENCES public.promocoes_mes(id) ON DELETE CASCADE,
  caminho_objeto text NOT NULL,
  nome_original text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes integer NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promocoes_mes_arquivos_caminho_unique UNIQUE (caminho_objeto),
  CONSTRAINT promocoes_mes_arquivos_mime_chk CHECK (mime_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
  CONSTRAINT promocoes_mes_arquivos_tamanho_chk CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 10485760),
  CONSTRAINT promocoes_mes_arquivos_nome_chk CHECK (char_length(nome_original) BETWEEN 1 AND 255)
);
CREATE INDEX IF NOT EXISTS idx_promocoes_mes_arquivos_promocao ON public.promocoes_mes_arquivos(promocao_id, ordem);
CREATE INDEX IF NOT EXISTS idx_promocoes_mes_vigencia ON public.promocoes_mes(inicio, fim);

-- Registro de falhas de limpeza no Storage (objeto que não pôde ser removido).
-- Permite identificar e corrigir inconsistências via /api/promocoes-mes/reconciliar.
CREATE TABLE IF NOT EXISTS public.promocoes_mes_storage_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caminho_objeto text NOT NULL UNIQUE,
  motivo text NOT NULL,
  tentativas integer NOT NULL DEFAULT 1,
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promocoes_mes_pend_motivo_chk CHECK (motivo IN ('FALHA_APOS_UPLOAD','REMOCAO_ARQUIVO','REMOCAO_PROMOCAO'))
);

DROP TRIGGER IF EXISTS promocoes_mes_updated_at ON public.promocoes_mes;
CREATE TRIGGER promocoes_mes_updated_at BEFORE UPDATE ON public.promocoes_mes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS promocoes_mes_pend_updated_at ON public.promocoes_mes_storage_pendencias;
CREATE TRIGGER promocoes_mes_pend_updated_at BEFORE UPDATE ON public.promocoes_mes_storage_pendencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.promocoes_mes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promocoes_mes_arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promocoes_mes_storage_pendencias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.promocoes_mes, public.promocoes_mes_arquivos, public.promocoes_mes_storage_pendencias FROM anon, authenticated;
GRANT ALL ON TABLE public.promocoes_mes, public.promocoes_mes_arquivos, public.promocoes_mes_storage_pendencias TO service_role;

-- Bucket privado, sem policies em storage.objects (acesso só service role + URL assinada).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('promocoes-mes', 'promocoes-mes', false, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Módulo administrativo (controlado por perfil) liberado ao perfil gestao.
INSERT INTO public.app_modulos (chave, nome, descricao, rota_base, categoria, publico, somente_superadmin, ativo, ordem)
VALUES (
  'promocoes_mes',
  'PROMOCOES DO MES',
  'Cadastro e gestao das promocoes do mes exibidas na Prancheta Virtual',
  '/promocoes-do-mes',
  'interno',
  false,
  false,
  true,
  68
)
ON CONFLICT (chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota_base = EXCLUDED.rota_base,
  categoria = EXCLUDED.categoria,
  publico = EXCLUDED.publico,
  somente_superadmin = EXCLUDED.somente_superadmin,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = now();

INSERT INTO public.app_permissoes_perfil (perfil_id, modulo_id, permitido)
SELECT p.id, m.id, matrix.permitido
FROM (
  VALUES
    ('consultora', false),
    ('supervisora_loja', false),
    ('pos_venda', false),
    ('gestao', true)
) AS matrix(chave_perfil, permitido)
JOIN public.app_perfis_acesso p ON p.chave = matrix.chave_perfil
JOIN public.app_modulos m ON m.chave = 'promocoes_mes'
ON CONFLICT (perfil_id, modulo_id) DO UPDATE SET
  permitido = EXCLUDED.permitido,
  updated_at = now();
