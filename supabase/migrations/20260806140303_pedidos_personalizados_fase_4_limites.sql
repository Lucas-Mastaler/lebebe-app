DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.pedidos_personalizados_pedidos
    WHERE numero_lancamento IS NOT NULL
      AND numero_lancamento !~ '^[0-9]{1,6}$'
  ) THEN
    RAISE EXCEPTION 'Existem números de lançamento incompatíveis com o limite de 6 dígitos.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pedidos_personalizados_moriah_tapetes
    WHERE nome_colecao_catalogo IS NOT NULL
      AND char_length(btrim(nome_colecao_catalogo)) NOT BETWEEN 1 AND 30
  ) THEN
    RAISE EXCEPTION 'Existem nomes de coleção incompatíveis com o limite de 30 caracteres.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pedidos_personalizados_moriah_tapetes
    WHERE referencia_catalogo IS NOT NULL
      AND referencia_catalogo !~ '^[A-Za-z0-9-]{1,20}$'
  ) THEN
    RAISE EXCEPTION 'Existem referências incompatíveis com o limite de 20 caracteres.';
  END IF;
END;
$$;

ALTER TABLE public.pedidos_personalizados_pedidos
  DROP CONSTRAINT pedidos_personalizados_pedidos_numero_lancamento_check;

ALTER TABLE public.pedidos_personalizados_pedidos
  ADD CONSTRAINT pedidos_personalizados_pedidos_numero_lancamento_check
  CHECK (
    numero_lancamento IS NULL
    OR numero_lancamento ~ '^[0-9]{1,6}$'
  );

ALTER TABLE public.pedidos_personalizados_moriah_tapetes
  DROP CONSTRAINT pedidos_personalizados_moriah_tapetes_colecao_check;

ALTER TABLE public.pedidos_personalizados_moriah_tapetes
  ADD CONSTRAINT pedidos_personalizados_moriah_tapetes_colecao_check
  CHECK (
    nome_colecao_catalogo IS NULL
    OR char_length(btrim(nome_colecao_catalogo)) BETWEEN 1 AND 30
  );

ALTER TABLE public.pedidos_personalizados_moriah_tapetes
  DROP CONSTRAINT pedidos_personalizados_moriah_tapetes_referencia_check;

ALTER TABLE public.pedidos_personalizados_moriah_tapetes
  ADD CONSTRAINT pedidos_personalizados_moriah_tapetes_referencia_check
  CHECK (
    referencia_catalogo IS NULL
    OR referencia_catalogo ~ '^[A-Za-z0-9-]{1,20}$'
  );
