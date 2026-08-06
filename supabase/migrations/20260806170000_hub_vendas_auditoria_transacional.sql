-- RPCs transacionais para acoes administrativas do Hub/Vendas.
-- Garante que a alteracao e o registro em auditoria_acessos ocorram na mesma transacao.
-- Toda escrita usa SECURITY DEFINER e service_role.

-- ---------------------------------------------------------------------------
-- 1. Alterar limite diario
-- ---------------------------------------------------------------------------
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
  v_valor_atual jsonb;
  v_valor_novo jsonb;
  v_limite_anterior integer;
  v_atualizado_em timestamptz;
BEGIN
  SELECT valor INTO v_valor_atual
    FROM public.hub_vendas_config
    WHERE chave = 'parametros'
    FOR UPDATE;

  IF v_valor_atual IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_config_parametros_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  v_limite_anterior := COALESCE((v_valor_atual->>'limite_diario_por_conexao')::integer, (v_valor_atual->>'limite_diario')::integer, 15);
  v_valor_novo := jsonb_set(v_valor_atual, '{limite_diario_por_conexao}', to_jsonb(p_novo_limite), true);

  UPDATE public.hub_vendas_config
    SET valor = v_valor_novo,
        updated_at = now()
    WHERE chave = 'parametros'
    RETURNING updated_at INTO v_atualizado_em;

  INSERT INTO public.auditoria_acessos (acao, email, metadata)
    VALUES (
      'hub_vendas_limite_alterado',
      p_email,
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

-- ---------------------------------------------------------------------------
-- 2. Pausar automacao
-- ---------------------------------------------------------------------------
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
  v_valor_atual jsonb;
  v_valor_novo jsonb;
  v_motivo text;
  v_atualizado_em timestamptz;
BEGIN
  v_motivo := COALESCE(left(p_motivo, 500), 'Pausa manual via tela administrativa');

  SELECT valor INTO v_valor_atual
    FROM public.hub_vendas_config
    WHERE chave = 'automacao'
    FOR UPDATE;

  IF v_valor_atual IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_config_automacao_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  v_valor_novo := v_valor_atual
    || jsonb_build_object(
      'pausada', true,
      'motivo', v_motivo,
      'pausado_em', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
    );

  UPDATE public.hub_vendas_config
    SET valor = v_valor_novo,
        updated_at = now()
    WHERE chave = 'automacao'
    RETURNING updated_at INTO v_atualizado_em;

  INSERT INTO public.auditoria_acessos (acao, email, metadata)
    VALUES ('hub_vendas_automacao_pausada', p_email, jsonb_build_object('motivo', v_motivo));

  RETURN jsonb_build_object(
    'ok', true,
    'pausada', true,
    'motivo', v_motivo,
    'atualizado_em', v_atualizado_em
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reativar automacao
-- ---------------------------------------------------------------------------
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
  v_valor_atual jsonb;
  v_valor_novo jsonb;
  v_motivo text;
  v_atualizado_em timestamptz;
BEGIN
  v_motivo := COALESCE(left(p_motivo, 500), 'Reativação manual via tela administrativa');

  SELECT valor INTO v_valor_atual
    FROM public.hub_vendas_config
    WHERE chave = 'automacao'
    FOR UPDATE;

  IF v_valor_atual IS NULL THEN
    RAISE EXCEPTION 'hub_vendas_config_automacao_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  v_valor_novo := v_valor_atual
    || jsonb_build_object(
      'pausada', false,
      'motivo', v_motivo,
      'pausado_em', null
    );

  UPDATE public.hub_vendas_config
    SET valor = v_valor_novo,
        updated_at = now()
    WHERE chave = 'automacao'
    RETURNING updated_at INTO v_atualizado_em;

  INSERT INTO public.auditoria_acessos (acao, email, metadata)
    VALUES ('hub_vendas_automacao_reativada', p_email, jsonb_build_object('motivo', v_motivo));

  RETURN jsonb_build_object(
    'ok', true,
    'pausada', false,
    'motivo', v_motivo,
    'atualizado_em', v_atualizado_em
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cancelar fila agendada
-- ---------------------------------------------------------------------------
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
  v_motivo text;
BEGIN
  v_motivo := COALESCE(left(p_motivo, 500), 'Cancelamento manual via tela administrativa');

  UPDATE public.hub_vendas_recuperacao_fila
    SET status = 'cancelado',
        motivo_cancelamento = v_motivo,
        updated_at = now()
    WHERE id = p_fila_id
      AND status = 'agendado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_transicao_invalida' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.auditoria_acessos (acao, email, metadata)
    VALUES ('hub_vendas_fila_cancelada', p_email, jsonb_build_object('fila_id', p_fila_id, 'motivo', v_motivo));

  RETURN jsonb_build_object('ok', true, 'fila_id', p_fila_id, 'status', 'cancelado');
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Reprocessar fila com erro
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hub_vendas_reprocessar_fila_erro(
  p_email text,
  p_fila_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.hub_vendas_recuperacao_fila
    SET status = 'agendado',
        programado_para = now(),
        erro = NULL,
        categoria_erro = NULL,
        updated_at = now()
    WHERE id = p_fila_id
      AND status = 'erro';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_transicao_invalida' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.auditoria_acessos (acao, email, metadata)
    VALUES ('hub_vendas_fila_reprocessada', p_email, jsonb_build_object('fila_id', p_fila_id));

  RETURN jsonb_build_object('ok', true, 'fila_id', p_fila_id, 'status', 'agendado');
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Liberar analise manual
-- ---------------------------------------------------------------------------
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
  v_motivo text;
BEGIN
  v_motivo := COALESCE(left(p_motivo, 500), 'Liberação manual via tela administrativa');

  UPDATE public.hub_vendas_recuperacao_fila
    SET status = 'cancelado',
        motivo_cancelamento = v_motivo,
        updated_at = now()
    WHERE id = p_fila_id
      AND status = 'analise_manual';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_transicao_invalida' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.auditoria_acessos (acao, email, metadata)
    VALUES ('hub_vendas_analise_manual_liberada', p_email, jsonb_build_object('fila_id', p_fila_id, 'motivo', v_motivo));

  RETURN jsonb_build_object('ok', true, 'fila_id', p_fila_id, 'status', 'cancelado');
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissoes: apenas service_role pode executar as RPCs
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.hub_vendas_alterar_limite_diario(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_pausar_automacao(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_reativar_automacao(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_cancelar_fila_agendada(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_reprocessar_fila_erro(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_liberar_analise_manual(text, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hub_vendas_alterar_limite_diario(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_pausar_automacao(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_reativar_automacao(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_cancelar_fila_agendada(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_reprocessar_fila_erro(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_liberar_analise_manual(text, uuid, text) TO service_role;
