-- Alinha o limite de cores de criar_pedido_personalizado_moriah (12 args, funcao
-- nucleo) ao limite real ja corrigido em atualizar_pedido_personalizado_produtos_moriah
-- na tarefa anterior: a validacao de dominio ainda aceitava ate 8 cores, enquanto a
-- constraint real (pedidos_personalizados_tapete_cores_ordem_check) so permite ordem
-- entre 1 e 6. Isso fazia 7 ou 8 cores na criacao falharem com uma violacao de
-- constraint bruta (23514) em vez do erro de dominio LIMITE_CORES.
--
-- Unica mudanca funcional: o limite de quantidade de cores (8 -> 6) e o intervalo
-- valido de "ordem" por cor (1-8 -> 1-6), espelhando exatamente o que ja foi corrigido
-- na RPC de edicao de produtos. Todo o restante da funcao permanece identico.
--
-- A sobrecarga de 13 argumentos (com p_telefone_normalizado) apenas delega para esta
-- funcao de 12 argumentos e nao tem validacao de cores propria — nao precisa de
-- CREATE OR REPLACE separado.

CREATE OR REPLACE FUNCTION public.criar_pedido_personalizado_moriah(
  p_usuario_id uuid,
  p_idempotency_key uuid,
  p_fornecedor_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_tapetes jsonb,
  p_numero_lancamento text DEFAULT NULL::text,
  p_data_entrega date DEFAULT NULL::date,
  p_data_pedido_fornecedor date DEFAULT NULL::date,
  p_numero_pedido_compra text DEFAULT NULL::text,
  p_comprador text DEFAULT NULL::text
)
 RETURNS TABLE(pedido_id uuid, version integer, reutilizado boolean, tapetes jsonb)
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
       OR v_tapete->>'tipo' NOT IN ('CATALOGO', 'PERSONALIZADO')
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
       )
       OR (
         v_tapete->>'tipo' = 'CATALOGO'
         AND (
           v_tapete->>'nome_colecao_catalogo' IS NULL
           OR btrim(v_tapete->>'nome_colecao_catalogo') = ''
           OR v_tapete->>'referencia_catalogo' IS NULL
           OR btrim(v_tapete->>'referencia_catalogo') = ''
         )
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
    -- Correcao: o limite real e 6 (constraint pedidos_personalizados_tapete_cores_ordem_check
    -- e LIMITE_CORES_POR_TAPETE do frontend); a versao anterior desta validacao aceitava ate 8,
    -- deixando 7/8 cores chegarem a constraint como violacao bruta (23514) em vez de LIMITE_CORES.
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
      tipo,
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

    -- Catálogo nunca persiste cores selecionadas manualmente: a referência
    -- do catálogo já representa o produto por completo.
    IF v_tapete->>'tipo' <> 'CATALOGO' THEN
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
    END IF;

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
$function$;
