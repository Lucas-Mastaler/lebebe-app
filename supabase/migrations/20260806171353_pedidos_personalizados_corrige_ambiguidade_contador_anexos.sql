CREATE OR REPLACE FUNCTION public.registrar_anexo_pedido_personalizado(
  p_pedido_id uuid,
  p_tapete_id uuid,
  p_expected_version integer,
  p_slot integer,
  p_caminho_objeto text,
  p_nome_original text,
  p_mime_type text,
  p_tamanho_bytes bigint,
  p_usuario_id uuid,
  p_contabilizar_alteracao_layout boolean
)
RETURNS TABLE (
  anexo_id uuid,
  version integer,
  teve_alteracao_layout boolean,
  quantidade_alteracoes_layout integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
  v_anexo_id uuid;
  v_nova_version integer;
  v_teve_alteracao boolean;
  v_quantidade_alteracoes integer;
BEGIN
  IF p_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_permitidos WHERE id = p_usuario_id AND ativo = true
  ) THEN RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '42501'; END IF;
  IF p_contabilizar_alteracao_layout IS NULL THEN
    RAISE EXCEPTION 'CONTEXTO_ALTERACAO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos_personalizados_pedidos
  WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PEDIDO_NAO_ENCONTRADO' USING ERRCODE = 'P0002'; END IF;
  IF v_pedido.version <> p_expected_version THEN RAISE EXCEPTION 'CONFLITO_VERSAO' USING ERRCODE = 'P0003'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pedidos_personalizados_moriah_tapetes
    WHERE id = p_tapete_id AND pedido_id = p_pedido_id
  ) THEN RAISE EXCEPTION 'TAPETE_NAO_PERTENCE_AO_PEDIDO' USING ERRCODE = '23514'; END IF;
  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN
    RAISE EXCEPTION 'TIPO_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;
  IF p_tamanho_bytes IS NULL OR p_tamanho_bytes NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'TAMANHO_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;
  IF p_slot NOT IN (1, 2) THEN RAISE EXCEPTION 'LIMITE_ANEXOS' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM public.pedidos_personalizados_anexos WHERE tapete_id = p_tapete_id) >= 2 THEN
    RAISE EXCEPTION 'LIMITE_ANEXOS' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pedidos_personalizados_anexos WHERE tapete_id = p_tapete_id AND slot = p_slot) THEN
    RAISE EXCEPTION 'SLOT_ANEXO_OCUPADO' USING ERRCODE = '23505';
  END IF;
  IF p_nome_original IS NULL OR p_nome_original <> btrim(p_nome_original)
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
    v_anexo_id, p_tapete_id, p_slot, 'pedidos-personalizados-anexos', p_caminho_objeto,
    p_nome_original, p_mime_type, p_tamanho_bytes, p_usuario_id, p_usuario_id
  );

  IF p_contabilizar_alteracao_layout THEN
    UPDATE public.pedidos_personalizados_moriah_tapetes
    SET teve_alteracao_layout = true,
        quantidade_alteracoes_layout = COALESCE(pedidos_personalizados_moriah_tapetes.quantidade_alteracoes_layout, 0) + 1,
        updated_by = p_usuario_id
    WHERE id = p_tapete_id
    RETURNING pedidos_personalizados_moriah_tapetes.teve_alteracao_layout,
              pedidos_personalizados_moriah_tapetes.quantidade_alteracoes_layout
    INTO v_teve_alteracao, v_quantidade_alteracoes;
  ELSE
    SELECT tapete.teve_alteracao_layout, tapete.quantidade_alteracoes_layout
    INTO v_teve_alteracao, v_quantidade_alteracoes
    FROM public.pedidos_personalizados_moriah_tapetes AS tapete WHERE tapete.id = p_tapete_id;
  END IF;

  UPDATE public.pedidos_personalizados_pedidos
  SET version = pedidos_personalizados_pedidos.version + 1, updated_by = p_usuario_id
  WHERE id = p_pedido_id RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;
  RETURN QUERY SELECT v_anexo_id, v_nova_version, v_teve_alteracao, v_quantidade_alteracoes;
END;
$$;

CREATE OR REPLACE FUNCTION public.substituir_anexo_pedido_personalizado(
  p_pedido_id uuid,
  p_anexo_id uuid,
  p_expected_version integer,
  p_caminho_objeto text,
  p_nome_original text,
  p_mime_type text,
  p_tamanho_bytes bigint,
  p_usuario_id uuid,
  p_contabilizar_alteracao_layout boolean
)
RETURNS TABLE (
  anexo_id uuid,
  caminho_antigo text,
  version integer,
  teve_alteracao_layout boolean,
  quantidade_alteracoes_layout integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
  v_anexo public.pedidos_personalizados_anexos%ROWTYPE;
  v_nova_version integer;
  v_teve_alteracao boolean;
  v_quantidade_alteracoes integer;
BEGIN
  IF p_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_permitidos WHERE id = p_usuario_id AND ativo = true
  ) THEN RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '42501'; END IF;
  IF p_contabilizar_alteracao_layout IS NULL THEN
    RAISE EXCEPTION 'CONTEXTO_ALTERACAO_INVALIDO' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_pedido FROM public.pedidos_personalizados_pedidos
  WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PEDIDO_NAO_ENCONTRADO' USING ERRCODE = 'P0002'; END IF;
  IF v_pedido.version <> p_expected_version THEN RAISE EXCEPTION 'CONFLITO_VERSAO' USING ERRCODE = 'P0003'; END IF;
  SELECT anexo.* INTO v_anexo
  FROM public.pedidos_personalizados_anexos AS anexo
  JOIN public.pedidos_personalizados_moriah_tapetes AS tapete ON tapete.id = anexo.tapete_id
  WHERE anexo.id = p_anexo_id AND tapete.pedido_id = p_pedido_id FOR UPDATE OF anexo;
  IF NOT FOUND THEN RAISE EXCEPTION 'ANEXO_NAO_ENCONTRADO' USING ERRCODE = 'P0002'; END IF;
  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN
    RAISE EXCEPTION 'TIPO_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;
  IF p_tamanho_bytes IS NULL OR p_tamanho_bytes NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'TAMANHO_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;
  IF p_nome_original IS NULL OR p_nome_original <> btrim(p_nome_original)
     OR char_length(p_nome_original) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'NOME_ARQUIVO_INVALIDO' USING ERRCODE = '22023';
  END IF;
  IF p_caminho_objeto IS NULL OR p_caminho_objeto = v_anexo.caminho_objeto
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

  INSERT INTO public.pedidos_personalizados_storage_pendencias (bucket_id, caminho_objeto, motivo)
  VALUES (v_anexo.bucket_id, v_anexo.caminho_objeto, 'SUBSTITUICAO')
  ON CONFLICT (bucket_id, caminho_objeto) WHERE processado_em IS NULL DO NOTHING;
  UPDATE public.pedidos_personalizados_anexos
  SET caminho_objeto = p_caminho_objeto, nome_original = p_nome_original,
      mime_type = p_mime_type, tamanho_bytes = p_tamanho_bytes, updated_by = p_usuario_id
  WHERE id = p_anexo_id;

  IF p_contabilizar_alteracao_layout THEN
    UPDATE public.pedidos_personalizados_moriah_tapetes
    SET teve_alteracao_layout = true,
        quantidade_alteracoes_layout = COALESCE(pedidos_personalizados_moriah_tapetes.quantidade_alteracoes_layout, 0) + 1,
        updated_by = p_usuario_id
    WHERE id = v_anexo.tapete_id
    RETURNING pedidos_personalizados_moriah_tapetes.teve_alteracao_layout,
              pedidos_personalizados_moriah_tapetes.quantidade_alteracoes_layout
    INTO v_teve_alteracao, v_quantidade_alteracoes;
  ELSE
    SELECT tapete.teve_alteracao_layout, tapete.quantidade_alteracoes_layout
    INTO v_teve_alteracao, v_quantidade_alteracoes
    FROM public.pedidos_personalizados_moriah_tapetes AS tapete WHERE tapete.id = v_anexo.tapete_id;
  END IF;
  UPDATE public.pedidos_personalizados_pedidos
  SET version = pedidos_personalizados_pedidos.version + 1, updated_by = p_usuario_id
  WHERE id = p_pedido_id RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;
  RETURN QUERY SELECT p_anexo_id, v_anexo.caminho_objeto, v_nova_version, v_teve_alteracao, v_quantidade_alteracoes;
END;
$$;

CREATE OR REPLACE FUNCTION public.remover_anexo_pedido_personalizado(
  p_pedido_id uuid,
  p_anexo_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_contabilizar_alteracao_layout boolean
)
RETURNS TABLE (
  caminho_enfileirado text,
  version integer,
  teve_alteracao_layout boolean,
  quantidade_alteracoes_layout integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
  v_anexo public.pedidos_personalizados_anexos%ROWTYPE;
  v_nova_version integer;
  v_teve_alteracao boolean;
  v_quantidade_alteracoes integer;
BEGIN
  IF p_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_permitidos WHERE id = p_usuario_id AND ativo = true
  ) THEN RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '42501'; END IF;
  IF p_contabilizar_alteracao_layout IS NULL THEN
    RAISE EXCEPTION 'CONTEXTO_ALTERACAO_INVALIDO' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_pedido FROM public.pedidos_personalizados_pedidos
  WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PEDIDO_NAO_ENCONTRADO' USING ERRCODE = 'P0002'; END IF;
  IF v_pedido.version <> p_expected_version THEN RAISE EXCEPTION 'CONFLITO_VERSAO' USING ERRCODE = 'P0003'; END IF;
  SELECT anexo.* INTO v_anexo
  FROM public.pedidos_personalizados_anexos AS anexo
  JOIN public.pedidos_personalizados_moriah_tapetes AS tapete ON tapete.id = anexo.tapete_id
  WHERE anexo.id = p_anexo_id AND tapete.pedido_id = p_pedido_id FOR UPDATE OF anexo;
  IF NOT FOUND THEN RAISE EXCEPTION 'ANEXO_NAO_ENCONTRADO' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.pedidos_personalizados_storage_pendencias (bucket_id, caminho_objeto, motivo)
  VALUES (v_anexo.bucket_id, v_anexo.caminho_objeto, 'REMOCAO_ANEXO')
  ON CONFLICT (bucket_id, caminho_objeto) WHERE processado_em IS NULL DO NOTHING;
  DELETE FROM public.pedidos_personalizados_anexos WHERE id = p_anexo_id;

  IF p_contabilizar_alteracao_layout THEN
    UPDATE public.pedidos_personalizados_moriah_tapetes
    SET teve_alteracao_layout = true,
        quantidade_alteracoes_layout = COALESCE(pedidos_personalizados_moriah_tapetes.quantidade_alteracoes_layout, 0) + 1,
        updated_by = p_usuario_id
    WHERE id = v_anexo.tapete_id
    RETURNING pedidos_personalizados_moriah_tapetes.teve_alteracao_layout,
              pedidos_personalizados_moriah_tapetes.quantidade_alteracoes_layout
    INTO v_teve_alteracao, v_quantidade_alteracoes;
  ELSE
    SELECT tapete.teve_alteracao_layout, tapete.quantidade_alteracoes_layout
    INTO v_teve_alteracao, v_quantidade_alteracoes
    FROM public.pedidos_personalizados_moriah_tapetes AS tapete WHERE tapete.id = v_anexo.tapete_id;
  END IF;
  UPDATE public.pedidos_personalizados_pedidos
  SET version = pedidos_personalizados_pedidos.version + 1, updated_by = p_usuario_id
  WHERE id = p_pedido_id RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;
  RETURN QUERY SELECT v_anexo.caminho_objeto, v_nova_version, v_teve_alteracao, v_quantidade_alteracoes;
END;
$$;


