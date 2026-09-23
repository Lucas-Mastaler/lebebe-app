-- Regressão da separação dados-comerciais x produtos e da correção do bug de
-- cores confirmado na auditoria: editar um tapete Moriah mantido (com `id`)
-- nunca apagava as cores antigas antes de inserir o novo conjunto, violando
-- pedidos_personalizados_tapete_cores_pkey/..._tapete_ordem_unique sempre que
-- alguma cor permanecia, ou deixando cores órfãs quando todas eram removidas.
-- Usa somente dados sintéticos e catálogo real (leitura), sempre desfaz tudo.
BEGIN;

DO $tests$
DECLARE
  v_usuario constant uuid := '11000000-0000-4000-8000-000000000001';
  v_moriah uuid;
  v_exclusive uuid;
  v_produto_moriah uuid;
  v_produto_exclusive uuid;
  v_bigorrilho uuid;
  v_cores uuid[];
  v_pedido uuid;
  v_pedido_exclusive uuid;
  v_tapete uuid;
  v_tapete_2 uuid;
  v_version integer;
  v_tapetes jsonb;
  v_result record;
BEGIN
  INSERT INTO public.usuarios_permitidos (id, email, role, ativo)
  VALUES (v_usuario, 'edicao.produtos.teste@example.invalid', 'user', true);

  SELECT id INTO v_moriah FROM public.pedidos_personalizados_fornecedores WHERE chave = 'moriah_tapetes';
  SELECT id INTO v_exclusive FROM public.pedidos_personalizados_fornecedores WHERE chave = 'lebebe_exclusive';
  SELECT id INTO v_produto_moriah FROM public.pedidos_personalizados_produtos WHERE fornecedor_id = v_moriah AND codigo = '21158';
  SELECT c.produto_id INTO v_produto_exclusive
    FROM public.pedidos_personalizados_lebebe_exclusive_catalogo c
    JOIN public.pedidos_personalizados_produtos p ON p.id = c.produto_id
    WHERE p.ativo = true
    ORDER BY c.linha_origem LIMIT 1;
  SELECT id INTO v_bigorrilho FROM public.app_unidades WHERE chave = 'bigorrilho';
  SELECT array_agg(id ORDER BY ordem) INTO v_cores FROM public.pedidos_personalizados_cores WHERE fornecedor_id = v_moriah;

  IF v_moriah IS NULL OR v_exclusive IS NULL OR v_produto_moriah IS NULL OR v_produto_exclusive IS NULL OR v_bigorrilho IS NULL THEN
    RAISE EXCEPTION 'FIXTURES_CATALOGO_NAO_ENCONTRADAS';
  END IF;

  -- Cria um pedido Moriah em RASCUNHO com 1 tapete PERSONALIZADO já com 3 cores.
  SELECT r.pedido_id, r.version, (r.tapetes->0->>'id')::uuid
    INTO v_pedido, v_version, v_tapete
  FROM public.criar_pedido_personalizado_moriah(
    v_usuario, gen_random_uuid(), v_moriah, v_bigorrilho,
    'CONSULTORA TESTE', 'CLIENTE TESTE',
    jsonb_build_array(jsonb_build_object(
      'ordem', 1, 'formato', 'RETANGULAR', 'tipo', 'PERSONALIZADO',
      'dimensao_1_cm', 100, 'dimensao_2_cm', 150,
      'area_cobrada_centesimos_m2', 150, 'produto_id', v_produto_moriah,
      'cores', jsonb_build_array(
        jsonb_build_object('cor_id', v_cores[1], 'ordem', 1),
        jsonb_build_object('cor_id', v_cores[2], 'ordem', 2),
        jsonb_build_object('cor_id', v_cores[3], 'ordem', 3)
      )
    ))
  ) r;

  -- 1) Editar o tapete mantendo exatamente as mesmas 3 cores não deve falhar
  --    (antes da correção, isso violava a PK de tapete_cores).
  SELECT * INTO v_result FROM public.atualizar_pedido_personalizado_produtos_moriah(
    v_pedido, v_version, v_usuario,
    jsonb_build_array(jsonb_build_object(
      'id', v_tapete, 'ordem', 1, 'formato', 'RETANGULAR', 'tipo', 'PERSONALIZADO',
      'dimensao_1_cm', 100, 'dimensao_2_cm', 150,
      'area_cobrada_centesimos_m2', 150, 'produto_id', v_produto_moriah,
      'cores', jsonb_build_array(
        jsonb_build_object('cor_id', v_cores[1], 'ordem', 1),
        jsonb_build_object('cor_id', v_cores[2], 'ordem', 2),
        jsonb_build_object('cor_id', v_cores[3], 'ordem', 3)
      )
    ))
  );
  v_version := v_result.version;
  IF (SELECT count(*) FROM public.pedidos_personalizados_tapete_cores WHERE tapete_id = v_tapete) <> 3 THEN
    RAISE EXCEPTION 'TESTE_MANTER_CORES_FALHOU';
  END IF;

  -- 2) Trocar uma cor (remove uma, adiciona outra) — sem linha antiga sobrando.
  SELECT * INTO v_result FROM public.atualizar_pedido_personalizado_produtos_moriah(
    v_pedido, v_version, v_usuario,
    jsonb_build_array(jsonb_build_object(
      'id', v_tapete, 'ordem', 1, 'formato', 'RETANGULAR', 'tipo', 'PERSONALIZADO',
      'dimensao_1_cm', 100, 'dimensao_2_cm', 150,
      'area_cobrada_centesimos_m2', 150, 'produto_id', v_produto_moriah,
      'cores', jsonb_build_array(
        jsonb_build_object('cor_id', v_cores[1], 'ordem', 1),
        jsonb_build_object('cor_id', v_cores[4], 'ordem', 2)
      )
    ))
  );
  v_version := v_result.version;
  IF (SELECT count(*) FROM public.pedidos_personalizados_tapete_cores WHERE tapete_id = v_tapete) <> 2
     OR EXISTS (SELECT 1 FROM public.pedidos_personalizados_tapete_cores WHERE tapete_id = v_tapete AND cor_id = v_cores[3])
     OR NOT EXISTS (SELECT 1 FROM public.pedidos_personalizados_tapete_cores WHERE tapete_id = v_tapete AND cor_id = v_cores[4]) THEN
    RAISE EXCEPTION 'TESTE_TROCAR_COR_FALHOU';
  END IF;

  -- 3) Remover uma cor (fica só 1) — sem linha antiga sobrando.
  SELECT * INTO v_result FROM public.atualizar_pedido_personalizado_produtos_moriah(
    v_pedido, v_version, v_usuario,
    jsonb_build_array(jsonb_build_object(
      'id', v_tapete, 'ordem', 1, 'formato', 'RETANGULAR', 'tipo', 'PERSONALIZADO',
      'dimensao_1_cm', 100, 'dimensao_2_cm', 150,
      'area_cobrada_centesimos_m2', 150, 'produto_id', v_produto_moriah,
      'cores', jsonb_build_array(jsonb_build_object('cor_id', v_cores[1], 'ordem', 1))
    ))
  );
  v_version := v_result.version;
  IF (SELECT count(*) FROM public.pedidos_personalizados_tapete_cores WHERE tapete_id = v_tapete) <> 1 THEN
    RAISE EXCEPTION 'TESTE_REMOVER_UMA_COR_FALHOU';
  END IF;

  -- 4) Remover todas as cores — antes da correção, ficavam órfãs silenciosamente.
  SELECT * INTO v_result FROM public.atualizar_pedido_personalizado_produtos_moriah(
    v_pedido, v_version, v_usuario,
    jsonb_build_array(jsonb_build_object(
      'id', v_tapete, 'ordem', 1, 'formato', 'RETANGULAR', 'tipo', 'PERSONALIZADO',
      'dimensao_1_cm', 100, 'dimensao_2_cm', 150,
      'area_cobrada_centesimos_m2', 150, 'produto_id', v_produto_moriah,
      'cores', '[]'::jsonb
    ))
  );
  v_version := v_result.version;
  IF (SELECT count(*) FROM public.pedidos_personalizados_tapete_cores WHERE tapete_id = v_tapete) <> 0 THEN
    RAISE EXCEPTION 'TESTE_REMOVER_TODAS_CORES_FALHOU';
  END IF;

  -- 5) Adicionar cores de volta, até o limite de 6 — aceito.
  SELECT * INTO v_result FROM public.atualizar_pedido_personalizado_produtos_moriah(
    v_pedido, v_version, v_usuario,
    jsonb_build_array(jsonb_build_object(
      'id', v_tapete, 'ordem', 1, 'formato', 'RETANGULAR', 'tipo', 'PERSONALIZADO',
      'dimensao_1_cm', 100, 'dimensao_2_cm', 150,
      'area_cobrada_centesimos_m2', 150, 'produto_id', v_produto_moriah,
      'cores', (SELECT jsonb_agg(jsonb_build_object('cor_id', v_cores[n], 'ordem', n)) FROM generate_series(1, 6) AS n)
    ))
  );
  v_version := v_result.version;
  IF (SELECT count(*) FROM public.pedidos_personalizados_tapete_cores WHERE tapete_id = v_tapete) <> 6 THEN
    RAISE EXCEPTION 'TESTE_SEIS_CORES_FALHOU';
  END IF;

  -- 6) Sétima cor é rejeitada com o código de domínio (limite corrigido de 8 para 6).
  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_produtos_moriah(
      v_pedido, v_version, v_usuario,
      jsonb_build_array(jsonb_build_object(
        'id', v_tapete, 'ordem', 1, 'formato', 'RETANGULAR', 'tipo', 'PERSONALIZADO',
        'dimensao_1_cm', 100, 'dimensao_2_cm', 150,
        'area_cobrada_centesimos_m2', 150, 'produto_id', v_produto_moriah,
        'cores', (SELECT jsonb_agg(jsonb_build_object('cor_id', v_cores[n], 'ordem', n)) FROM generate_series(1, 7) AS n)
      ))
    );
    RAISE EXCEPTION 'TESTE_SETIMA_COR_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LIMITE_CORES' THEN RAISE; END IF;
  END;

  -- 7) Adicionar um segundo tapete (novo, sem `id`) preservando o primeiro.
  SELECT * INTO v_result FROM public.atualizar_pedido_personalizado_produtos_moriah(
    v_pedido, v_version, v_usuario,
    jsonb_build_array(
      jsonb_build_object(
        'id', v_tapete, 'ordem', 1, 'formato', 'RETANGULAR', 'tipo', 'PERSONALIZADO',
        'dimensao_1_cm', 100, 'dimensao_2_cm', 150,
        'area_cobrada_centesimos_m2', 150, 'produto_id', v_produto_moriah,
        'cores', jsonb_build_array(jsonb_build_object('cor_id', v_cores[1], 'ordem', 1))
      ),
      jsonb_build_object(
        'ordem', 2, 'formato', 'REDONDO', 'tipo', 'CATALOGO',
        'dimensao_1_cm', 100, 'area_cobrada_centesimos_m2', 100,
        'produto_id', v_produto_moriah, 'nome_colecao_catalogo', 'Coleção X',
        'referencia_catalogo', 'REF-1', 'cores', '[]'::jsonb
      )
    )
  );
  v_version := v_result.version;
  SELECT (item->>'id')::uuid INTO v_tapete_2 FROM jsonb_array_elements(v_result.tapetes) AS item WHERE (item->>'id')::uuid <> v_tapete;
  IF (SELECT count(*) FROM public.pedidos_personalizados_moriah_tapetes WHERE pedido_id = v_pedido) <> 2 THEN
    RAISE EXCEPTION 'TESTE_ADICIONAR_TAPETE_FALHOU';
  END IF;

  -- 8) Fora de RASCUNHO, produtos ficam bloqueados — verificado no próprio banco,
  --    não só na UI/API (defesa em profundidade).
  UPDATE public.pedidos_personalizados_pedidos SET status = 'VENDA FECHADA' WHERE id = v_pedido;
  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_produtos_moriah(
      v_pedido, v_version, v_usuario,
      jsonb_build_array(jsonb_build_object(
        'id', v_tapete, 'ordem', 1, 'formato', 'RETANGULAR', 'tipo', 'PERSONALIZADO',
        'dimensao_1_cm', 100, 'dimensao_2_cm', 150,
        'area_cobrada_centesimos_m2', 150, 'produto_id', v_produto_moriah,
        'cores', '[]'::jsonb
      ))
    );
    RAISE EXCEPTION 'TESTE_BLOQUEIO_PRODUTOS_FALHOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'EDICAO_PRODUTOS_BLOQUEADA' THEN RAISE; END IF;
  END;
  -- Dados comerciais continuam editáveis nesse status (regra pré-existente, inalterada).
  SELECT * INTO v_result FROM public.atualizar_pedido_personalizado_comercial_moriah(
    v_pedido, v_version, v_usuario, v_bigorrilho, 'CONSULTORA NOVA', 'CLIENTE NOVO', NULL, NULL
  );
  IF v_result.version <> v_version + 1 THEN RAISE EXCEPTION 'TESTE_COMERCIAL_AINDA_PERMITIDO_FALHOU'; END IF;

  -- ===================================================================
  -- Lebebe Exclusive: produtos também só em RASCUNHO (antes, comercial
  -- permitia editar itens também em VENDA FECHADA — decisão desta tarefa
  -- restringe a RASCUNHO nos dois fornecedores).
  -- ===================================================================
  SELECT r.pedido_id, r.version INTO v_pedido_exclusive, v_version
  FROM public.criar_pedido_personalizado_lebebe_exclusive(
    v_usuario, gen_random_uuid(), v_exclusive, v_bigorrilho,
    'CONSULTORA TESTE', 'CLIENTE TESTE', '41999999999', NULL,
    jsonb_build_array(jsonb_build_object('produto_id', v_produto_exclusive, 'ordem', 1, 'quantidade', 1, 'nome_ou_letra', null))
  ) r;

  SELECT * INTO v_result FROM public.atualizar_pedido_personalizado_produtos_lebebe_exclusive(
    v_pedido_exclusive, v_version, v_usuario,
    jsonb_build_array(jsonb_build_object('produto_id', v_produto_exclusive, 'ordem', 1, 'quantidade', 3, 'nome_ou_letra', 'JOAO'))
  );
  v_version := v_result.version;
  IF (SELECT quantidade FROM public.pedidos_personalizados_lebebe_exclusive_itens WHERE pedido_id = v_pedido_exclusive) <> 3
     OR (SELECT nome_ou_letra FROM public.pedidos_personalizados_lebebe_exclusive_itens WHERE pedido_id = v_pedido_exclusive) <> 'JOAO' THEN
    RAISE EXCEPTION 'TESTE_EXCLUSIVE_ALTERAR_ITEM_FALHOU';
  END IF;

  UPDATE public.pedidos_personalizados_pedidos SET status = 'VENDA FECHADA' WHERE id = v_pedido_exclusive;
  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_produtos_lebebe_exclusive(
      v_pedido_exclusive, v_version, v_usuario,
      jsonb_build_array(jsonb_build_object('produto_id', v_produto_exclusive, 'ordem', 1, 'quantidade', 1, 'nome_ou_letra', null))
    );
    RAISE EXCEPTION 'TESTE_EXCLUSIVE_BLOQUEIO_PRODUTOS_FALHOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'EDICAO_PRODUTOS_BLOQUEADA' THEN RAISE; END IF;
  END;
END;
$tests$;

ROLLBACK;

SELECT 'pedidos_personalizados_edicao_produtos_rascunho_ok' AS resultado;
