-- Pedidos Personalizados - Fase 1A.
-- Corrige literais acentuados usando escapes Unicode compostos somente por ASCII.

DO $$
BEGIN
  IF to_regclass('public.pedidos_personalizados_produtos') IS NULL
     OR to_regclass('public.pedidos_personalizados_cores') IS NULL
     OR to_regclass('public.pedidos_personalizados_pedidos') IS NULL THEN
    RAISE EXCEPTION 'pedidos_personalizados_fase_1a_schema_ausente';
  END IF;
END;
$$;

UPDATE public.pedidos_personalizados_produtos AS produto
SET descricao = literal.descricao
FROM (
  VALUES
    (
      '21157'::text,
      U&'TAPETE PERSONALIZADO MORIAH M\00B2 (UMA MEDIDA PADR\00C3O at\00E9 1,95 OU 0,95 CM)'::text
    ),
    (
      '21158'::text,
      U&'TAPETE PERSONALIZADO MORIAH ESPECIAL M\00B2 (SEM EMENDA)'::text
    ),
    (
      '21159'::text,
      U&'TAPETE PERSONALIZADO MORIAH ESPECIAL M\00B2 (2 MEDIDAS ACIMA DE 2M COM EMENDA)'::text
    )
) AS literal(codigo, descricao)
WHERE produto.codigo = literal.codigo
  AND produto.fornecedor_id = (
    SELECT id
    FROM public.pedidos_personalizados_fornecedores
    WHERE chave = 'moriah_tapetes'
  );

UPDATE public.pedidos_personalizados_cores AS cor
SET nome = literal.nome
FROM (
  VALUES
    ('03'::text, U&'Azul Beb\00EA'::text),
    ('04'::text, U&'Verde Beb\00EA'::text),
    ('06'::text, U&'Rosa Beb\00EA'::text),
    ('10'::text, U&'N\00E1utico'::text),
    ('16'::text, U&'Avel\00E3'::text),
    ('17'::text, U&'\00CDndigo'::text),
    ('28'::text, U&'Bord\00F4'::text)
) AS literal(numero, nome)
WHERE cor.numero = literal.numero
  AND cor.fornecedor_id = (
    SELECT id
    FROM public.pedidos_personalizados_fornecedores
    WHERE chave = 'moriah_tapetes'
  );

ALTER TABLE public.pedidos_personalizados_pedidos
  DROP CONSTRAINT pedidos_personalizados_pedidos_status_check;

ALTER TABLE public.pedidos_personalizados_pedidos
  ADD CONSTRAINT pedidos_personalizados_pedidos_status_check
  CHECK (status IN (
    'CADASTRADO',
    'AGUARDANDO LAYOUT',
    U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE',
    U&'EM PRODU\00C7\00C3O',
    'RECEBIDO'
  ));

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.pedidos_personalizados_produtos
    WHERE (codigo = '21157' AND descricao = U&'TAPETE PERSONALIZADO MORIAH M\00B2 (UMA MEDIDA PADR\00C3O at\00E9 1,95 OU 0,95 CM)')
       OR (codigo = '21158' AND descricao = U&'TAPETE PERSONALIZADO MORIAH ESPECIAL M\00B2 (SEM EMENDA)')
       OR (codigo = '21159' AND descricao = U&'TAPETE PERSONALIZADO MORIAH ESPECIAL M\00B2 (2 MEDIDAS ACIMA DE 2M COM EMENDA)')
  ) <> 3 THEN
    RAISE EXCEPTION 'pedidos_personalizados_produtos_unicode_invalido';
  END IF;

  IF (
    SELECT count(*)
    FROM public.pedidos_personalizados_cores
    WHERE (numero = '03' AND nome = U&'Azul Beb\00EA')
       OR (numero = '04' AND nome = U&'Verde Beb\00EA')
       OR (numero = '06' AND nome = U&'Rosa Beb\00EA')
       OR (numero = '10' AND nome = U&'N\00E1utico')
       OR (numero = '16' AND nome = U&'Avel\00E3')
       OR (numero = '17' AND nome = U&'\00CDndigo')
       OR (numero = '28' AND nome = U&'Bord\00F4')
  ) <> 7 THEN
    RAISE EXCEPTION 'pedidos_personalizados_cores_unicode_invalido';
  END IF;
END;
$$;
