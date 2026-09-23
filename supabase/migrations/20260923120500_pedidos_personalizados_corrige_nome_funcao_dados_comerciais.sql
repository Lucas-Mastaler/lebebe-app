-- Corrige nomes de função criados na migration anterior
-- (pedidos_personalizados_separa_produtos_dados_comerciais).
--
-- `atualizar_pedido_personalizado_dados_comerciais_lebebe_exclusive` tem 64
-- caracteres, um a mais que o limite de identificador do Postgres (63
-- bytes / NAMEDATALEN 64). O Postgres truncou silenciosamente o nome para
-- `atualizar_pedido_personalizado_dados_comerciais_lebebe_exclusiv` (sem o
-- "e" final) ao criar a função, o que quebraria a chamada via
-- `supabase.rpc('atualizar_pedido_personalizado_dados_comerciais_lebebe_
-- exclusive', ...)` feita pela aplicação (nome completo não bate com o
-- nome truncado armazenado em pg_proc).
--
-- Correção: renomear as duas novas funções de dados comerciais (Moriah e
-- Lebebe Exclusive) para reaproveitar o padrão de nome já usado pela
-- função combinada antiga removida na migration anterior
-- (`atualizar_pedido_personalizado_comercial_<fornecedor>`), agora com uma
-- assinatura nova (sem o parâmetro de tapetes/itens em jsonb), o que não
-- gera conflito de overload porque as assinaturas antigas foram
-- removidas na mesma migration anterior. Isso mantém o nome bem abaixo do
-- limite de 63 caracteres nos dois fornecedores.

DROP FUNCTION IF EXISTS public.atualizar_pedido_personalizado_dados_comerciais_moriah(
  uuid, integer, uuid, uuid, text, text, text, text
);
DROP FUNCTION IF EXISTS public.atualizar_pedido_personalizado_dados_comerciais_lebebe_exclusive(
  uuid, integer, uuid, uuid, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.atualizar_pedido_personalizado_comercial_moriah(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_telefone_normalizado text,
  p_numero_lancamento text
)
RETURNS TABLE(version integer)
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
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

  IF v_pedido.status NOT IN (
    'RASCUNHO', 'VENDA FECHADA',
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

  IF p_consultora IS NULL OR char_length(btrim(p_consultora)) NOT BETWEEN 2 AND 20 THEN
    RAISE EXCEPTION 'CONSULTORA_INVALIDA' USING ERRCODE = '22023';
  END IF;
  IF p_cliente IS NULL OR char_length(btrim(p_cliente)) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'CLIENTE_INVALIDO' USING ERRCODE = '22023';
  END IF;

  -- NULL é permitido exclusivamente para compatibilidade com pedidos
  -- legados que ainda não possuem telefone: nesse caso o valor atual é
  -- preservado em vez de apagado.
  IF p_telefone_normalizado IS NOT NULL THEN
    IF p_telefone_normalizado !~ '^[0-9]{10,11}$'
       OR left(p_telefone_normalizado, 2) = '00'
    THEN
      RAISE EXCEPTION 'TELEFONE_INVALIDO' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_numero_lancamento IS NOT NULL AND p_numero_lancamento !~ '^[0-9]{1,6}$' THEN
    RAISE EXCEPTION 'NUMERO_LANCAMENTO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  UPDATE public.pedidos_personalizados_pedidos
  SET unidade_id = p_unidade_id,
      consultora = btrim(p_consultora),
      cliente = btrim(p_cliente),
      telefone_normalizado = COALESCE(p_telefone_normalizado, telefone_normalizado),
      numero_lancamento = p_numero_lancamento,
      version = pedidos_personalizados_pedidos.version + 1,
      updated_by = p_usuario_id
  WHERE id = p_pedido_id
  RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;

  RETURN QUERY SELECT v_nova_version;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atualizar_pedido_personalizado_comercial_lebebe_exclusive(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_telefone_normalizado text,
  p_numero_lancamento text
)
RETURNS TABLE(version integer)
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_pedido public.pedidos_personalizados_pedidos%ROWTYPE;
  v_nova_version integer;
BEGIN
  IF p_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_permitidos WHERE id = p_usuario_id AND ativo = true
  ) THEN RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_pedido FROM public.pedidos_personalizados_pedidos
  WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PEDIDO_NAO_ENCONTRADO' USING ERRCODE = 'P0002'; END IF;
  IF v_pedido.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLITO_VERSAO' USING ERRCODE = 'P0003';
  END IF;
  IF v_pedido.status NOT IN ('RASCUNHO', 'VENDA FECHADA') THEN
    RAISE EXCEPTION 'EDICAO_COMERCIAL_BLOQUEADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pedidos_personalizados_fornecedores
    WHERE id = v_pedido.fornecedor_id AND chave = 'lebebe_exclusive'
  ) THEN RAISE EXCEPTION 'FORNECEDOR_NAO_SUPORTADO' USING ERRCODE = '22023'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.app_unidades
    WHERE id = p_unidade_id AND ativo = true
      AND chave IN ('bigorrilho', 'portao', 'marechal', 'feira')
  ) THEN RAISE EXCEPTION 'UNIDADE_NAO_PERMITIDA' USING ERRCODE = '22023'; END IF;
  IF p_consultora IS NULL OR char_length(btrim(p_consultora)) NOT BETWEEN 2 AND 20 THEN
    RAISE EXCEPTION 'CONSULTORA_INVALIDA' USING ERRCODE = '22023';
  END IF;
  IF p_cliente IS NULL OR char_length(btrim(p_cliente)) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'CLIENTE_INVALIDO' USING ERRCODE = '22023';
  END IF;
  IF p_telefone_normalizado IS NULL
     OR p_telefone_normalizado !~ '^[0-9]{10,11}$'
     OR left(p_telefone_normalizado, 2) = '00'
  THEN RAISE EXCEPTION 'TELEFONE_INVALIDO' USING ERRCODE = '22023'; END IF;
  IF p_numero_lancamento IS NOT NULL AND p_numero_lancamento !~ '^[0-9]{1,6}$' THEN
    RAISE EXCEPTION 'NUMERO_LANCAMENTO_INVALIDO' USING ERRCODE = '22023';
  END IF;

  UPDATE public.pedidos_personalizados_pedidos
  SET unidade_id = p_unidade_id,
      consultora = btrim(p_consultora),
      cliente = btrim(p_cliente),
      telefone_normalizado = p_telefone_normalizado,
      numero_lancamento = p_numero_lancamento,
      version = pedidos_personalizados_pedidos.version + 1,
      updated_by = p_usuario_id
  WHERE id = p_pedido_id
  RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;

  RETURN QUERY SELECT v_nova_version;
END;
$function$;
