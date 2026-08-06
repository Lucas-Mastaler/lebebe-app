-- RPCs transacionais para ações administrativas do Hub/Vendas.
--
-- Garante que a alteração operacional e o registro em auditoria_acessos
-- ocorram dentro da mesma transação PostgreSQL.
--
-- As funções usam SECURITY DEFINER e somente service_role pode executá-las.

-- ===========================================================================
-- 1. ALTERAR LIMITE DIÁRIO POR LOJA/CONEXÃO
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.hub_vendas_alterar_limite_diario(
  p_email text,
  p_novo_limite integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text;
  v_valor_atual jsonb;
  v_valor_novo jsonb;
  v_limite_anterior integer;
  v_atualizado_em timestamptz;
BEGIN
  v_email := NULLIF(left(btrim(p_email), 320), '');

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_email_auditoria_obrigatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_novo_limite IS NULL
     OR p_novo_limite < 0
     OR p_novo_limite > 50 THEN
    RAISE EXCEPTION 'hub_vendas_limite_invalido'
      USING
        ERRCODE = '22023',
        DETAIL = 'O limite diário deve ser um número inteiro entre 0 e 50.';
  END IF;

  SELECT config.valor
    INTO v_valor_atual
  FROM public.hub_vendas_config AS config
  WHERE config.chave = 'parametros'
  FOR UPDATE;

  IF v_valor_atual IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_config_parametros_nao_encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  v_limite_anterior := COALESCE(
    (v_valor_atual ->> 'limite_diario_por_conexao')::integer,
    (v_valor_atual ->> 'limite_diario')::integer,
    15
  );

  v_valor_novo := jsonb_set(
    v_valor_atual,
    '{limite_diario_por_conexao}',
    to_jsonb(p_novo_limite),
    true
  );

  UPDATE public.hub_vendas_config AS config
  SET
    valor = v_valor_novo,
    updated_at = now()
  WHERE config.chave = 'parametros'
  RETURNING config.updated_at
    INTO v_atualizado_em;

  INSERT INTO public.auditoria_acessos (
    acao,
    email,
    metadata
  )
  VALUES (
    'hub_vendas_limite_alterado',
    v_email,
    jsonb_build_object(
      'valor_anterior', v_limite_anterior,
      'valor_novo', p_novo_limite,
      'chave', 'parametros.limite_diario_por_conexao'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'valor_anterior', v_limite_anterior,
    'valor_novo', p_novo_limite,
    'atualizado_em', v_atualizado_em
  );
END;
$$;


-- ===========================================================================
-- 2. PAUSAR AUTOMAÇÃO
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.hub_vendas_pausar_automacao(
  p_email text,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text;
  v_valor_atual jsonb;
  v_valor_novo jsonb;
  v_motivo text;
  v_atualizado_em timestamptz;
  v_ja_estava_pausada boolean;
BEGIN
  v_email := NULLIF(left(btrim(p_email), 320), '');

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_email_auditoria_obrigatorio'
      USING ERRCODE = '22023';
  END IF;

  v_motivo := COALESCE(
    NULLIF(left(btrim(p_motivo), 500), ''),
    'Pausa manual via tela administrativa'
  );

  SELECT config.valor
    INTO v_valor_atual
  FROM public.hub_vendas_config AS config
  WHERE config.chave = 'automacao'
  FOR UPDATE;

  IF v_valor_atual IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_config_automacao_nao_encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  v_ja_estava_pausada := COALESCE(
    (v_valor_atual ->> 'pausada')::boolean,
    false
  );

  v_valor_novo := v_valor_atual
    || jsonb_build_object(
      'pausada', true,
      'motivo', v_motivo,
      'pausado_em', now()
    );

  UPDATE public.hub_vendas_config AS config
  SET
    valor = v_valor_novo,
    updated_at = now()
  WHERE config.chave = 'automacao'
  RETURNING config.updated_at
    INTO v_atualizado_em;

  INSERT INTO public.auditoria_acessos (
    acao,
    email,
    metadata
  )
  VALUES (
    'hub_vendas_automacao_pausada',
    v_email,
    jsonb_build_object(
      'motivo', v_motivo,
      'ja_estava_pausada', v_ja_estava_pausada
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'pausada', true,
    'motivo', v_motivo,
    'ja_estava_pausada', v_ja_estava_pausada,
    'atualizado_em', v_atualizado_em
  );
END;
$$;


-- ===========================================================================
-- 3. REATIVAR AUTOMAÇÃO
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.hub_vendas_reativar_automacao(
  p_email text,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text;
  v_valor_atual jsonb;
  v_valor_novo jsonb;
  v_motivo text;
  v_atualizado_em timestamptz;
  v_ja_estava_ativa boolean;
BEGIN
  v_email := NULLIF(left(btrim(p_email), 320), '');

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_email_auditoria_obrigatorio'
      USING ERRCODE = '22023';
  END IF;

  v_motivo := COALESCE(
    NULLIF(left(btrim(p_motivo), 500), ''),
    'Reativação manual via tela administrativa'
  );

  SELECT config.valor
    INTO v_valor_atual
  FROM public.hub_vendas_config AS config
  WHERE config.chave = 'automacao'
  FOR UPDATE;

  IF v_valor_atual IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_config_automacao_nao_encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  v_ja_estava_ativa := NOT COALESCE(
    (v_valor_atual ->> 'pausada')::boolean,
    true
  );

  v_valor_novo := v_valor_atual
    || jsonb_build_object(
      'pausada', false,
      'motivo', v_motivo,
      'pausado_em', null
    );

  UPDATE public.hub_vendas_config AS config
  SET
    valor = v_valor_novo,
    updated_at = now()
  WHERE config.chave = 'automacao'
  RETURNING config.updated_at
    INTO v_atualizado_em;

  INSERT INTO public.auditoria_acessos (
    acao,
    email,
    metadata
  )
  VALUES (
    'hub_vendas_automacao_reativada',
    v_email,
    jsonb_build_object(
      'motivo', v_motivo,
      'ja_estava_ativa', v_ja_estava_ativa
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'pausada', false,
    'motivo', v_motivo,
    'ja_estava_ativa', v_ja_estava_ativa,
    'atualizado_em', v_atualizado_em
  );
END;
$$;


-- ===========================================================================
-- 4. CANCELAR FILA AGENDADA
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.hub_vendas_cancelar_fila_agendada(
  p_email text,
  p_fila_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text;
  v_motivo text;
  v_atualizado_em timestamptz;
BEGIN
  v_email := NULLIF(left(btrim(p_email), 320), '');

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_email_auditoria_obrigatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_fila_id IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_fila_id_obrigatorio'
      USING ERRCODE = '22023';
  END IF;

  v_motivo := COALESCE(
    NULLIF(left(btrim(p_motivo), 500), ''),
    'Cancelamento manual via tela administrativa'
  );

  UPDATE public.hub_vendas_recuperacao_fila AS fila
  SET
    status = 'cancelado',
    motivo_cancelamento = v_motivo,
    reservado_em = NULL,
    reservado_por = NULL,
    updated_at = now()
  WHERE fila.id = p_fila_id
    AND fila.status = 'agendado'
  RETURNING fila.updated_at
    INTO v_atualizado_em;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_transicao_invalida'
      USING
        ERRCODE = 'P0002',
        DETAIL = 'A fila não existe ou não está no status agendado.';
  END IF;

  INSERT INTO public.auditoria_acessos (
    acao,
    email,
    metadata
  )
  VALUES (
    'hub_vendas_fila_cancelada',
    v_email,
    jsonb_build_object(
      'fila_id', p_fila_id,
      'status_anterior', 'agendado',
      'status_novo', 'cancelado',
      'motivo', v_motivo
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'fila_id', p_fila_id,
    'status', 'cancelado',
    'motivo', v_motivo,
    'atualizado_em', v_atualizado_em
  );
END;
$$;


-- ===========================================================================
-- 5. REPROCESSAR FILA COM ERRO
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.hub_vendas_reprocessar_fila_erro(
  p_email text,
  p_fila_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text;
  v_tentativas_anteriores integer;
  v_atualizado_em timestamptz;
BEGIN
  v_email := NULLIF(left(btrim(p_email), 320), '');

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_email_auditoria_obrigatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_fila_id IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_fila_id_obrigatorio'
      USING ERRCODE = '22023';
  END IF;

  SELECT fila.tentativas_envio
    INTO v_tentativas_anteriores
  FROM public.hub_vendas_recuperacao_fila AS fila
  WHERE fila.id = p_fila_id
    AND fila.status = 'erro'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_transicao_invalida'
      USING
        ERRCODE = 'P0002',
        DETAIL = 'A fila não existe ou não está no status erro.';
  END IF;

  UPDATE public.hub_vendas_recuperacao_fila AS fila
  SET
    status = 'agendado',
    programado_para = now(),

    reservado_em = NULL,
    reservado_por = NULL,

    requisicao_iniciada_em = NULL,
    requisicao_finalizada_em = NULL,

    enviado_em = NULL,
    resultado = NULL,

    erro = NULL,
    categoria_erro = NULL,
    motivo_cancelamento = NULL,

    digisac_message_id = NULL,

    ultima_reconciliacao_em = NULL,
    quantidade_reconciliacoes = 0,

    updated_at = now()
  WHERE fila.id = p_fila_id
    AND fila.status = 'erro'
  RETURNING fila.updated_at
    INTO v_atualizado_em;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_transicao_invalida'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.auditoria_acessos (
    acao,
    email,
    metadata
  )
  VALUES (
    'hub_vendas_fila_reprocessada',
    v_email,
    jsonb_build_object(
      'fila_id', p_fila_id,
      'status_anterior', 'erro',
      'status_novo', 'agendado',
      'tentativas_envio_preservadas', v_tentativas_anteriores,
      'programado_para', now()
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'fila_id', p_fila_id,
    'status', 'agendado',
    'tentativas_envio', v_tentativas_anteriores,
    'atualizado_em', v_atualizado_em
  );
END;
$$;


-- ===========================================================================
-- 6. ENCERRAR/CANCELAR CASO EM ANÁLISE MANUAL
--
-- O nome da RPC é preservado por compatibilidade com o código atual.
-- O comportamento seguro continua sendo cancelar, e não reenviar automaticamente.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.hub_vendas_liberar_analise_manual(
  p_email text,
  p_fila_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text;
  v_motivo text;
  v_atualizado_em timestamptz;
BEGIN
  v_email := NULLIF(left(btrim(p_email), 320), '');

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_email_auditoria_obrigatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_fila_id IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_fila_id_obrigatorio'
      USING ERRCODE = '22023';
  END IF;

  v_motivo := COALESCE(
    NULLIF(left(btrim(p_motivo), 500), ''),
    'Encerramento manual de caso em análise'
  );

  UPDATE public.hub_vendas_recuperacao_fila AS fila
  SET
    status = 'cancelado',
    motivo_cancelamento = v_motivo,
    reservado_em = NULL,
    reservado_por = NULL,
    updated_at = now()
  WHERE fila.id = p_fila_id
    AND fila.status = 'analise_manual'
  RETURNING fila.updated_at
    INTO v_atualizado_em;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_transicao_invalida'
      USING
        ERRCODE = 'P0002',
        DETAIL = 'A fila não existe ou não está no status analise_manual.';
  END IF;

  INSERT INTO public.auditoria_acessos (
    acao,
    email,
    metadata
  )
  VALUES (
    'hub_vendas_analise_manual_liberada',
    v_email,
    jsonb_build_object(
      'fila_id', p_fila_id,
      'status_anterior', 'analise_manual',
      'status_novo', 'cancelado',
      'motivo', v_motivo,
      'comportamento', 'encerramento_sem_reenvio'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'fila_id', p_fila_id,
    'status', 'cancelado',
    'motivo', v_motivo,
    'atualizado_em', v_atualizado_em
  );
END;
$$;


-- ===========================================================================
-- PERMISSÕES
-- ===========================================================================

REVOKE ALL ON FUNCTION public.hub_vendas_alterar_limite_diario(text, integer)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.hub_vendas_pausar_automacao(text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.hub_vendas_reativar_automacao(text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.hub_vendas_cancelar_fila_agendada(text, uuid, text)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.hub_vendas_reprocessar_fila_erro(text, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.hub_vendas_liberar_analise_manual(text, uuid, text)
  FROM PUBLIC, anon, authenticated;


GRANT EXECUTE
  ON FUNCTION public.hub_vendas_alterar_limite_diario(text, integer)
  TO service_role;

GRANT EXECUTE
  ON FUNCTION public.hub_vendas_pausar_automacao(text, text)
  TO service_role;

GRANT EXECUTE
  ON FUNCTION public.hub_vendas_reativar_automacao(text, text)
  TO service_role;

GRANT EXECUTE
  ON FUNCTION public.hub_vendas_cancelar_fila_agendada(text, uuid, text)
  TO service_role;

GRANT EXECUTE
  ON FUNCTION public.hub_vendas_reprocessar_fila_erro(text, uuid)
  TO service_role;

GRANT EXECUTE
  ON FUNCTION public.hub_vendas_liberar_analise_manual(text, uuid, text)
  TO service_role;