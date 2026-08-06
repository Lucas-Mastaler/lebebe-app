-- Pedidos Personalizados - Fase 1B.
-- Storage privado, anexos, idempotencia e operacoes atomicas.
-- Nao cria API, pagina, componente, worker, cron ou acesso direto do navegador.

DO $$
DECLARE
  v_tabelas_ausentes text[];
  v_tabelas_fase_1b_existentes text[];
BEGIN
  SELECT array_agg(nome ORDER BY nome)
    INTO v_tabelas_ausentes
  FROM unnest(ARRAY[
    'pedidos_personalizados_fornecedores',
    'pedidos_personalizados_produtos',
    'pedidos_personalizados_pedidos',
    'pedidos_personalizados_moriah_tapetes',
    'pedidos_personalizados_cores',
    'pedidos_personalizados_tapete_cores'
  ]) AS esperado(nome)
  WHERE to_regclass('public.' || nome) IS NULL;

  IF v_tabelas_ausentes IS NOT NULL THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_FASE_1A_INCOMPLETA';
  END IF;

  SELECT array_agg(table_name ORDER BY table_name)
    INTO v_tabelas_fase_1b_existentes
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'pedidos_personalizados_anexos',
      'pedidos_personalizados_storage_pendencias'
    );

  IF v_tabelas_fase_1b_existentes IS NOT NULL THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_FASE_1B_SCHEMA_EXISTENTE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pedidos_personalizados_pedidos'
      AND column_name = 'idempotency_key'
  ) THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_IDEMPOTENCIA_EXISTENTE';
  END IF;

  IF (SELECT count(*) FROM public.pedidos_personalizados_pedidos) <> 0
     OR (SELECT count(*) FROM public.pedidos_personalizados_moriah_tapetes) <> 0 THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_DADOS_OPERACIONAIS_EXISTENTES';
  END IF;

  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_STORAGE_INDISPONIVEL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'pedidos-personalizados-anexos'
       OR name = 'pedidos-personalizados-anexos'
  ) THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_BUCKET_EXISTENTE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'logo'
  ) THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_BUCKET_LOGO_AUSENTE';
  END IF;

  IF (
    SELECT count(*)
    FROM public.app_unidades
    WHERE chave IN ('bigorrilho', 'portao', 'marechal', 'feira')
      AND ativo = true
  ) <> 4 THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_UNIDADES_INVALIDAS';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_unidades
    WHERE chave = 'pos_venda'
  ) THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_POS_VENDA_NAO_CONFIRMADA';
  END IF;
END;
$$;

ALTER TABLE public.pedidos_personalizados_pedidos
  ADD COLUMN idempotency_key uuid NOT NULL;

ALTER TABLE public.pedidos_personalizados_pedidos
  ADD CONSTRAINT pedidos_personalizados_pedidos_criador_idempotencia_unique
  UNIQUE (created_by, idempotency_key);

ALTER TABLE public.pedidos_personalizados_moriah_tapetes
  DROP CONSTRAINT pedidos_personalizados_moriah_tapetes_pedido_ordem_unique;

ALTER TABLE public.pedidos_personalizados_moriah_tapetes
  ADD CONSTRAINT pedidos_personalizados_moriah_tapetes_pedido_ordem_unique
  UNIQUE (pedido_id, ordem)
  DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE public.pedidos_personalizados_anexos (
  id uuid PRIMARY KEY,
  tapete_id uuid NOT NULL REFERENCES public.pedidos_personalizados_moriah_tapetes(id) ON DELETE RESTRICT,
  slot integer NOT NULL,
  bucket_id text NOT NULL DEFAULT 'pedidos-personalizados-anexos',
  caminho_objeto text NOT NULL,
  nome_original text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL,
  created_by uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_personalizados_anexos_tapete_slot_unique UNIQUE (tapete_id, slot),
  CONSTRAINT pedidos_personalizados_anexos_caminho_unique UNIQUE (caminho_objeto),
  CONSTRAINT pedidos_personalizados_anexos_slot_check CHECK (slot IN (1, 2)),
  CONSTRAINT pedidos_personalizados_anexos_bucket_check CHECK (bucket_id = 'pedidos-personalizados-anexos'),
  CONSTRAINT pedidos_personalizados_anexos_caminho_check CHECK (caminho_objeto ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'),
  CONSTRAINT pedidos_personalizados_anexos_nome_original_check CHECK (nome_original = btrim(nome_original) AND char_length(nome_original) BETWEEN 1 AND 255),
  CONSTRAINT pedidos_personalizados_anexos_mime_type_check CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  CONSTRAINT pedidos_personalizados_anexos_tamanho_check CHECK (tamanho_bytes BETWEEN 1 AND 10485760),
  CONSTRAINT pedidos_personalizados_anexos_extensao_mime_check CHECK (
    (mime_type = 'image/jpeg' AND caminho_objeto ~ '\.jpg$')
    OR (mime_type = 'image/png' AND caminho_objeto ~ '\.png$')
    OR (mime_type = 'image/webp' AND caminho_objeto ~ '\.webp$')
    OR (mime_type = 'application/pdf' AND caminho_objeto ~ '\.pdf$')
  )
);

COMMENT ON COLUMN public.pedidos_personalizados_anexos.caminho_objeto IS
  '<pedido_uuid>/<tapete_uuid>/<anexo_uuid>/<arquivo_uuid>.<extensao-segura>; sem dados pessoais, comerciais ou nome original';

CREATE TABLE public.pedidos_personalizados_storage_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL DEFAULT 'pedidos-personalizados-anexos',
  caminho_objeto text NOT NULL,
  motivo text NOT NULL,
  tentativas integer NOT NULL DEFAULT 0,
  proxima_tentativa_em timestamptz NOT NULL DEFAULT now(),
  ultimo_erro text,
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_personalizados_storage_pendencias_bucket_check CHECK (bucket_id = 'pedidos-personalizados-anexos'),
  CONSTRAINT pedidos_personalizados_storage_pendencias_caminho_check CHECK (caminho_objeto ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'),
  CONSTRAINT pedidos_personalizados_storage_pendencias_motivo_check CHECK (motivo IN ('SUBSTITUICAO', 'REMOCAO_ANEXO', 'REMOCAO_TAPETE', 'REMOCAO_PEDIDO', 'FALHA_APOS_UPLOAD')),
  CONSTRAINT pedidos_personalizados_storage_pendencias_tentativas_check CHECK (tentativas >= 0),
  CONSTRAINT pedidos_personalizados_storage_pendencias_ultimo_erro_check CHECK (ultimo_erro IS NULL OR char_length(ultimo_erro) BETWEEN 1 AND 500)
);

COMMENT ON COLUMN public.pedidos_personalizados_storage_pendencias.ultimo_erro IS
  'Mensagem tecnica sanitizada; nao registrar dados pessoais, comerciais ou caminho completo';

CREATE UNIQUE INDEX idx_pedidos_personalizados_storage_pendencias_objeto_pendente
  ON public.pedidos_personalizados_storage_pendencias (bucket_id, caminho_objeto)
  WHERE processado_em IS NULL;
CREATE INDEX idx_pedidos_personalizados_storage_pendencias_proxima_tentativa
  ON public.pedidos_personalizados_storage_pendencias (proxima_tentativa_em, id)
  WHERE processado_em IS NULL;
CREATE INDEX idx_pedidos_personalizados_anexos_created_by ON public.pedidos_personalizados_anexos (created_by);
CREATE INDEX idx_pedidos_personalizados_anexos_updated_by ON public.pedidos_personalizados_anexos (updated_by);

CREATE TRIGGER trg_pedidos_personalizados_anexos_touch
  BEFORE UPDATE ON public.pedidos_personalizados_anexos
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_personalizados_touch_updated_at();
CREATE TRIGGER trg_pedidos_personalizados_storage_pendencias_touch
  BEFORE UPDATE ON public.pedidos_personalizados_storage_pendencias
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_personalizados_touch_updated_at();

ALTER TABLE public.pedidos_personalizados_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_personalizados_storage_pendencias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pedidos_personalizados_anexos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pedidos_personalizados_storage_pendencias FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.pedidos_personalizados_anexos TO service_role;
GRANT ALL ON TABLE public.pedidos_personalizados_storage_pendencias TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pedidos-personalizados-anexos',
  'pedidos-personalizados-anexos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
);

CREATE FUNCTION public.registrar_anexo_pedido_personalizado(
  p_pedido_id uuid,
  p_tapete_id uuid,
  p_expected_version integer,
  p_slot integer,
  p_caminho_objeto text,
  p_nome_original text,
  p_mime_type text,
  p_tamanho_bytes bigint,
  p_usuario_id uuid
)
RETURNS TABLE (
  anexo_id uuid,
  version integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
  v_anexo_id uuid;
  v_nova_version integer;
BEGIN
  IF p_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_permitidos
    WHERE id = p_usuario_id AND ativo = true
  ) THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos_personalizados_pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  IF v_pedido.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLITO_VERSAO' USING ERRCODE = 'P0003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pedidos_personalizados_moriah_tapetes
    WHERE id = p_tapete_id AND pedido_id = p_pedido_id
  ) THEN
    RAISE EXCEPTION 'TAPETE_NAO_PERTENCE_AO_PEDIDO' USING ERRCODE = '23514';
  END IF;

  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN
    RAISE EXCEPTION 'TIPO_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  IF p_tamanho_bytes IS NULL OR p_tamanho_bytes NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'TAMANHO_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  IF p_slot NOT IN (1, 2) THEN
    RAISE EXCEPTION 'LIMITE_ANEXOS' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(*)
    FROM public.pedidos_personalizados_anexos
    WHERE tapete_id = p_tapete_id
  ) >= 2 THEN
    RAISE EXCEPTION 'LIMITE_ANEXOS' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pedidos_personalizados_anexos
    WHERE tapete_id = p_tapete_id AND slot = p_slot
  ) THEN
    RAISE EXCEPTION 'SLOT_ANEXO_OCUPADO' USING ERRCODE = '23505';
  END IF;

  IF p_nome_original IS NULL
     OR p_nome_original <> btrim(p_nome_original)
     OR char_length(p_nome_original) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'NOME_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  IF p_caminho_objeto IS NULL
     OR p_caminho_objeto !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
     OR split_part(p_caminho_objeto, '/', 1) <> p_pedido_id::text
     OR split_part(p_caminho_objeto, '/', 2) <> p_tapete_id::text
     OR (p_mime_type = 'image/jpeg' AND p_caminho_objeto !~ '\.jpg$')
     OR (p_mime_type = 'image/png' AND p_caminho_objeto !~ '\.png$')
     OR (p_mime_type = 'image/webp' AND p_caminho_objeto !~ '\.webp$')
     OR (p_mime_type = 'application/pdf' AND p_caminho_objeto !~ '\.pdf$') THEN
    RAISE EXCEPTION 'CAMINHO_OBJETO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  v_anexo_id := split_part(p_caminho_objeto, '/', 3)::uuid;

  INSERT INTO public.pedidos_personalizados_anexos (
    id, tapete_id, slot, bucket_id, caminho_objeto, nome_original,
    mime_type, tamanho_bytes, created_by, updated_by
  ) VALUES (
    v_anexo_id,
    p_tapete_id,
    p_slot,
    'pedidos-personalizados-anexos',
    p_caminho_objeto,
    p_nome_original,
    p_mime_type,
    p_tamanho_bytes,
    p_usuario_id,
    p_usuario_id
  );

  UPDATE public.pedidos_personalizados_pedidos
  SET version = pedidos_personalizados_pedidos.version + 1,
      updated_by = p_usuario_id
  WHERE id = p_pedido_id
  RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;

  RETURN QUERY SELECT v_anexo_id, v_nova_version;
END;
$$;

CREATE FUNCTION public.substituir_anexo_pedido_personalizado(
  p_pedido_id uuid,
  p_anexo_id uuid,
  p_expected_version integer,
  p_caminho_objeto text,
  p_nome_original text,
  p_mime_type text,
  p_tamanho_bytes bigint,
  p_usuario_id uuid
)
RETURNS TABLE (
  anexo_id uuid,
  caminho_antigo text,
  version integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
  v_anexo public.pedidos_personalizados_anexos%ROWTYPE;
  v_nova_version integer;
BEGIN
  IF p_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_permitidos
    WHERE id = p_usuario_id AND ativo = true
  ) THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos_personalizados_pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  IF v_pedido.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLITO_VERSAO' USING ERRCODE = 'P0003';
  END IF;

  SELECT anexo.* INTO v_anexo
  FROM public.pedidos_personalizados_anexos AS anexo
  JOIN public.pedidos_personalizados_moriah_tapetes AS tapete
    ON tapete.id = anexo.tapete_id
  WHERE anexo.id = p_anexo_id
    AND tapete.pedido_id = p_pedido_id
  FOR UPDATE OF anexo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANEXO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN
    RAISE EXCEPTION 'TIPO_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  IF p_tamanho_bytes IS NULL OR p_tamanho_bytes NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'TAMANHO_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  IF p_nome_original IS NULL
     OR p_nome_original <> btrim(p_nome_original)
     OR char_length(p_nome_original) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'NOME_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  IF p_caminho_objeto IS NULL
     OR p_caminho_objeto = v_anexo.caminho_objeto
     OR p_caminho_objeto !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
     OR split_part(p_caminho_objeto, '/', 1) <> p_pedido_id::text
     OR split_part(p_caminho_objeto, '/', 2) <> v_anexo.tapete_id::text
     OR split_part(p_caminho_objeto, '/', 3) <> p_anexo_id::text
     OR (p_mime_type = 'image/jpeg' AND p_caminho_objeto !~ '\.jpg$')
     OR (p_mime_type = 'image/png' AND p_caminho_objeto !~ '\.png$')
     OR (p_mime_type = 'image/webp' AND p_caminho_objeto !~ '\.webp$')
     OR (p_mime_type = 'application/pdf' AND p_caminho_objeto !~ '\.pdf$') THEN
    RAISE EXCEPTION 'CAMINHO_OBJETO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pedidos_personalizados_storage_pendencias (
    bucket_id, caminho_objeto, motivo
  ) VALUES (
    v_anexo.bucket_id,
    v_anexo.caminho_objeto,
    'SUBSTITUICAO'
  )
  ON CONFLICT (bucket_id, caminho_objeto) WHERE processado_em IS NULL
  DO NOTHING;

  UPDATE public.pedidos_personalizados_anexos
  SET
    caminho_objeto = p_caminho_objeto,
    nome_original = p_nome_original,
    mime_type = p_mime_type,
    tamanho_bytes = p_tamanho_bytes,
    updated_by = p_usuario_id
  WHERE id = p_anexo_id;

  UPDATE public.pedidos_personalizados_pedidos
  SET version = pedidos_personalizados_pedidos.version + 1,
      updated_by = p_usuario_id
  WHERE id = p_pedido_id
  RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;

  RETURN QUERY SELECT p_anexo_id, v_anexo.caminho_objeto, v_nova_version;
END;
$$;

CREATE FUNCTION public.remover_anexo_pedido_personalizado(
  p_pedido_id uuid,
  p_anexo_id uuid,
  p_expected_version integer,
  p_usuario_id uuid
)
RETURNS TABLE (
  caminho_enfileirado text,
  version integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
  v_anexo public.pedidos_personalizados_anexos%ROWTYPE;
  v_nova_version integer;
BEGIN
  IF p_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_permitidos
    WHERE id = p_usuario_id AND ativo = true
  ) THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos_personalizados_pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  IF v_pedido.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLITO_VERSAO' USING ERRCODE = 'P0003';
  END IF;

  SELECT anexo.* INTO v_anexo
  FROM public.pedidos_personalizados_anexos AS anexo
  JOIN public.pedidos_personalizados_moriah_tapetes AS tapete
    ON tapete.id = anexo.tapete_id
  WHERE anexo.id = p_anexo_id
    AND tapete.pedido_id = p_pedido_id
  FOR UPDATE OF anexo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANEXO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.pedidos_personalizados_storage_pendencias (
    bucket_id, caminho_objeto, motivo
  ) VALUES (
    v_anexo.bucket_id,
    v_anexo.caminho_objeto,
    'REMOCAO_ANEXO'
  )
  ON CONFLICT (bucket_id, caminho_objeto) WHERE processado_em IS NULL
  DO NOTHING;

  DELETE FROM public.pedidos_personalizados_anexos
  WHERE id = p_anexo_id;

  UPDATE public.pedidos_personalizados_pedidos
  SET version = pedidos_personalizados_pedidos.version + 1,
      updated_by = p_usuario_id
  WHERE id = p_pedido_id
  RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;

  RETURN QUERY SELECT v_anexo.caminho_objeto, v_nova_version;
END;
$$;

CREATE FUNCTION public.atualizar_pedido_personalizado_comercial_moriah(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_tapetes jsonb
)
RETURNS TABLE (
  version integer,
  tapetes jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
  v_tapete jsonb;
  v_cor jsonb;
  v_tapete_id uuid;
  v_produto_id uuid;
  v_cor_id uuid;
  v_total_tapetes integer;
  v_total_cores integer;
  v_nova_version integer;
  v_tapetes_retorno jsonb := '[]'::jsonb;
BEGIN
  IF p_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_permitidos
    WHERE id = p_usuario_id AND ativo = true
  ) THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos_personalizados_pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  IF v_pedido.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLITO_VERSAO' USING ERRCODE = 'P0003';
  END IF;

  IF v_pedido.status NOT IN (
    'CADASTRADO',
    'AGUARDANDO LAYOUT',
    U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE'
  ) THEN
    RAISE EXCEPTION 'EDICAO_COMERCIAL_BLOQUEADA' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.app_unidades
    WHERE id = p_unidade_id
      AND ativo = true
      AND chave IN ('bigorrilho', 'portao', 'marechal', 'feira')
  ) THEN
    RAISE EXCEPTION 'UNIDADE_NAO_PERMITIDA' USING ERRCODE = '22023';
  END IF;

  IF p_tapetes IS NULL OR jsonb_typeof(p_tapetes) <> 'array' THEN
    RAISE EXCEPTION 'LIMITE_TAPETES' USING ERRCODE = '22023';
  END IF;

  v_total_tapetes := jsonb_array_length(p_tapetes);
  IF v_total_tapetes NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'LIMITE_TAPETES' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tapetes) AS item(value)
    WHERE item.value->>'ordem' IS NULL
       OR item.value->>'ordem' !~ '^[0-9]+$'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tapetes) AS item(value)
    GROUP BY item.value->>'ordem'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'ORDEM_TAPETE_DUPLICADA' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tapetes) AS item(value)
    WHERE item.value ? 'id'
      AND (
        item.value->>'id' IS NULL
        OR item.value->>'id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tapetes) AS item(value)
    WHERE item.value ? 'id'
    GROUP BY item.value->>'id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'TAPETE_INVALIDO' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tapetes) AS item(value)
    WHERE item.value ? 'id'
      AND NOT EXISTS (
        SELECT 1
        FROM public.pedidos_personalizados_moriah_tapetes AS existente
        WHERE existente.id = (item.value->>'id')::uuid
          AND existente.pedido_id = p_pedido_id
      )
  ) THEN
    RAISE EXCEPTION 'TAPETE_NAO_PERTENCE_AO_PEDIDO' USING ERRCODE = '23514';
  END IF;

  FOR v_tapete IN
    SELECT item.value FROM jsonb_array_elements(p_tapetes) AS item(value)
  LOOP
    IF jsonb_typeof(v_tapete) <> 'object'
       OR (v_tapete->>'ordem')::integer NOT BETWEEN 1 AND 10
       OR v_tapete->>'formato' NOT IN ('REDONDO', 'RETANGULAR', 'ORGANICO')
       OR v_tapete->>'dimensao_1_cm' IS NULL
       OR v_tapete->>'dimensao_1_cm' !~ '^[0-9]+$'
       OR (v_tapete->>'dimensao_1_cm')::integer NOT BETWEEN 10 AND 1500
       OR v_tapete->>'area_cobrada_centesimos_m2' IS NULL
       OR v_tapete->>'area_cobrada_centesimos_m2' !~ '^[0-9]+$'
       OR (v_tapete->>'area_cobrada_centesimos_m2')::integer NOT BETWEEN 1 AND 22500
       OR v_tapete->>'produto_id' IS NULL
       OR v_tapete->>'produto_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       OR (v_tapete->>'formato' = 'REDONDO' AND v_tapete->>'dimensao_2_cm' IS NOT NULL)
       OR (
         v_tapete->>'formato' IN ('RETANGULAR', 'ORGANICO')
         AND (
           v_tapete->>'dimensao_2_cm' IS NULL
           OR v_tapete->>'dimensao_2_cm' !~ '^[0-9]+$'
           OR (v_tapete->>'dimensao_2_cm')::integer NOT BETWEEN 10 AND 1500
         )
       )
       OR (
         v_tapete->>'nome_colecao_catalogo' IS NOT NULL
         AND char_length(btrim(v_tapete->>'nome_colecao_catalogo')) NOT BETWEEN 1 AND 80
       )
       OR (
         v_tapete->>'referencia_catalogo' IS NOT NULL
         AND v_tapete->>'referencia_catalogo' !~ '^[A-Za-z0-9-]{1,40}$'
       )
       OR (v_tapete->>'observacoes' IS NOT NULL AND char_length(v_tapete->>'observacoes') > 500)
    THEN
      RAISE EXCEPTION 'TAPETE_INVALIDO' USING ERRCODE = '22023';
    END IF;

    v_produto_id := (v_tapete->>'produto_id')::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM public.pedidos_personalizados_produtos
      WHERE id = v_produto_id
        AND fornecedor_id = v_pedido.fornecedor_id
        AND ativo = true
    ) THEN
      RAISE EXCEPTION 'PRODUTO_FORNECEDOR_INVALIDO' USING ERRCODE = '23514';
    END IF;

    IF v_tapete ? 'cores' AND jsonb_typeof(v_tapete->'cores') <> 'array' THEN
      RAISE EXCEPTION 'LIMITE_CORES' USING ERRCODE = '22023';
    END IF;

    v_total_cores := jsonb_array_length(COALESCE(v_tapete->'cores', '[]'::jsonb));
    IF v_total_cores > 8 THEN
      RAISE EXCEPTION 'LIMITE_CORES' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
      WHERE cor.value->>'ordem' IS NULL
         OR cor.value->>'ordem' !~ '^[0-9]+$'
         OR (cor.value->>'ordem')::integer NOT BETWEEN 1 AND 8
         OR cor.value->>'cor_id' IS NULL
         OR cor.value->>'cor_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    ) OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
      GROUP BY cor.value->>'ordem'
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'ORDEM_COR_DUPLICADA' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
      GROUP BY cor.value->>'cor_id'
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'COR_DUPLICADA' USING ERRCODE = '22023';
    END IF;

    FOR v_cor IN
      SELECT cor.value
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
    LOOP
      v_cor_id := (v_cor->>'cor_id')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.pedidos_personalizados_cores
        WHERE id = v_cor_id
          AND fornecedor_id = v_pedido.fornecedor_id
          AND ativo = true
      ) THEN
        RAISE EXCEPTION 'COR_FORNECEDOR_INVALIDA' USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END LOOP;

  SET CONSTRAINTS pedidos_personalizados_moriah_tapetes_pedido_ordem_unique DEFERRED;

  INSERT INTO public.pedidos_personalizados_storage_pendencias (
    bucket_id, caminho_objeto, motivo
  )
  SELECT anexo.bucket_id, anexo.caminho_objeto, 'REMOCAO_TAPETE'
  FROM public.pedidos_personalizados_anexos AS anexo
  JOIN public.pedidos_personalizados_moriah_tapetes AS tapete
    ON tapete.id = anexo.tapete_id
  WHERE tapete.pedido_id = p_pedido_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_tapetes) AS item(value)
      WHERE item.value ? 'id'
        AND item.value->>'id' = tapete.id::text
    )
  ON CONFLICT (bucket_id, caminho_objeto) WHERE processado_em IS NULL
  DO NOTHING;

  DELETE FROM public.pedidos_personalizados_anexos AS anexo
  USING public.pedidos_personalizados_moriah_tapetes AS tapete
  WHERE tapete.id = anexo.tapete_id
    AND tapete.pedido_id = p_pedido_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_tapetes) AS item(value)
      WHERE item.value ? 'id'
        AND item.value->>'id' = tapete.id::text
    );

  DELETE FROM public.pedidos_personalizados_tapete_cores AS relacao
  USING public.pedidos_personalizados_moriah_tapetes AS tapete
  WHERE tapete.id = relacao.tapete_id
    AND tapete.pedido_id = p_pedido_id;

  DELETE FROM public.pedidos_personalizados_moriah_tapetes AS tapete
  WHERE tapete.pedido_id = p_pedido_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_tapetes) AS item(value)
      WHERE item.value ? 'id'
        AND item.value->>'id' = tapete.id::text
    );

  FOR v_tapete IN
    SELECT item.value
    FROM jsonb_array_elements(p_tapetes) AS item(value)
    ORDER BY (item.value->>'ordem')::integer
  LOOP
    v_produto_id := (v_tapete->>'produto_id')::uuid;

    IF v_tapete ? 'id' THEN
      v_tapete_id := (v_tapete->>'id')::uuid;
      UPDATE public.pedidos_personalizados_moriah_tapetes
      SET
        ordem = (v_tapete->>'ordem')::integer,
        formato = v_tapete->>'formato',
        dimensao_1_cm = (v_tapete->>'dimensao_1_cm')::integer,
        dimensao_2_cm = NULLIF(v_tapete->>'dimensao_2_cm', '')::integer,
        area_cobrada_centesimos_m2 = (v_tapete->>'area_cobrada_centesimos_m2')::integer,
        produto_id = v_produto_id,
        nome_colecao_catalogo = NULLIF(v_tapete->>'nome_colecao_catalogo', ''),
        referencia_catalogo = NULLIF(v_tapete->>'referencia_catalogo', ''),
        observacoes = v_tapete->>'observacoes',
        updated_by = p_usuario_id
      WHERE id = v_tapete_id;
    ELSE
      v_tapete_id := gen_random_uuid();
      INSERT INTO public.pedidos_personalizados_moriah_tapetes (
        id, pedido_id, ordem, formato, dimensao_1_cm, dimensao_2_cm,
        area_cobrada_centesimos_m2, produto_id, nome_colecao_catalogo,
        referencia_catalogo, observacoes, created_by, updated_by
      ) VALUES (
        v_tapete_id,
        p_pedido_id,
        (v_tapete->>'ordem')::integer,
        v_tapete->>'formato',
        (v_tapete->>'dimensao_1_cm')::integer,
        NULLIF(v_tapete->>'dimensao_2_cm', '')::integer,
        (v_tapete->>'area_cobrada_centesimos_m2')::integer,
        v_produto_id,
        NULLIF(v_tapete->>'nome_colecao_catalogo', ''),
        NULLIF(v_tapete->>'referencia_catalogo', ''),
        v_tapete->>'observacoes',
        p_usuario_id,
        p_usuario_id
      );
    END IF;

    FOR v_cor IN
      SELECT cor.value
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
      ORDER BY (cor.value->>'ordem')::integer
    LOOP
      INSERT INTO public.pedidos_personalizados_tapete_cores (tapete_id, cor_id, ordem)
      VALUES (
        v_tapete_id,
        (v_cor->>'cor_id')::uuid,
        (v_cor->>'ordem')::integer
      );
    END LOOP;

    v_tapetes_retorno := v_tapetes_retorno || jsonb_build_array(
      jsonb_build_object('id', v_tapete_id, 'ordem', (v_tapete->>'ordem')::integer)
    );
  END LOOP;

  SET CONSTRAINTS pedidos_personalizados_moriah_tapetes_pedido_ordem_unique IMMEDIATE;

  UPDATE public.pedidos_personalizados_pedidos
  SET
    unidade_id = p_unidade_id,
    consultora = p_consultora,
    cliente = p_cliente,
    version = pedidos_personalizados_pedidos.version + 1,
    updated_by = p_usuario_id
  WHERE id = p_pedido_id
  RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;

  RETURN QUERY SELECT v_nova_version, v_tapetes_retorno;
END;
$$;

CREATE FUNCTION public.atualizar_pedido_personalizado_administrativo(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_numero_lancamento text,
  p_data_entrega date,
  p_data_pedido_fornecedor date,
  p_numero_pedido_compra text,
  p_comprador text,
  p_status text,
  p_layout_tapetes jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (version integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
  v_layout jsonb;
  v_nova_version integer;
BEGIN
  IF p_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_permitidos
    WHERE id = p_usuario_id AND ativo = true
  ) THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos_personalizados_pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  IF v_pedido.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLITO_VERSAO' USING ERRCODE = 'P0003';
  END IF;

  IF p_status NOT IN (
    'CADASTRADO',
    'AGUARDANDO LAYOUT',
    U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE',
    U&'EM PRODU\00C7\00C3O',
    'RECEBIDO'
  ) THEN
    RAISE EXCEPTION 'STATUS_INVALIDO' USING ERRCODE = '22023';
  END IF;

  IF p_layout_tapetes IS NULL OR jsonb_typeof(p_layout_tapetes) <> 'array' THEN
    RAISE EXCEPTION 'LAYOUT_INVALIDO' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_layout_tapetes) AS item(value)
    WHERE item.value->>'tapete_id' IS NULL
       OR item.value->>'tapete_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       OR jsonb_typeof(item.value->'teve_alteracao_layout') <> 'boolean'
       OR (
         (item.value->>'teve_alteracao_layout')::boolean = false
         AND item.value->>'quantidade_alteracoes_layout' IS NOT NULL
       )
       OR (
         (item.value->>'teve_alteracao_layout')::boolean = true
         AND (
           item.value->>'quantidade_alteracoes_layout' IS NULL
           OR item.value->>'quantidade_alteracoes_layout' !~ '^[0-9]+$'
           OR (item.value->>'quantidade_alteracoes_layout')::integer < 1
         )
       )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_layout_tapetes) AS item(value)
    GROUP BY item.value->>'tapete_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'LAYOUT_INVALIDO' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_layout_tapetes) AS item(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.pedidos_personalizados_moriah_tapetes AS tapete
      WHERE tapete.id = (item.value->>'tapete_id')::uuid
        AND tapete.pedido_id = p_pedido_id
    )
  ) THEN
    RAISE EXCEPTION 'TAPETE_NAO_PERTENCE_AO_PEDIDO' USING ERRCODE = '23514';
  END IF;

  UPDATE public.pedidos_personalizados_pedidos
  SET
    numero_lancamento = p_numero_lancamento,
    data_entrega = p_data_entrega,
    data_pedido_fornecedor = p_data_pedido_fornecedor,
    numero_pedido_compra = p_numero_pedido_compra,
    comprador = p_comprador,
    status = p_status,
    version = pedidos_personalizados_pedidos.version + 1,
    updated_by = p_usuario_id
  WHERE id = p_pedido_id
  RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;

  FOR v_layout IN
    SELECT item.value
    FROM jsonb_array_elements(p_layout_tapetes) AS item(value)
  LOOP
    UPDATE public.pedidos_personalizados_moriah_tapetes
    SET
      teve_alteracao_layout = (v_layout->>'teve_alteracao_layout')::boolean,
      quantidade_alteracoes_layout = NULLIF(v_layout->>'quantidade_alteracoes_layout', '')::integer,
      updated_by = p_usuario_id
    WHERE id = (v_layout->>'tapete_id')::uuid;
  END LOOP;

  RETURN QUERY SELECT v_nova_version;
END;
$$;

CREATE FUNCTION public.criar_pedido_personalizado_moriah(
  p_usuario_id uuid,
  p_idempotency_key uuid,
  p_fornecedor_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_tapetes jsonb,
  p_numero_lancamento text DEFAULT NULL,
  p_data_entrega date DEFAULT NULL,
  p_data_pedido_fornecedor date DEFAULT NULL,
  p_numero_pedido_compra text DEFAULT NULL,
  p_comprador text DEFAULT NULL
)
RETURNS TABLE (
  pedido_id uuid,
  version integer,
  reutilizado boolean,
  tapetes jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
  v_tapete jsonb;
  v_cor jsonb;
  v_tapete_id uuid;
  v_produto_id uuid;
  v_cor_id uuid;
  v_total_tapetes integer;
  v_total_cores integer;
  v_tapetes_retorno jsonb := '[]'::jsonb;
BEGIN
  IF p_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.usuarios_permitidos
    WHERE id = p_usuario_id
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_INVALIDA' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_usuario_id::text || ':' || p_idempotency_key::text, 0)
  );

  SELECT *
    INTO v_pedido
  FROM public.pedidos_personalizados_pedidos
  WHERE created_by = p_usuario_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      v_pedido.id,
      v_pedido.version,
      true,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object('id', t.id, 'ordem', t.ordem)
            ORDER BY t.ordem
          )
          FROM public.pedidos_personalizados_moriah_tapetes AS t
          WHERE t.pedido_id = v_pedido.id
        ),
        '[]'::jsonb
      );
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pedidos_personalizados_fornecedores
    WHERE id = p_fornecedor_id
      AND disponivel = true
  ) THEN
    RAISE EXCEPTION 'FORNECEDOR_INDISPONIVEL' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pedidos_personalizados_fornecedores
    WHERE id = p_fornecedor_id
      AND chave = 'moriah_tapetes'
  ) THEN
    RAISE EXCEPTION 'FORNECEDOR_NAO_SUPORTADO' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_unidades
    WHERE id = p_unidade_id
      AND ativo = true
      AND chave IN ('bigorrilho', 'portao', 'marechal', 'feira')
  ) THEN
    RAISE EXCEPTION 'UNIDADE_NAO_PERMITIDA' USING ERRCODE = '22023';
  END IF;

  IF p_tapetes IS NULL OR jsonb_typeof(p_tapetes) <> 'array' THEN
    RAISE EXCEPTION 'LIMITE_TAPETES' USING ERRCODE = '22023';
  END IF;

  v_total_tapetes := jsonb_array_length(p_tapetes);
  IF v_total_tapetes NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'LIMITE_TAPETES' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tapetes) AS item(value)
    WHERE item.value->>'ordem' IS NULL
       OR item.value->>'ordem' !~ '^[0-9]+$'
  ) OR (
    SELECT count(*)
    FROM (
      SELECT item.value->>'ordem'
      FROM jsonb_array_elements(p_tapetes) AS item(value)
      GROUP BY item.value->>'ordem'
      HAVING count(*) > 1
    ) AS duplicadas
  ) > 0 THEN
    RAISE EXCEPTION 'ORDEM_TAPETE_DUPLICADA' USING ERRCODE = '22023';
  END IF;

  FOR v_tapete IN
    SELECT item.value
    FROM jsonb_array_elements(p_tapetes) AS item(value)
  LOOP
    IF jsonb_typeof(v_tapete) <> 'object'
       OR (v_tapete->>'ordem')::integer NOT BETWEEN 1 AND 10
       OR v_tapete->>'formato' NOT IN ('REDONDO', 'RETANGULAR', 'ORGANICO')
       OR v_tapete->>'dimensao_1_cm' IS NULL
       OR v_tapete->>'dimensao_1_cm' !~ '^[0-9]+$'
       OR (v_tapete->>'dimensao_1_cm')::integer NOT BETWEEN 10 AND 1500
       OR v_tapete->>'area_cobrada_centesimos_m2' IS NULL
       OR v_tapete->>'area_cobrada_centesimos_m2' !~ '^[0-9]+$'
       OR (v_tapete->>'area_cobrada_centesimos_m2')::integer NOT BETWEEN 1 AND 22500
       OR (v_tapete->>'produto_id') IS NULL
       OR (v_tapete->>'produto_id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       OR (
         v_tapete->>'formato' = 'REDONDO'
         AND v_tapete->>'dimensao_2_cm' IS NOT NULL
       )
       OR (
         v_tapete->>'formato' IN ('RETANGULAR', 'ORGANICO')
         AND (
           v_tapete->>'dimensao_2_cm' IS NULL
           OR v_tapete->>'dimensao_2_cm' !~ '^[0-9]+$'
           OR (v_tapete->>'dimensao_2_cm')::integer NOT BETWEEN 10 AND 1500
         )
       )
       OR (
         v_tapete->>'nome_colecao_catalogo' IS NOT NULL
         AND char_length(btrim(v_tapete->>'nome_colecao_catalogo')) NOT BETWEEN 1 AND 80
       )
       OR (
         v_tapete->>'referencia_catalogo' IS NOT NULL
         AND v_tapete->>'referencia_catalogo' !~ '^[A-Za-z0-9-]{1,40}$'
       )
       OR (
         v_tapete->>'observacoes' IS NOT NULL
         AND char_length(v_tapete->>'observacoes') > 500
       ) THEN
      RAISE EXCEPTION 'TAPETE_INVALIDO' USING ERRCODE = '22023';
    END IF;

    v_produto_id := (v_tapete->>'produto_id')::uuid;
    IF NOT EXISTS (
      SELECT 1
      FROM public.pedidos_personalizados_produtos
      WHERE id = v_produto_id
        AND fornecedor_id = p_fornecedor_id
        AND ativo = true
    ) THEN
      RAISE EXCEPTION 'PRODUTO_FORNECEDOR_INVALIDO' USING ERRCODE = '23514';
    END IF;

    IF v_tapete ? 'cores' AND jsonb_typeof(v_tapete->'cores') <> 'array' THEN
      RAISE EXCEPTION 'LIMITE_CORES' USING ERRCODE = '22023';
    END IF;

    v_total_cores := jsonb_array_length(COALESCE(v_tapete->'cores', '[]'::jsonb));
    IF v_total_cores > 8 THEN
      RAISE EXCEPTION 'LIMITE_CORES' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
      WHERE cor.value->>'ordem' IS NULL
         OR cor.value->>'ordem' !~ '^[0-9]+$'
         OR (cor.value->>'ordem')::integer NOT BETWEEN 1 AND 8
         OR cor.value->>'cor_id' IS NULL
         OR cor.value->>'cor_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    ) OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
      GROUP BY cor.value->>'ordem'
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'ORDEM_COR_DUPLICADA' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
      GROUP BY cor.value->>'cor_id'
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'COR_DUPLICADA' USING ERRCODE = '22023';
    END IF;

    FOR v_cor IN
      SELECT cor.value
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
    LOOP
      v_cor_id := (v_cor->>'cor_id')::uuid;
      IF NOT EXISTS (
        SELECT 1
        FROM public.pedidos_personalizados_cores
        WHERE id = v_cor_id
          AND fornecedor_id = p_fornecedor_id
          AND ativo = true
      ) THEN
        RAISE EXCEPTION 'COR_FORNECEDOR_INVALIDA' USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END LOOP;

  INSERT INTO public.pedidos_personalizados_pedidos (
    fornecedor_id,
    unidade_id,
    consultora,
    cliente,
    numero_lancamento,
    data_entrega,
    data_pedido_fornecedor,
    numero_pedido_compra,
    comprador,
    idempotency_key,
    created_by,
    updated_by
  ) VALUES (
    p_fornecedor_id,
    p_unidade_id,
    p_consultora,
    p_cliente,
    p_numero_lancamento,
    p_data_entrega,
    p_data_pedido_fornecedor,
    p_numero_pedido_compra,
    p_comprador,
    p_idempotency_key,
    p_usuario_id,
    p_usuario_id
  )
  RETURNING * INTO v_pedido;

  FOR v_tapete IN
    SELECT item.value
    FROM jsonb_array_elements(p_tapetes) AS item(value)
    ORDER BY (item.value->>'ordem')::integer
  LOOP
    v_tapete_id := gen_random_uuid();
    v_produto_id := (v_tapete->>'produto_id')::uuid;

    INSERT INTO public.pedidos_personalizados_moriah_tapetes (
      id,
      pedido_id,
      ordem,
      formato,
      dimensao_1_cm,
      dimensao_2_cm,
      area_cobrada_centesimos_m2,
      produto_id,
      nome_colecao_catalogo,
      referencia_catalogo,
      observacoes,
      created_by,
      updated_by
    ) VALUES (
      v_tapete_id,
      v_pedido.id,
      (v_tapete->>'ordem')::integer,
      v_tapete->>'formato',
      (v_tapete->>'dimensao_1_cm')::integer,
      NULLIF(v_tapete->>'dimensao_2_cm', '')::integer,
      (v_tapete->>'area_cobrada_centesimos_m2')::integer,
      v_produto_id,
      NULLIF(v_tapete->>'nome_colecao_catalogo', ''),
      NULLIF(v_tapete->>'referencia_catalogo', ''),
      v_tapete->>'observacoes',
      p_usuario_id,
      p_usuario_id
    );

    FOR v_cor IN
      SELECT cor.value
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
      ORDER BY (cor.value->>'ordem')::integer
    LOOP
      INSERT INTO public.pedidos_personalizados_tapete_cores (
        tapete_id,
        cor_id,
        ordem
      ) VALUES (
        v_tapete_id,
        (v_cor->>'cor_id')::uuid,
        (v_cor->>'ordem')::integer
      );
    END LOOP;

    v_tapetes_retorno := v_tapetes_retorno || jsonb_build_array(
      jsonb_build_object(
        'id', v_tapete_id,
        'ordem', (v_tapete->>'ordem')::integer
      )
    );
  END LOOP;

  RETURN QUERY
  SELECT v_pedido.id, v_pedido.version, false, v_tapetes_retorno;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_pedido_personalizado_moriah(
  uuid, uuid, uuid, uuid, text, text, jsonb, text, date, date, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pedido_personalizado_moriah(
  uuid, uuid, uuid, uuid, text, text, jsonb, text, date, date, text, text
) TO service_role;

REVOKE ALL ON FUNCTION public.atualizar_pedido_personalizado_comercial_moriah(
  uuid, integer, uuid, uuid, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_pedido_personalizado_comercial_moriah(
  uuid, integer, uuid, uuid, text, text, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.atualizar_pedido_personalizado_administrativo(
  uuid, integer, uuid, text, date, date, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_pedido_personalizado_administrativo(
  uuid, integer, uuid, text, date, date, text, text, text, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.registrar_anexo_pedido_personalizado(
  uuid, uuid, integer, integer, text, text, text, bigint, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_anexo_pedido_personalizado(
  uuid, uuid, integer, integer, text, text, text, bigint, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.substituir_anexo_pedido_personalizado(
  uuid, uuid, integer, text, text, text, bigint, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.substituir_anexo_pedido_personalizado(
  uuid, uuid, integer, text, text, text, bigint, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.remover_anexo_pedido_personalizado(
  uuid, uuid, integer, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remover_anexo_pedido_personalizado(
  uuid, uuid, integer, uuid
) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'pedidos-personalizados-anexos'
      AND name = 'pedidos-personalizados-anexos'
      AND public = false
      AND file_size_limit = 10485760
      AND allowed_mime_types = ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
      ]::text[]
  ) THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_BUCKET_CONFIG_INVALIDA';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        qual LIKE '%pedidos-personalizados-anexos%'
        OR with_check LIKE '%pedidos-personalizados-anexos%'
      )
  ) THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_STORAGE_POLICY_INDEVIDA';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_class AS tabela
    JOIN pg_namespace AS schema ON schema.oid = tabela.relnamespace
    WHERE schema.nspname = 'public'
      AND tabela.relname IN (
        'pedidos_personalizados_anexos',
        'pedidos_personalizados_storage_pendencias'
      )
      AND tabela.relrowsecurity = true
  ) <> 2 THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_FASE_1B_RLS_INVALIDA';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'pedidos_personalizados_anexos',
        'pedidos_personalizados_storage_pendencias'
      )
  ) THEN
    RAISE EXCEPTION 'PEDIDOS_PERSONALIZADOS_FASE_1B_POLICY_INDEVIDA';
  END IF;
END;
$$;
