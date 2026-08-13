-- Testes transacionais da Fase 1B. Usa somente dados sinteticos e sempre desfaz tudo.
BEGIN;

DO $tests$
DECLARE
  v_usuario_1 constant uuid := '10000000-0000-4000-8000-000000000001';
  v_usuario_2 constant uuid := '10000000-0000-4000-8000-000000000002';
  v_moriah uuid;
  v_decorisi uuid;
  v_produto_moriah uuid;
  v_produto_decorisi uuid := '20000000-0000-4000-8000-000000000001';
  v_cor_decorisi uuid := '30000000-0000-4000-8000-000000000001';
  v_cores uuid[];
  v_bigorrilho uuid;
  v_portao uuid;
  v_marechal uuid;
  v_feira uuid;
  v_pos_venda uuid;
  v_pedido uuid;
  v_pedido_idempotente uuid;
  v_pedido_outro uuid;
  v_tapete uuid;
  v_tapete_outro uuid;
  v_tapete_novo uuid;
  v_anexo_1 uuid := '40000000-0000-4000-8000-000000000001';
  v_anexo_2 uuid := '40000000-0000-4000-8000-000000000002';
  v_anexo_3 uuid := '40000000-0000-4000-8000-000000000003';
  v_version integer;
  v_version_anterior integer;
  v_tapetes jsonb;
  v_payload_base jsonb;
  v_payload_comercial jsonb;
  v_payload_cores jsonb;
  v_caminho_1 text;
  v_caminho_1_novo text;
  v_caminho_2 text;
  v_caminho_3 text;
  v_antes integer;
BEGIN
  INSERT INTO public.usuarios_permitidos (id, email, role, ativo)
  VALUES
    (v_usuario_1, 'fase1b.usuario1@example.invalid', 'user', true),
    (v_usuario_2, 'fase1b.usuario2@example.invalid', 'user', true);

  SELECT id INTO v_moriah
  FROM public.pedidos_personalizados_fornecedores
  WHERE chave = 'moriah_tapetes';

  SELECT id INTO v_decorisi
  FROM public.pedidos_personalizados_fornecedores
  WHERE chave = 'decorisi';

  SELECT id INTO v_produto_moriah
  FROM public.pedidos_personalizados_produtos
  WHERE fornecedor_id = v_moriah AND codigo = '21157';

  SELECT array_agg(id ORDER BY ordem) INTO v_cores
  FROM public.pedidos_personalizados_cores
  WHERE fornecedor_id = v_moriah;

  SELECT id INTO v_bigorrilho FROM public.app_unidades WHERE chave = 'bigorrilho';
  SELECT id INTO v_portao FROM public.app_unidades WHERE chave = 'portao';
  SELECT id INTO v_marechal FROM public.app_unidades WHERE chave = 'marechal';
  SELECT id INTO v_feira FROM public.app_unidades WHERE chave = 'feira';
  SELECT id INTO v_pos_venda FROM public.app_unidades WHERE chave = 'pos_venda';

  INSERT INTO public.pedidos_personalizados_produtos (
    id, fornecedor_id, codigo, descricao, ativo, ordem
  ) VALUES (
    v_produto_decorisi, v_decorisi, 'TESTE-F1B', 'PRODUTO SINTETICO FASE 1B', true, 1
  );

  INSERT INTO public.pedidos_personalizados_cores (
    id, fornecedor_id, numero, codigo, nome, ativo, ordem
  ) VALUES (
    v_cor_decorisi, v_decorisi, '99', 'TESTE-99', 'Cor Sintetica', true, 1
  );

  v_payload_base := jsonb_build_array(jsonb_build_object(
    'ordem', 1,
    'formato', 'REDONDO',
    'dimensao_1_cm', 100,
    'area_cobrada_centesimos_m2', 100,
    'produto_id', v_produto_moriah,
    'cores', '[]'::jsonb
  ));

  -- Um tapete, zero cores e unidade Bigorrilho.
  SELECT pedido_id, version, tapetes
    INTO v_pedido, v_version, v_tapetes
  FROM public.criar_pedido_personalizado_moriah(
    v_usuario_1,
    '50000000-0000-4000-8000-000000000001',
    v_moriah,
    v_bigorrilho,
    'CONSULTORA TESTE',
    'CLIENTE SINTETICO',
    v_payload_base
  );

  v_tapete := (v_tapetes->0->>'id')::uuid;
  IF v_version <> 1
     OR (SELECT count(*) FROM public.pedidos_personalizados_moriah_tapetes WHERE pedido_id = v_pedido) <> 1
     OR (SELECT count(*) FROM public.pedidos_personalizados_tapete_cores WHERE tapete_id = v_tapete) <> 0 THEN
    RAISE EXCEPTION 'TESTE_CRIACAO_UM_TAPETE_ZERO_CORES_FALHOU';
  END IF;

  -- Idempotencia: mesma chave/usuario devolve o mesmo pedido sem duplicar filhos.
  SELECT pedido_id INTO v_pedido_idempotente
  FROM public.criar_pedido_personalizado_moriah(
    v_usuario_1,
    '50000000-0000-4000-8000-000000000001',
    v_moriah,
    v_bigorrilho,
    'IGNORADO NA REPETICAO',
    'IGNORADO NA REPETICAO',
    v_payload_base
  );

  IF v_pedido_idempotente <> v_pedido
     OR (SELECT count(*) FROM public.pedidos_personalizados_pedidos WHERE created_by = v_usuario_1 AND idempotency_key = '50000000-0000-4000-8000-000000000001') <> 1
     OR (SELECT count(*) FROM public.pedidos_personalizados_moriah_tapetes WHERE pedido_id = v_pedido) <> 1 THEN
    RAISE EXCEPTION 'TESTE_IDEMPOTENCIA_FALHOU';
  END IF;

  -- Mesma chave com outro usuario nao colide e valida Portao.
  SELECT pedido_id, tapetes INTO v_pedido_outro, v_tapetes
  FROM public.criar_pedido_personalizado_moriah(
    v_usuario_2,
    '50000000-0000-4000-8000-000000000001',
    v_moriah,
    v_portao,
    'CONSULTORA TESTE',
    'CLIENTE SINTETICO',
    v_payload_base
  );
  v_tapete_outro := (v_tapetes->0->>'id')::uuid;
  IF v_pedido_outro = v_pedido THEN
    RAISE EXCEPTION 'TESTE_IDEMPOTENCIA_USUARIOS_FALHOU';
  END IF;

  -- Marechal e Feira.
  PERFORM * FROM public.criar_pedido_personalizado_moriah(
    v_usuario_1, '50000000-0000-4000-8000-000000000002', v_moriah,
    v_marechal, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_base
  );
  PERFORM * FROM public.criar_pedido_personalizado_moriah(
    v_usuario_1, '50000000-0000-4000-8000-000000000003', v_moriah,
    v_feira, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_base
  );

  -- Dez tapetes.
  SELECT jsonb_agg(jsonb_build_object(
    'ordem', numero,
    'formato', 'REDONDO',
    'dimensao_1_cm', 100,
    'area_cobrada_centesimos_m2', 100,
    'produto_id', v_produto_moriah,
    'cores', '[]'::jsonb
  ) ORDER BY numero) INTO v_payload_comercial
  FROM generate_series(1, 10) AS numero;

  PERFORM * FROM public.criar_pedido_personalizado_moriah(
    v_usuario_1, '50000000-0000-4000-8000-000000000004', v_moriah,
    v_bigorrilho, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_comercial
  );

  -- Onze tapetes sao rejeitados e nao deixam pedido parcial.
  SELECT count(*) INTO v_antes FROM public.pedidos_personalizados_pedidos;
  SELECT jsonb_agg(jsonb_build_object(
    'ordem', numero, 'formato', 'REDONDO', 'dimensao_1_cm', 100,
    'area_cobrada_centesimos_m2', 100, 'produto_id', v_produto_moriah,
    'cores', '[]'::jsonb
  ) ORDER BY numero) INTO v_payload_comercial
  FROM generate_series(1, 11) AS numero;
  BEGIN
    PERFORM * FROM public.criar_pedido_personalizado_moriah(
      v_usuario_1, '50000000-0000-4000-8000-000000000005', v_moriah,
      v_bigorrilho, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_comercial
    );
    RAISE EXCEPTION 'TESTE_LIMITE_11_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LIMITE_TAPETES' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.pedidos_personalizados_pedidos) <> v_antes THEN
    RAISE EXCEPTION 'TESTE_ROLLBACK_TAPETE_FALHOU';
  END IF;

  -- Oito cores aceitas.
  SELECT jsonb_agg(jsonb_build_object('cor_id', v_cores[numero], 'ordem', numero) ORDER BY numero)
    INTO v_payload_cores
  FROM generate_series(1, 8) AS numero;
  v_payload_comercial := jsonb_build_array(jsonb_build_object(
    'ordem', 1, 'formato', 'REDONDO', 'dimensao_1_cm', 100,
    'area_cobrada_centesimos_m2', 100, 'produto_id', v_produto_moriah,
    'cores', v_payload_cores
  ));
  SELECT pedido_id, tapetes INTO v_pedido_idempotente, v_tapetes
  FROM public.criar_pedido_personalizado_moriah(
    v_usuario_1, '50000000-0000-4000-8000-000000000006', v_moriah,
    v_bigorrilho, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_comercial
  );
  IF (SELECT count(*) FROM public.pedidos_personalizados_tapete_cores WHERE tapete_id = (v_tapetes->0->>'id')::uuid) <> 8 THEN
    RAISE EXCEPTION 'TESTE_OITO_CORES_FALHOU';
  END IF;

  -- Nona cor rejeitada.
  SELECT jsonb_agg(jsonb_build_object('cor_id', v_cores[numero], 'ordem', numero) ORDER BY numero)
    INTO v_payload_cores
  FROM generate_series(1, 9) AS numero;
  v_payload_comercial := jsonb_build_array(jsonb_build_object(
    'ordem', 1, 'formato', 'REDONDO', 'dimensao_1_cm', 100,
    'area_cobrada_centesimos_m2', 100, 'produto_id', v_produto_moriah,
    'cores', v_payload_cores
  ));
  BEGIN
    PERFORM * FROM public.criar_pedido_personalizado_moriah(
      v_usuario_1, '50000000-0000-4000-8000-000000000007', v_moriah,
      v_bigorrilho, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_comercial
    );
    RAISE EXCEPTION 'TESTE_NONA_COR_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LIMITE_CORES' THEN RAISE; END IF;
  END;

  -- Cor e ordem de cor duplicadas.
  v_payload_cores := jsonb_build_array(
    jsonb_build_object('cor_id', v_cores[1], 'ordem', 1),
    jsonb_build_object('cor_id', v_cores[1], 'ordem', 2)
  );
  v_payload_comercial := jsonb_build_array((v_payload_base->0) || jsonb_build_object('cores', v_payload_cores));
  BEGIN
    PERFORM * FROM public.criar_pedido_personalizado_moriah(
      v_usuario_1, '50000000-0000-4000-8000-000000000008', v_moriah,
      v_bigorrilho, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_comercial
    );
    RAISE EXCEPTION 'TESTE_COR_DUPLICADA_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'COR_DUPLICADA' THEN RAISE; END IF;
  END;

  v_payload_cores := jsonb_build_array(
    jsonb_build_object('cor_id', v_cores[1], 'ordem', 1),
    jsonb_build_object('cor_id', v_cores[2], 'ordem', 1)
  );
  v_payload_comercial := jsonb_build_array((v_payload_base->0) || jsonb_build_object('cores', v_payload_cores));
  BEGIN
    PERFORM * FROM public.criar_pedido_personalizado_moriah(
      v_usuario_1, '50000000-0000-4000-8000-000000000009', v_moriah,
      v_bigorrilho, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_comercial
    );
    RAISE EXCEPTION 'TESTE_ORDEM_COR_DUPLICADA_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ORDEM_COR_DUPLICADA' THEN RAISE; END IF;
  END;

  -- Ordem de tapete duplicada.
  v_payload_comercial := v_payload_base || v_payload_base;
  BEGIN
    PERFORM * FROM public.criar_pedido_personalizado_moriah(
      v_usuario_1, '50000000-0000-4000-8000-000000000010', v_moriah,
      v_bigorrilho, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_comercial
    );
    RAISE EXCEPTION 'TESTE_ORDEM_TAPETE_DUPLICADA_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ORDEM_TAPETE_DUPLICADA' THEN RAISE; END IF;
  END;

  -- Pos-venda, produto e cor de outro fornecedor sao rejeitados.
  BEGIN
    PERFORM * FROM public.criar_pedido_personalizado_moriah(
      v_usuario_1, '50000000-0000-4000-8000-000000000011', v_moriah,
      v_pos_venda, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_base
    );
    RAISE EXCEPTION 'TESTE_POS_VENDA_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNIDADE_NAO_PERMITIDA' THEN RAISE; END IF;
  END;

  v_payload_comercial := jsonb_build_array((v_payload_base->0) || jsonb_build_object('produto_id', v_produto_decorisi));
  BEGIN
    PERFORM * FROM public.criar_pedido_personalizado_moriah(
      v_usuario_1, '50000000-0000-4000-8000-000000000012', v_moriah,
      v_bigorrilho, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_comercial
    );
    RAISE EXCEPTION 'TESTE_PRODUTO_FORNECEDOR_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PRODUTO_FORNECEDOR_INVALIDO' THEN RAISE; END IF;
  END;

  v_payload_comercial := jsonb_build_array((v_payload_base->0) || jsonb_build_object(
    'cores', jsonb_build_array(jsonb_build_object('cor_id', v_cor_decorisi, 'ordem', 1))
  ));
  BEGIN
    PERFORM * FROM public.criar_pedido_personalizado_moriah(
      v_usuario_1, '50000000-0000-4000-8000-000000000013', v_moriah,
      v_bigorrilho, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_comercial
    );
    RAISE EXCEPTION 'TESTE_COR_FORNECEDOR_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'COR_FORNECEDOR_INVALIDA' THEN RAISE; END IF;
  END;

  -- Concorrencia e edicao comercial permitida nos tres status iniciais.
  v_payload_comercial := jsonb_build_array((v_payload_base->0) || jsonb_build_object('id', v_tapete));
  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_comercial_moriah(
    v_pedido, 1, v_usuario_1, v_bigorrilho,
    'CONSULTORA NOVA', 'CLIENTE NOVO', v_payload_comercial
  );
  IF v_version <> 2 THEN RAISE EXCEPTION 'TESTE_VERSION_INCREMENTO_FALHOU'; END IF;

  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_comercial_moriah(
      v_pedido, 1, v_usuario_1, v_bigorrilho,
      'NAO DEVE GRAVAR', 'NAO DEVE GRAVAR', v_payload_comercial
    );
    RAISE EXCEPTION 'TESTE_CONFLITO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CONFLITO_VERSAO' THEN RAISE; END IF;
  END;
  IF (SELECT cliente FROM public.pedidos_personalizados_pedidos WHERE id = v_pedido) <> 'CLIENTE NOVO' THEN
    RAISE EXCEPTION 'TESTE_CONFLITO_ALTEROU_DADOS';
  END IF;

  FOREACH v_payload_cores IN ARRAY ARRAY[
    to_jsonb('AGUARDANDO LAYOUT'::text),
    to_jsonb(U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE'::text)
  ] LOOP
    SELECT version INTO v_version
    FROM public.atualizar_pedido_personalizado_administrativo(
      v_pedido, v_version, v_usuario_1, NULL, NULL, NULL, NULL, NULL,
      v_payload_cores #>> '{}', '[]'::jsonb
    );
    SELECT version INTO v_version
    FROM public.atualizar_pedido_personalizado_comercial_moriah(
      v_pedido, v_version, v_usuario_1, v_bigorrilho,
      'CONSULTORA NOVA', 'CLIENTE NOVO', v_payload_comercial
    );
  END LOOP;

  -- Producao bloqueia comercial, mas permite administrativo e layout.
  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_administrativo(
    v_pedido, v_version, v_usuario_1, '0001', NULL, NULL, NULL, NULL,
    U&'EM PRODU\00C7\00C3O', '[]'::jsonb
  );
  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_comercial_moriah(
      v_pedido, v_version, v_usuario_1, v_bigorrilho,
      'BLOQUEADA', 'BLOQUEADO', v_payload_comercial
    );
    RAISE EXCEPTION 'TESTE_BLOQUEIO_PRODUCAO_FALHOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'EDICAO_COMERCIAL_BLOQUEADA' THEN RAISE; END IF;
  END;

  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_administrativo(
    v_pedido, v_version, v_usuario_1, '0002', NULL, NULL, NULL, NULL,
    U&'EM PRODU\00C7\00C3O', jsonb_build_array(jsonb_build_object(
      'tapete_id', v_tapete,
      'teve_alteracao_layout', true,
      'quantidade_alteracoes_layout', 1
    ))
  );
  IF NOT (SELECT teve_alteracao_layout FROM public.pedidos_personalizados_moriah_tapetes WHERE id = v_tapete) THEN
    RAISE EXCEPTION 'TESTE_LAYOUT_PRODUCAO_FALHOU';
  END IF;

  -- Recebido permite administrativo/layout e bloqueia comercial.
  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_administrativo(
    v_pedido, v_version, v_usuario_1, '0003', NULL, NULL, NULL, NULL,
    'RECEBIDO', jsonb_build_array(jsonb_build_object(
      'tapete_id', v_tapete,
      'teve_alteracao_layout', false
    ))
  );
  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_comercial_moriah(
      v_pedido, v_version, v_usuario_1, v_bigorrilho,
      'BLOQUEADA', 'BLOQUEADO', v_payload_comercial
    );
    RAISE EXCEPTION 'TESTE_BLOQUEIO_RECEBIDO_FALHOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'EDICAO_COMERCIAL_BLOQUEADA' THEN RAISE; END IF;
  END;

  -- Anexos continuam editaveis em RECEBIDO.
  v_caminho_1 := v_pedido::text || '/' || v_tapete::text || '/' || v_anexo_1::text || '/60000000-0000-4000-8000-000000000001.jpg';
  SELECT version INTO v_version
  FROM public.registrar_anexo_pedido_personalizado(
    v_pedido, v_tapete, v_version, 1, v_caminho_1,
    'sintetico.jpg', 'image/jpeg', 10485760, v_usuario_1
  );

  -- Slot duplicado com apenas um anexo.
  v_caminho_3 := v_pedido::text || '/' || v_tapete::text || '/' || v_anexo_3::text || '/60000000-0000-4000-8000-000000000003.png';
  BEGIN
    PERFORM * FROM public.registrar_anexo_pedido_personalizado(
      v_pedido, v_tapete, v_version, 1, v_caminho_3,
      'duplicado.png', 'image/png', 1, v_usuario_1
    );
    RAISE EXCEPTION 'TESTE_SLOT_DUPLICADO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'SLOT_ANEXO_OCUPADO' THEN RAISE; END IF;
  END;

  v_caminho_2 := v_pedido::text || '/' || v_tapete::text || '/' || v_anexo_2::text || '/60000000-0000-4000-8000-000000000002.pdf';
  SELECT version INTO v_version
  FROM public.registrar_anexo_pedido_personalizado(
    v_pedido, v_tapete, v_version, 2, v_caminho_2,
    'sintetico.pdf', 'application/pdf', 1, v_usuario_1
  );

  -- Terceiro anexo, MIME e tamanho invalidos.
  BEGIN
    PERFORM * FROM public.registrar_anexo_pedido_personalizado(
      v_pedido, v_tapete, v_version, 1, v_caminho_3,
      'terceiro.png', 'image/png', 1, v_usuario_1
    );
    RAISE EXCEPTION 'TESTE_TERCEIRO_ANEXO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LIMITE_ANEXOS' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.registrar_anexo_pedido_personalizado(
      v_pedido, v_tapete, v_version, 1, v_caminho_3,
      'tipo.exe', 'application/octet-stream', 1, v_usuario_1
    );
    RAISE EXCEPTION 'TESTE_MIME_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TIPO_ARQUIVO_INVALIDO' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.registrar_anexo_pedido_personalizado(
      v_pedido, v_tapete, v_version, 1, v_caminho_3,
      'grande.png', 'image/png', 10485761, v_usuario_1
    );
    RAISE EXCEPTION 'TESTE_TAMANHO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TAMANHO_ARQUIVO_INVALIDO' THEN RAISE; END IF;
  END;

  -- Tapete de outro pedido e expected_version antigo.
  BEGIN
    PERFORM * FROM public.registrar_anexo_pedido_personalizado(
      v_pedido, v_tapete_outro, v_version, 1, v_caminho_3,
      'outro.png', 'image/png', 1, v_usuario_1
    );
    RAISE EXCEPTION 'TESTE_TAPETE_OUTRO_PEDIDO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TAPETE_NAO_PERTENCE_AO_PEDIDO' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.remover_anexo_pedido_personalizado(
      v_pedido, v_anexo_2, v_version - 1, v_usuario_1
    );
    RAISE EXCEPTION 'TESTE_ANEXO_CONFLITO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CONFLITO_VERSAO' THEN RAISE; END IF;
  END;

  -- Substituicao enfileira o antigo e mantem metadado em falha de versao.
  v_caminho_1_novo := v_pedido::text || '/' || v_tapete::text || '/' || v_anexo_1::text || '/60000000-0000-4000-8000-000000000011.webp';
  v_version_anterior := v_version;
  SELECT version INTO v_version
  FROM public.substituir_anexo_pedido_personalizado(
    v_pedido, v_anexo_1, v_version, v_caminho_1_novo,
    'substituto.webp', 'image/webp', 100, v_usuario_1
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.pedidos_personalizados_storage_pendencias
    WHERE caminho_objeto = v_caminho_1 AND motivo = 'SUBSTITUICAO' AND processado_em IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.pedidos_personalizados_anexos
    WHERE id = v_anexo_1 AND caminho_objeto = v_caminho_1_novo
  ) THEN
    RAISE EXCEPTION 'TESTE_SUBSTITUICAO_FILA_FALHOU';
  END IF;
  BEGIN
    PERFORM * FROM public.substituir_anexo_pedido_personalizado(
      v_pedido, v_anexo_1, v_version_anterior, v_caminho_1,
      'nao-gravar.jpg', 'image/jpeg', 1, v_usuario_1
    );
    RAISE EXCEPTION 'TESTE_SUBSTITUICAO_CONFLITO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CONFLITO_VERSAO' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.pedidos_personalizados_anexos WHERE id = v_anexo_1 AND caminho_objeto = v_caminho_1_novo) THEN
    RAISE EXCEPTION 'TESTE_SUBSTITUICAO_CONFLITO_REMOVEU_METADADO';
  END IF;

  -- Remocao enfileira e remove metadado.
  SELECT version INTO v_version
  FROM public.remover_anexo_pedido_personalizado(
    v_pedido, v_anexo_2, v_version, v_usuario_1
  );
  IF EXISTS (SELECT 1 FROM public.pedidos_personalizados_anexos WHERE id = v_anexo_2)
     OR NOT EXISTS (
       SELECT 1 FROM public.pedidos_personalizados_storage_pendencias
       WHERE caminho_objeto = v_caminho_2 AND motivo = 'REMOCAO_ANEXO' AND processado_em IS NULL
     ) THEN
    RAISE EXCEPTION 'TESTE_REMOCAO_ANEXO_FALHOU';
  END IF;

  -- Volta a status comercial, inclui segundo tapete e remove o primeiro com anexo.
  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_administrativo(
    v_pedido, v_version, v_usuario_1, NULL, NULL, NULL, NULL, NULL,
    'RASCUNHO', '[]'::jsonb
  );
  v_payload_comercial := jsonb_build_array(
    (v_payload_base->0) || jsonb_build_object('id', v_tapete, 'ordem', 2),
    (v_payload_base->0) || jsonb_build_object('ordem', 1)
  );
  SELECT version, tapetes INTO v_version, v_tapetes
  FROM public.atualizar_pedido_personalizado_comercial_moriah(
    v_pedido, v_version, v_usuario_1, v_bigorrilho,
    'CONSULTORA NOVA', 'CLIENTE NOVO', v_payload_comercial
  );
  SELECT (item->>'id')::uuid INTO v_tapete_novo
  FROM jsonb_array_elements(v_tapetes) AS item
  WHERE (item->>'id')::uuid <> v_tapete;

  v_payload_comercial := jsonb_build_array((v_payload_base->0) || jsonb_build_object('id', v_tapete_novo, 'ordem', 1));
  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_comercial_moriah(
    v_pedido, v_version, v_usuario_1, v_bigorrilho,
    'CONSULTORA NOVA', 'CLIENTE NOVO', v_payload_comercial
  );
  IF EXISTS (SELECT 1 FROM public.pedidos_personalizados_moriah_tapetes WHERE id = v_tapete)
     OR EXISTS (SELECT 1 FROM public.pedidos_personalizados_anexos WHERE id = v_anexo_1)
     OR NOT EXISTS (
       SELECT 1 FROM public.pedidos_personalizados_storage_pendencias
       WHERE caminho_objeto = v_caminho_1_novo AND motivo = 'REMOCAO_TAPETE' AND processado_em IS NULL
     ) THEN
    RAISE EXCEPTION 'TESTE_REMOCAO_TAPETE_FILA_ATOMICA_FALHOU';
  END IF;
END;
$tests$;

ROLLBACK;

SELECT 'pedidos_personalizados_fase_1b_transacional_ok' AS resultado;
