-- Separa a atualização de "dados comerciais" (identificação da venda) da
-- atualização de "produtos" (composição do pedido: tapetes/cores ou itens)
-- para os pedidos personalizados.
--
-- Contexto (auditoria prévia, não commitada em docs/): o botão único
-- "Editar dados comerciais" reabria também a composição do pedido
-- (tapetes/cores ou itens), sem distinção clara para o usuário e sem
-- travar a edição de produtos fora de RASCUNHO. Esta migration:
--
-- 1. Cria `atualizar_pedido_personalizado_dados_comerciais_moriah` e
--    `atualizar_pedido_personalizado_dados_comerciais_lebebe_exclusive`,
--    que atualizam somente unidade/consultora/cliente/telefone/lançamento,
--    preservando exatamente os status hoje permitidos
--    (RASCUNHO, VENDA FECHADA, AGUARDANDO LAYOUT, AGUARDANDO APROVAÇÃO DO
--    CLIENTE para Moriah; RASCUNHO, VENDA FECHADA para Lebebe Exclusive).
-- 2. Cria `atualizar_pedido_personalizado_produtos_moriah` e
--    `atualizar_pedido_personalizado_produtos_lebebe_exclusive`, que
--    atualizam somente a composição do pedido (tapetes/cores ou itens) e
--    passam a exigir status = RASCUNHO (decisão de negócio desta tarefa;
--    antes, Moriah permitia editar tapetes também em VENDA FECHADA,
--    AGUARDANDO LAYOUT e AGUARDANDO APROVAÇÃO DO CLIENTE, e Lebebe
--    Exclusive também em VENDA FECHADA).
-- 3. Corrige, na nova função de produtos Moriah, um bug confirmado: ao
--    manter um tapete existente (payload com `id`), as cores antigas
--    daquele tapete nunca eram apagadas antes de inserir o novo conjunto,
--    violando `pedidos_personalizados_tapete_cores_pkey`/
--    `..._tapete_ordem_unique` sempre que alguma cor permanecia, ou
--    deixando cores antigas orfãs quando todas eram removidas. Reproduzido
--    e confirmado por transação com rollback contra dado real de produção
--    antes desta migration.
-- 4. Corrige, na mesma função, o limite de cores por tapete validado em
--    PL/pgSQL: era `> 8`, mas a constraint real
--    (`pedidos_personalizados_tapete_cores_ordem_check`, ordem 1..6) e o
--    limite do frontend (`LIMITE_CORES_POR_TAPETE`) já são 6.
-- 5. Remove as funções antigas combinadas (`atualizar_pedido_personalizado
--    _comercial_moriah` nos três overloads existentes e
--    `..._comercial_lebebe_exclusive`), já que nenhum código de aplicação
--    passa a chamá-las após esta migration.

-- =========================================================================
-- 1. Dados comerciais — Moriah (somente identificação; nenhum tapete aqui)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.atualizar_pedido_personalizado_dados_comerciais_moriah(
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

-- =========================================================================
-- 2. Produtos — Moriah (somente tapetes/cores; RASCUNHO apenas; bug corrigido)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.atualizar_pedido_personalizado_produtos_moriah(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_tapetes jsonb
)
RETURNS TABLE(version integer, tapetes jsonb)
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
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

  -- Decisão de negócio desta tarefa: produtos só são editáveis em RASCUNHO.
  IF v_pedido.status <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'EDICAO_PRODUTOS_BLOQUEADA' USING ERRCODE = 'P0001';
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
       OR v_tapete->>'tipo' NOT IN ('CATALOGO', 'PERSONALIZADO')
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
       OR (
         v_tapete->>'tipo' = 'CATALOGO'
         AND (
           v_tapete->>'nome_colecao_catalogo' IS NULL
           OR btrim(v_tapete->>'nome_colecao_catalogo') = ''
           OR v_tapete->>'referencia_catalogo' IS NULL
           OR btrim(v_tapete->>'referencia_catalogo') = ''
         )
       )
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
    -- Correção: o limite real é 6 (constraint pedidos_personalizados_tapete_cores_ordem_check
    -- e LIMITE_CORES_POR_TAPETE do frontend); a versão anterior desta validação aceitava até 8.
    IF v_total_cores > 6 THEN
      RAISE EXCEPTION 'LIMITE_CORES' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_tapete->'cores', '[]'::jsonb)) AS cor(value)
      WHERE cor.value->>'ordem' IS NULL
         OR cor.value->>'ordem' !~ '^[0-9]+$'
         OR (cor.value->>'ordem')::integer NOT BETWEEN 1 AND 6
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
    AND tapete.pedido_id = p_pedido_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_tapetes) AS item(value)
      WHERE item.value ? 'id'
        AND item.value->>'id' = tapete.id::text
    );

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
        tipo = v_tapete->>'tipo',
        dimensao_1_cm = (v_tapete->>'dimensao_1_cm')::integer,
        dimensao_2_cm = NULLIF(v_tapete->>'dimensao_2_cm', '')::integer,
        area_cobrada_centesimos_m2 = (v_tapete->>'area_cobrada_centesimos_m2')::integer,
        produto_id = v_produto_id,
        nome_colecao_catalogo = NULLIF(v_tapete->>'nome_colecao_catalogo', ''),
        referencia_catalogo = NULLIF(v_tapete->>'referencia_catalogo', ''),
        observacoes = v_tapete->>'observacoes',
        updated_by = p_usuario_id
      WHERE id = v_tapete_id;

      -- Correção do bug confirmado na auditoria: sem este DELETE, as cores
      -- antigas do tapete mantido nunca eram removidas antes do INSERT
      -- abaixo, violando pedidos_personalizados_tapete_cores_pkey/
      -- ..._tapete_ordem_unique sempre que alguma cor permanecia, ou
      -- deixando cores órfãs quando todas eram removidas.
      DELETE FROM public.pedidos_personalizados_tapete_cores
      WHERE tapete_id = v_tapete_id;
    ELSE
      v_tapete_id := gen_random_uuid();
      INSERT INTO public.pedidos_personalizados_moriah_tapetes (
        id, pedido_id, ordem, formato, tipo, dimensao_1_cm, dimensao_2_cm,
        area_cobrada_centesimos_m2, produto_id, nome_colecao_catalogo,
        referencia_catalogo, observacoes, created_by, updated_by
      ) VALUES (
        v_tapete_id,
        p_pedido_id,
        (v_tapete->>'ordem')::integer,
        v_tapete->>'formato',
        v_tapete->>'tipo',
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

    -- Catálogo nunca mantém cores indevidamente: mesmo que um payload malformado
    -- traga cores para um tapete Catálogo, elas nunca são persistidas aqui.
    IF v_tapete->>'tipo' <> 'CATALOGO' THEN
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
    END IF;

    v_tapetes_retorno := v_tapetes_retorno || jsonb_build_array(
      jsonb_build_object('id', v_tapete_id, 'ordem', (v_tapete->>'ordem')::integer)
    );
  END LOOP;

  SET CONSTRAINTS pedidos_personalizados_moriah_tapetes_pedido_ordem_unique IMMEDIATE;

  UPDATE public.pedidos_personalizados_pedidos
  SET
    version = pedidos_personalizados_pedidos.version + 1,
    updated_by = p_usuario_id
  WHERE id = p_pedido_id
  RETURNING pedidos_personalizados_pedidos.version INTO v_nova_version;

  RETURN QUERY SELECT v_nova_version, v_tapetes_retorno;
END;
$function$;

-- =========================================================================
-- 3. Dados comerciais — Lebebe Exclusive (somente identificação)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.atualizar_pedido_personalizado_dados_comerciais_lebebe_exclusive(
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

-- =========================================================================
-- 4. Produtos — Lebebe Exclusive (somente itens; RASCUNHO apenas)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.atualizar_pedido_personalizado_produtos_lebebe_exclusive(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_itens jsonb
)
RETURNS TABLE(version integer, itens jsonb)
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_pedido public.pedidos_personalizados_pedidos%rowtype;
  v_item jsonb;
  v_catalogo record;
  v_item_id uuid;
  v_total_itens integer;
  v_nova_version integer;
  v_itens_retorno jsonb := '[]'::jsonb;
begin
  if p_usuario_id is null or not exists (
    select 1 from public.usuarios_permitidos where id = p_usuario_id and ativo = true
  ) then raise exception 'USUARIO_INVALIDO' using errcode = '42501'; end if;

  select * into v_pedido from public.pedidos_personalizados_pedidos
  where id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode = 'P0002'; end if;
  if v_pedido.version <> p_expected_version then
    raise exception 'CONFLITO_VERSAO' using errcode = 'P0003';
  end if;

  -- Decisão de negócio desta tarefa: produtos só são editáveis em RASCUNHO
  -- (antes, Lebebe Exclusive também permitia editar itens em VENDA FECHADA
  -- através da função combinada de dados comerciais).
  if v_pedido.status <> 'RASCUNHO' then
    raise exception 'EDICAO_PRODUTOS_BLOQUEADA' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.pedidos_personalizados_fornecedores
    where id = v_pedido.fornecedor_id and chave = 'lebebe_exclusive'
  ) then raise exception 'FORNECEDOR_NAO_SUPORTADO' using errcode = '22023'; end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) < 1 then
    raise exception 'ITENS_OBRIGATORIOS' using errcode = '22023';
  end if;

  v_total_itens := jsonb_array_length(p_itens);
  if exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    where jsonb_typeof(item.value) <> 'object'
       or item.value->>'produto_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       or item.value->>'ordem' !~ '^[0-9]+$'
       or (item.value->>'ordem')::integer not between 1 and v_total_itens
       or item.value->>'quantidade' !~ '^[0-9]+$'
       or (item.value->>'quantidade')::integer < 1
       or (item.value->>'nome_ou_letra' is not null and (
         btrim(item.value->>'nome_ou_letra') = ''
         or char_length(btrim(item.value->>'nome_ou_letra')) > 200
       ))
  ) or exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    group by item.value->>'ordem' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    group by item.value->>'produto_id' having count(*) > 1
  ) then raise exception 'ITEM_PEDIDO_INVALIDO' using errcode = '22023'; end if;

  delete from public.pedidos_personalizados_lebebe_exclusive_itens
  where pedido_id = p_pedido_id;

  for v_item in
    select item.value from jsonb_array_elements(p_itens) as item(value)
    order by (item.value->>'ordem')::integer
  loop
    select produto.id, produto.descricao, catalogo.colecao, catalogo.referencia,
           catalogo.preco_unitario, catalogo.custo_unitario
      into v_catalogo
    from public.pedidos_personalizados_produtos as produto
    join public.pedidos_personalizados_lebebe_exclusive_catalogo as catalogo
      on catalogo.produto_id = produto.id
    where produto.id = (v_item->>'produto_id')::uuid
      and produto.fornecedor_id = v_pedido.fornecedor_id
      and produto.ativo = true;
    if not found then raise exception 'PRODUTO_FORNECEDOR_INVALIDO' using errcode = '23514'; end if;

    insert into public.pedidos_personalizados_lebebe_exclusive_itens (
      pedido_id, produto_id, ordem, quantidade, nome_ou_letra,
      colecao_snapshot, descricao_snapshot, referencia_snapshot,
      preco_unitario_snapshot, custo_unitario_snapshot, created_by, updated_by
    ) values (
      p_pedido_id, v_catalogo.id, (v_item->>'ordem')::integer,
      (v_item->>'quantidade')::integer, nullif(btrim(v_item->>'nome_ou_letra'), ''),
      v_catalogo.colecao, v_catalogo.descricao, v_catalogo.referencia,
      v_catalogo.preco_unitario, v_catalogo.custo_unitario,
      p_usuario_id, p_usuario_id
    ) returning id into v_item_id;
    v_itens_retorno := v_itens_retorno || jsonb_build_array(
      jsonb_build_object('id', v_item_id, 'ordem', (v_item->>'ordem')::integer)
    );
  end loop;

  update public.pedidos_personalizados_pedidos
  set version = pedidos_personalizados_pedidos.version + 1,
      updated_by = p_usuario_id
  where id = p_pedido_id
  returning pedidos_personalizados_pedidos.version into v_nova_version;

  return query select v_nova_version, v_itens_retorno;
end;
$function$;

-- =========================================================================
-- 5. Remove as funções combinadas antigas (substituídas acima)
-- =========================================================================
DROP FUNCTION IF EXISTS public.atualizar_pedido_personalizado_comercial_moriah(
  uuid, integer, uuid, uuid, text, text, jsonb
);
DROP FUNCTION IF EXISTS public.atualizar_pedido_personalizado_comercial_moriah(
  uuid, integer, uuid, uuid, text, text, text, jsonb
);
DROP FUNCTION IF EXISTS public.atualizar_pedido_personalizado_comercial_moriah(
  uuid, integer, uuid, uuid, text, text, text, text, jsonb
);
DROP FUNCTION IF EXISTS public.atualizar_pedido_personalizado_comercial_lebebe_exclusive(
  uuid, integer, uuid, uuid, text, text, text, text, jsonb
);
