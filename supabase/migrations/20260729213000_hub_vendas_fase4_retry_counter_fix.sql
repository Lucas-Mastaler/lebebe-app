CREATE OR REPLACE FUNCTION public.hub_vendas_registrar_erro_fila(
  p_fila_id uuid,
  p_worker text,
  p_categoria text,
  p_erro text,
  p_retentavel boolean DEFAULT false,
  p_backoff_minutos integer DEFAULT NULL,
  p_incrementa_erro_conexao boolean DEFAULT false
)
RETURNS public.hub_vendas_recuperacao_fila
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fila public.hub_vendas_recuperacao_fila%ROWTYPE;
  v_status_final text;
  v_pausas jsonb;
  v_parametros jsonb;
  v_limite_pausa integer;
  v_erros integer;
  v_tentativas_final integer;
BEGIN
  SELECT fila.*
    INTO v_fila
    FROM public.hub_vendas_recuperacao_fila AS fila
    WHERE fila.id = p_fila_id
      AND fila.status IN ('reservado', 'enviando')
      AND fila.reservado_por = p_worker
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_registro_erro_invalido' USING ERRCODE = 'P0002';
  END IF;

  v_tentativas_final := CASE
    WHEN v_fila.status = 'reservado' THEN v_fila.tentativas_envio + 1
    ELSE v_fila.tentativas_envio
  END;

  v_status_final := CASE
    WHEN p_retentavel IS TRUE AND v_tentativas_final <= 3 THEN 'agendado'
    ELSE 'erro'
  END;

  UPDATE public.hub_vendas_recuperacao_fila AS fila
    SET
      status = v_status_final,
      programado_para = CASE
        WHEN v_status_final = 'agendado' AND p_backoff_minutos IS NOT NULL
          THEN now() + make_interval(mins => GREATEST(p_backoff_minutos, 1))
        ELSE fila.programado_para
      END,
      requisicao_finalizada_em = CASE WHEN fila.status = 'enviando' THEN now() ELSE fila.requisicao_finalizada_em END,
      tentativas_envio = CASE WHEN fila.status = 'reservado' THEN fila.tentativas_envio + 1 ELSE fila.tentativas_envio END,
      categoria_erro = p_categoria,
      erro = left(p_erro, 500),
      resultado = CASE WHEN v_status_final = 'agendado' THEN 'retry_agendado' ELSE 'erro' END,
      reservado_em = CASE WHEN v_status_final = 'agendado' THEN NULL ELSE fila.reservado_em END,
      reservado_por = CASE WHEN v_status_final = 'agendado' THEN NULL ELSE fila.reservado_por END,
      updated_at = now()
    WHERE fila.id = v_fila.id
    RETURNING fila.*
    INTO v_fila;

  IF p_incrementa_erro_conexao IS TRUE THEN
    SELECT valor INTO v_pausas
      FROM public.hub_vendas_config
      WHERE chave = 'pausas_conexoes'
      FOR UPDATE;

    SELECT valor INTO v_parametros
      FROM public.hub_vendas_config
      WHERE chave = 'parametros';

    v_limite_pausa := COALESCE((v_parametros->>'pausa_automatica_erros')::integer, 3);
    v_erros := COALESCE((v_pausas #>> ARRAY[v_fila.conexao_destino_id, 'erros_consecutivos'])::integer, 0) + 1;

    v_pausas := jsonb_set(v_pausas, ARRAY[v_fila.conexao_destino_id, 'erros_consecutivos'], to_jsonb(v_erros), true);

    IF v_erros >= v_limite_pausa THEN
      v_pausas := jsonb_set(v_pausas, ARRAY[v_fila.conexao_destino_id, 'pausada'], 'true'::jsonb, true);
      v_pausas := jsonb_set(v_pausas, ARRAY[v_fila.conexao_destino_id, 'motivo'], to_jsonb('pausa_automatica_erro_envio'::text), true);
      v_pausas := jsonb_set(v_pausas, ARRAY[v_fila.conexao_destino_id, 'pausada_em'], to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);
    END IF;

    UPDATE public.hub_vendas_config
      SET valor = v_pausas,
          updated_at = now()
      WHERE chave = 'pausas_conexoes';
  END IF;

  RETURN v_fila;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_vendas_registrar_erro_fila(uuid, text, text, text, boolean, integer, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_vendas_registrar_erro_fila(uuid, text, text, text, boolean, integer, boolean)
  TO service_role;
