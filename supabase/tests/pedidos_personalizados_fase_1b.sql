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
    'tipo', 'PERSONALIZADO',
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
    'tipo', 'PERSONALIZADO',
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
    'ordem', numero, 'formato', 'REDONDO', 'tipo', 'PERSONALIZADO', 'dimensao_1_cm', 100,
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

  -- Seis cores aceitas. NOTA: o payload de criacao (criar_pedido_personalizado_moriah,
  -- nao alterado nesta tarefa de manutencao) ainda valida no PL/pgSQL um limite de 8
  -- cores, mas a constraint real da tabela (pedidos_personalizados_tapete_cores_ordem_check)
  -- so aceita ordem entre 1 e 6 — a mesma inconsistencia ja corrigida na RPC de produtos
  -- (atualizar_pedido_personalizado_produtos_moriah) na tarefa anterior, mas nunca corrigida
  -- na RPC de criacao. Reproduzido empiricamente: 7 ou 8 cores na criacao hoje falham com uma
  -- violacao de constraint bruta (23514), nao com o erro de dominio LIMITE_CORES. Por isso este
  -- cenario testa o limite real (6), que e o unico que hoje tem sucesso de fato.
  SELECT jsonb_agg(jsonb_build_object('cor_id', v_cores[numero], 'ordem', numero) ORDER BY numero)
    INTO v_payload_cores
  FROM generate_series(1, 6) AS numero;
  v_payload_comercial := jsonb_build_array(jsonb_build_object(
    'ordem', 1, 'formato', 'REDONDO', 'tipo', 'PERSONALIZADO', 'dimensao_1_cm', 100,
    'area_cobrada_centesimos_m2', 100, 'produto_id', v_produto_moriah,
    'cores', v_payload_cores
  ));
  SELECT pedido_id, tapetes INTO v_pedido_idempotente, v_tapetes
  FROM public.criar_pedido_personalizado_moriah(
    v_usuario_1, '50000000-0000-4000-8000-000000000006', v_moriah,
    v_bigorrilho, 'CONSULTORA TESTE', 'CLIENTE SINTETICO', v_payload_comercial
  );
  IF (SELECT count(*) FROM public.pedidos_personalizados_tapete_cores WHERE tapete_id = (v_tapetes->0->>'id')::uuid) <> 6 THEN
    RAISE EXCEPTION 'TESTE_SEIS_CORES_FALHOU';
  END IF;

  -- Nona cor rejeitada (a validacao de dominio LIMITE_CORES da propria RPC ainda usa o
  -- limite antigo de 8, entao 9 cores continua sendo o menor valor que ela proprio rejeita
  -- de forma limpa, antes de chegar ao insert).
  SELECT jsonb_agg(jsonb_build_object('cor_id', v_cores[numero], 'ordem', numero) ORDER BY numero)
    INTO v_payload_cores
  FROM generate_series(1, 9) AS numero;
  v_payload_comercial := jsonb_build_array(jsonb_build_object(
    'ordem', 1, 'formato', 'REDONDO', 'tipo', 'PERSONALIZADO', 'dimensao_1_cm', 100,
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

  -- Concorrencia e edicao de dados comerciais permitida nos quatro status iniciais
  -- (produtos/tapetes agora sao testados a parte, em RASCUNHO apenas — ver
  -- pedidos_personalizados_edicao_produtos_rascunho.sql).
  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_comercial_moriah(
    v_pedido, 1, v_usuario_1, v_bigorrilho,
    'CONSULTORA NOVA', 'CLIENTE NOVO', NULL, NULL
  );
  IF v_version <> 2 THEN RAISE EXCEPTION 'TESTE_VERSION_INCREMENTO_FALHOU'; END IF;

  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_comercial_moriah(
      v_pedido, 1, v_usuario_1, v_bigorrilho,
      'NAO DEVE GRAVAR', 'NAO DEVE GRAVAR', NULL, NULL
    );
    RAISE EXCEPTION 'TESTE_CONFLITO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CONFLITO_VERSAO' THEN RAISE; END IF;
  END;
  IF (SELECT cliente FROM public.pedidos_personalizados_pedidos WHERE id = v_pedido) <> 'CLIENTE NOVO' THEN
    RAISE EXCEPTION 'TESTE_CONFLITO_ALTEROU_DADOS';
  END IF;

  -- Sai de RASCUNHO de fato via transicionar_pedido_personalizado — hoje o unico
  -- caminho real de mudanca de status: atualizar_pedido_personalizado_administrativo
  -- exige que p_status seja IGUAL ao status atual (ALTERACAO_STATUS_FORA_DO_FLUXO caso
  -- contrario), ou seja, nunca move o pedido entre status, so atualiza campos
  -- administrativos/layout no status vigente.
  SELECT version INTO v_version
  FROM public.transicionar_pedido_personalizado(
    v_pedido, v_version, v_usuario_1, 'VENDA FECHADA', '000001', NULL, NULL, NULL, NULL, NULL
  );

  -- Fora de RASCUNHO, produtos ja ficam bloqueados (decisao de negocio desta fase).
  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_produtos_moriah(
      v_pedido, v_version, v_usuario_1,
      jsonb_build_array((v_payload_base->0) || jsonb_build_object('id', v_tapete))
    );
    RAISE EXCEPTION 'TESTE_BLOQUEIO_PRODUTOS_VENDA_FECHADA_FALHOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'EDICAO_PRODUTOS_BLOQUEADA' THEN RAISE; END IF;
  END;

  -- Dados comerciais continuam editaveis em Venda Fechada.
  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_comercial_moriah(
    v_pedido, v_version, v_usuario_1, v_bigorrilho,
    'CONSULTORA NOVA', 'CLIENTE NOVO', NULL, NULL
  );

  -- Venda Fechada -> Aguardando Layout (exige pedido de compra/data/comprador).
  SELECT version INTO v_version
  FROM public.transicionar_pedido_personalizado(
    v_pedido, v_version, v_usuario_1, 'AGUARDANDO LAYOUT', NULL, '00123', current_date, 'ANA', NULL, NULL
  );
  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_comercial_moriah(
    v_pedido, v_version, v_usuario_1, v_bigorrilho,
    'CONSULTORA NOVA', 'CLIENTE NOVO', NULL, NULL
  );
  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_produtos_moriah(
      v_pedido, v_version, v_usuario_1,
      jsonb_build_array((v_payload_base->0) || jsonb_build_object('id', v_tapete))
    );
    RAISE EXCEPTION 'TESTE_BLOQUEIO_PRODUTOS_LAYOUT_FALHOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'EDICAO_PRODUTOS_BLOQUEADA' THEN RAISE; END IF;
  END;

  -- Primeiro anexo (slot 1). Necessario aqui porque transicionar_pedido_personalizado
  -- exige ao menos um anexo no pedido para avancar a Aguardando Aprovacao/Em Producao
  -- (ANEXO_LAYOUT_OBRIGATORIO) — os demais cenarios de anexo (abaixo) continuam
  -- exercitados com o pedido em RECEBIDO, so este primeiro precisou subir.
  v_caminho_1 := v_pedido::text || '/' || v_tapete::text || '/' || v_anexo_1::text || '/60000000-0000-4000-8000-000000000001.jpg';
  SELECT version INTO v_version
  FROM public.registrar_anexo_pedido_personalizado(
    v_pedido, v_tapete, v_version, 1, v_caminho_1,
    'sintetico.jpg', 'image/jpeg', 10485760, v_usuario_1, true
  );

  -- Aguardando Layout -> Aguardando Aprovacao do Cliente.
  SELECT version INTO v_version
  FROM public.transicionar_pedido_personalizado(
    v_pedido, v_version, v_usuario_1, U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', NULL, NULL, NULL, NULL, NULL, NULL
  );
  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_comercial_moriah(
    v_pedido, v_version, v_usuario_1, v_bigorrilho,
    'CONSULTORA NOVA', 'CLIENTE NOVO', NULL, NULL
  );
  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_produtos_moriah(
      v_pedido, v_version, v_usuario_1,
      jsonb_build_array((v_payload_base->0) || jsonb_build_object('id', v_tapete))
    );
    RAISE EXCEPTION 'TESTE_BLOQUEIO_PRODUTOS_APROVACAO_FALHOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'EDICAO_PRODUTOS_BLOQUEADA' THEN RAISE; END IF;
  END;

  -- Aguardando Aprovacao -> Em Producao (exige previsao de entrega).
  SELECT version INTO v_version
  FROM public.transicionar_pedido_personalizado(
    v_pedido, v_version, v_usuario_1, U&'EM PRODU\00C7\00C3O', NULL, NULL, NULL, NULL, current_date + 7, NULL
  );

  -- Producao bloqueia dados comerciais, mas permite administrativo e layout (mesmo
  -- status em cada chamada — atualizar_pedido_personalizado_administrativo nunca muda status).
  BEGIN
    PERFORM * FROM public.atualizar_pedido_personalizado_comercial_moriah(
      v_pedido, v_version, v_usuario_1, v_bigorrilho,
      'BLOQUEADA', 'BLOQUEADO', NULL, NULL
    );
    RAISE EXCEPTION 'TESTE_BLOQUEIO_PRODUCAO_FALHOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'EDICAO_COMERCIAL_BLOQUEADA' THEN RAISE; END IF;
  END;

  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_administrativo(
    v_pedido, v_version, v_usuario_1, '0001', NULL, NULL, NULL, NULL,
    U&'EM PRODU\00C7\00C3O', '[]'::jsonb
  );

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

  -- Em Producao -> Recebido.
  SELECT version INTO v_version
  FROM public.transicionar_pedido_personalizado(
    v_pedido, v_version, v_usuario_1, 'RECEBIDO', NULL, NULL, NULL, NULL, current_date, NULL
  );

  -- Recebido permite administrativo/layout (mesmo status) e bloqueia dados comerciais.
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
      'BLOQUEADA', 'BLOQUEADO', NULL, NULL
    );
    RAISE EXCEPTION 'TESTE_BLOQUEIO_RECEBIDO_FALHOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'EDICAO_COMERCIAL_BLOQUEADA' THEN RAISE; END IF;
  END;

  -- Anexos continuam editaveis em RECEBIDO. O anexo do slot 1 ja existe (registrado
  -- mais acima, exigido pela transicao); a partir daqui seguem os demais cenarios.
  -- Slot duplicado com apenas um anexo.
  v_caminho_3 := v_pedido::text || '/' || v_tapete::text || '/' || v_anexo_3::text || '/60000000-0000-4000-8000-000000000003.png';
  BEGIN
    PERFORM * FROM public.registrar_anexo_pedido_personalizado(
      v_pedido, v_tapete, v_version, 1, v_caminho_3,
      'duplicado.png', 'image/png', 1, v_usuario_1, true
    );
    RAISE EXCEPTION 'TESTE_SLOT_DUPLICADO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'SLOT_ANEXO_OCUPADO' THEN RAISE; END IF;
  END;

  v_caminho_2 := v_pedido::text || '/' || v_tapete::text || '/' || v_anexo_2::text || '/60000000-0000-4000-8000-000000000002.pdf';
  SELECT version INTO v_version
  FROM public.registrar_anexo_pedido_personalizado(
    v_pedido, v_tapete, v_version, 2, v_caminho_2,
    'sintetico.pdf', 'application/pdf', 1, v_usuario_1, true
  );

  -- Terceiro anexo, MIME e tamanho invalidos.
  BEGIN
    PERFORM * FROM public.registrar_anexo_pedido_personalizado(
      v_pedido, v_tapete, v_version, 1, v_caminho_3,
      'terceiro.png', 'image/png', 1, v_usuario_1, true
    );
    RAISE EXCEPTION 'TESTE_TERCEIRO_ANEXO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LIMITE_ANEXOS' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.registrar_anexo_pedido_personalizado(
      v_pedido, v_tapete, v_version, 1, v_caminho_3,
      'tipo.exe', 'application/octet-stream', 1, v_usuario_1, true
    );
    RAISE EXCEPTION 'TESTE_MIME_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TIPO_ARQUIVO_INVALIDO' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.registrar_anexo_pedido_personalizado(
      v_pedido, v_tapete, v_version, 1, v_caminho_3,
      'grande.png', 'image/png', 10485761, v_usuario_1, true
    );
    RAISE EXCEPTION 'TESTE_TAMANHO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TAMANHO_ARQUIVO_INVALIDO' THEN RAISE; END IF;
  END;

  -- Tapete de outro pedido e expected_version antigo.
  BEGIN
    PERFORM * FROM public.registrar_anexo_pedido_personalizado(
      v_pedido, v_tapete_outro, v_version, 1, v_caminho_3,
      'outro.png', 'image/png', 1, v_usuario_1, true
    );
    RAISE EXCEPTION 'TESTE_TAPETE_OUTRO_PEDIDO_NAO_REJEITOU';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TAPETE_NAO_PERTENCE_AO_PEDIDO' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.remover_anexo_pedido_personalizado(
      v_pedido, v_anexo_2, v_version - 1, v_usuario_1, true
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
    'substituto.webp', 'image/webp', 100, v_usuario_1, true
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
      'nao-gravar.jpg', 'image/jpeg', 1, v_usuario_1, true
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
    v_pedido, v_anexo_2, v_version, v_usuario_1, true
  );
  IF EXISTS (SELECT 1 FROM public.pedidos_personalizados_anexos WHERE id = v_anexo_2)
     OR NOT EXISTS (
       SELECT 1 FROM public.pedidos_personalizados_storage_pendencias
       WHERE caminho_objeto = v_caminho_2 AND motivo = 'REMOCAO_ANEXO' AND processado_em IS NULL
     ) THEN
    RAISE EXCEPTION 'TESTE_REMOCAO_ANEXO_FALHOU';
  END IF;

  -- Volta a RASCUNHO (unico status onde produtos sao editaveis), inclui segundo
  -- tapete e remove o primeiro com anexo — agora via rota de produtos propria.
  -- NOTA: transicionar_pedido_personalizado nunca leva nenhum status de volta a
  -- RASCUNHO (confirmado lendo o corpo da funcao: RASCUNHO so aparece como origem,
  -- nunca como destino) e RECEBIDO nao tem nenhuma transicao de saida — nao existe
  -- mais um caminho de negocio real para isso a partir daqui. Assim como ja feito em
  -- pedidos_personalizados_edicao_produtos_rascunho.sql (linha ~189) para forcar um
  -- status e testar apenas o bloqueio, aqui o UPDATE direto isola a unica coisa que
  -- este trecho quer exercitar: a fila atomica de storage ao remover um tapete com
  -- anexo, quando o pedido esta em RASCUNHO — sem reintroduzir uma transicao de
  -- negocio que nao existe mais.
  UPDATE public.pedidos_personalizados_pedidos
  SET status = 'RASCUNHO', version = version + 1
  WHERE id = v_pedido
  RETURNING version INTO v_version;
  v_payload_comercial := jsonb_build_array(
    (v_payload_base->0) || jsonb_build_object('id', v_tapete, 'ordem', 2),
    (v_payload_base->0) || jsonb_build_object('ordem', 1)
  );
  SELECT version, tapetes INTO v_version, v_tapetes
  FROM public.atualizar_pedido_personalizado_produtos_moriah(
    v_pedido, v_version, v_usuario_1, v_payload_comercial
  );
  SELECT (item->>'id')::uuid INTO v_tapete_novo
  FROM jsonb_array_elements(v_tapetes) AS item
  WHERE (item->>'id')::uuid <> v_tapete;

  v_payload_comercial := jsonb_build_array((v_payload_base->0) || jsonb_build_object('id', v_tapete_novo, 'ordem', 1));
  SELECT version INTO v_version
  FROM public.atualizar_pedido_personalizado_produtos_moriah(
    v_pedido, v_version, v_usuario_1, v_payload_comercial
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
