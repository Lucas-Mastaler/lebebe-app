BEGIN;

CREATE TEMP TABLE teste_pedidos_fase_4
  (LIKE public.pedidos_personalizados_pedidos INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

CREATE TEMP TABLE teste_tapetes_fase_4
  (LIKE public.pedidos_personalizados_moriah_tapetes INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

INSERT INTO teste_pedidos_fase_4 (
  fornecedor_id, unidade_id, consultora, cliente, numero_lancamento, idempotency_key, created_by, updated_by
) VALUES (
  gen_random_uuid(), gen_random_uuid(), 'AA', 'C', '000001', gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
);

DO $$
DECLARE
  rejeitado boolean := false;
BEGIN
  BEGIN
    INSERT INTO teste_pedidos_fase_4 (
      fornecedor_id, unidade_id, consultora, cliente, numero_lancamento, idempotency_key, created_by, updated_by
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), 'AA', 'C', '0000001', gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
    );
  EXCEPTION WHEN check_violation THEN
    rejeitado := true;
  END;
  IF NOT rejeitado THEN
    RAISE EXCEPTION 'A constraint aceitou número de lançamento com 7 dígitos.';
  END IF;
END;
$$;

INSERT INTO teste_tapetes_fase_4 (
  pedido_id, ordem, formato, dimensao_1_cm, dimensao_2_cm,
  area_cobrada_centesimos_m2, produto_id, nome_colecao_catalogo,
  referencia_catalogo, created_by, updated_by
) VALUES (
  gen_random_uuid(), 1, 'RETANGULAR', 100, 100,
  100, gen_random_uuid(), repeat('A', 30), repeat('R', 20),
  gen_random_uuid(), gen_random_uuid()
);

DO $$
DECLARE
  colecao_rejeitada boolean := false;
  referencia_rejeitada boolean := false;
BEGIN
  BEGIN
    INSERT INTO teste_tapetes_fase_4 (
      pedido_id, ordem, formato, dimensao_1_cm, dimensao_2_cm,
      area_cobrada_centesimos_m2, produto_id, nome_colecao_catalogo,
      created_by, updated_by
    ) VALUES (
      gen_random_uuid(), 2, 'RETANGULAR', 100, 100,
      100, gen_random_uuid(), repeat('A', 31),
      gen_random_uuid(), gen_random_uuid()
    );
  EXCEPTION WHEN check_violation THEN
    colecao_rejeitada := true;
  END;

  BEGIN
    INSERT INTO teste_tapetes_fase_4 (
      pedido_id, ordem, formato, dimensao_1_cm, dimensao_2_cm,
      area_cobrada_centesimos_m2, produto_id, referencia_catalogo,
      created_by, updated_by
    ) VALUES (
      gen_random_uuid(), 3, 'RETANGULAR', 100, 100,
      100, gen_random_uuid(), repeat('R', 21),
      gen_random_uuid(), gen_random_uuid()
    );
  EXCEPTION WHEN check_violation THEN
    referencia_rejeitada := true;
  END;

  IF NOT colecao_rejeitada THEN
    RAISE EXCEPTION 'A constraint aceitou coleção com 31 caracteres.';
  END IF;
  IF NOT referencia_rejeitada THEN
    RAISE EXCEPTION 'A constraint aceitou referência com 21 caracteres.';
  END IF;
END;
$$;

ROLLBACK;
