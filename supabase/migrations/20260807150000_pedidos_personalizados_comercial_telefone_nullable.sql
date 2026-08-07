-- Corrige a 3ª overload de atualizar_pedido_personalizado_comercial_moriah.
--
-- Objetivo:
-- permitir que pedidos legados com telefone_normalizado = NULL sejam
-- atualizados comercialmente em uma única operação atômica.
--
-- Regras:
-- - p_telefone_normalizado NULL:
--     mantém o telefone atual (legado sem telefone).
-- - p_telefone_normalizado preenchido:
--     valida e atualiza o telefone.
-- - p_numero_lancamento:
--     sempre validado e atualizado.
-- - tapetes, consultora, cliente, unidade e version:
--     continuam processados pela overload core.
--
-- Toda a operação ocorre na mesma transação PostgreSQL.

CREATE OR REPLACE FUNCTION public.atualizar_pedido_personalizado_comercial_moriah(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_telefone_normalizado text,
  p_numero_lancamento text,
  p_tapetes jsonb
)
RETURNS TABLE (
  version integer,
  tapetes jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_resultado record;
BEGIN
  -- Número de lançamento é opcional, mas quando preenchido
  -- deve conter de 1 a 6 dígitos.
  IF p_numero_lancamento IS NOT NULL
     AND p_numero_lancamento !~ '^[0-9]{1,6}$'
  THEN
    RAISE EXCEPTION 'NUMERO_LANCAMENTO_INVALIDO'
      USING ERRCODE = '22023';
  END IF;

  -- NULL é permitido exclusivamente para compatibilidade
  -- com pedidos legados que ainda não possuem telefone.
  IF p_telefone_normalizado IS NOT NULL THEN
    IF p_telefone_normalizado !~ '^[0-9]{10,11}$'
       OR left(p_telefone_normalizado, 2) = '00'
    THEN
      RAISE EXCEPTION 'TELEFONE_INVALIDO'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Executa toda a atualização comercial core.
  -- Esta overload:
  -- - valida usuário;
  -- - faz FOR UPDATE no pedido;
  -- - valida expectedVersion;
  -- - valida status;
  -- - atualiza unidade/consultora/cliente/tapetes;
  -- - incrementa version exatamente uma vez.
  SELECT *
  INTO v_resultado
  FROM public.atualizar_pedido_personalizado_comercial_moriah(
    p_pedido_id,
    p_expected_version,
    p_usuario_id,
    p_unidade_id,
    p_consultora,
    p_cliente,
    p_tapetes
  );

  -- Para pedidos legados, NULL significa preservar o telefone existente.
  IF p_telefone_normalizado IS NOT NULL THEN
    UPDATE public.pedidos_personalizados_pedidos AS pedido
    SET telefone_normalizado = p_telefone_normalizado
    WHERE pedido.id = p_pedido_id;
  END IF;

  -- O lançamento participa da mesma operação/transação.
  UPDATE public.pedidos_personalizados_pedidos AS pedido
  SET numero_lancamento = p_numero_lancamento
  WHERE pedido.id = p_pedido_id;

  RETURN QUERY
  SELECT
    v_resultado.version::integer,
    v_resultado.tapetes::jsonb;
END;
$function$;

REVOKE ALL
ON FUNCTION public.atualizar_pedido_personalizado_comercial_moriah(
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.atualizar_pedido_personalizado_comercial_moriah(
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb
)
TO service_role;