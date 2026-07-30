-- Hub/Vendas recuperacao - corrige chave JSONB de pausa automatica da Fase 4.
-- Substitui apenas as RPCs de erro e confirmacao; nao altera automacao, fila ou mensagens.

CREATE OR REPLACE FUNCTION public.hub_vendas_confirmar_fila_enviada(
  p_fila_id uuid,
  p_worker text,
  p_digisac_message_id text,
  p_digisac_contact_id text,
  p_digisac_ticket_id text,
  p_resultado text DEFAULT 'ok'
)
RETURNS public.hub_vendas_recuperacao_fila
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fila public.hub_vendas_recuperacao_fila%ROWTYPE;
  v_pausas jsonb;
BEGIN
  IF p_digisac_message_id IS NULL OR btrim(p_digisac_message_id) = '' THEN
    RAISE EXCEPTION 'hub_vendas_digisac_message_id_obrigatorio' USING ERRCODE = '22023';
  END IF;

  UPDATE public.hub_vendas_recuperacao_fila AS fila
    SET
      status = 'enviado',
      enviado_em = now(),
      requisicao_finalizada_em = now(),
      digisac_message_id = p_digisac_message_id,
      digisac_contact_id = COALESCE(p_digisac_contact_id, fila.digisac_contact_id),
      digisac_ticket_id = COALESCE(p_digisac_ticket_id, fila.digisac_ticket_id),
      resultado = p_resultado,
      erro = NULL,
      categoria_erro = NULL,
      updated_at = now()
    WHERE fila.id = p_fila_id
      AND fila.status = 'enviando'
      AND fila.reservado_por = p_worker
      AND fila.digisac_message_id IS NULL
    RETURNING fila.*
    INTO v_fila;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_confirmacao_envio_invalida' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.hub_vendas_leads AS lead
    SET
      status = 'recuperacao_enviada',
      data_recuperacao_enviada = v_fila.enviado_em,
      conexao_recuperacao_id = v_fila.conexao_destino_id,
      updated_at = now()
    WHERE lead.id = v_fila.lead_id
      AND lead.status = 'encaminhado_recuperacao';

  SELECT valor INTO v_pausas
    FROM public.hub_vendas_config
    WHERE chave = 'pausas_conexoes'
    FOR UPDATE;

  IF v_pausas ? v_fila.conexao_destino_id THEN
    UPDATE public.hub_vendas_config
      SET valor = jsonb_set(
        valor,
        ARRAY[v_fila.conexao_destino_id, 'erros_consecutivos'],
        '0'::jsonb,
        true
      )
      WHERE chave = 'pausas_conexoes';
  END IF;

  RETURN v_fila;
END;
$$;

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
    v_erros := COALESCE((v_pausas->v_fila.conexao_destino_id->>'erros_consecutivos')::integer, 0) + 1;

    IF v_pausas ? v_fila.conexao_destino_id THEN
      v_pausas := jsonb_set(
        v_pausas,
        ARRAY[v_fila.conexao_destino_id, 'erros_consecutivos'],
        to_jsonb(v_erros),
        true
      );
      v_pausas := jsonb_set(
        v_pausas,
        ARRAY[v_fila.conexao_destino_id, 'motivo'],
        to_jsonb(CASE WHEN v_erros >= v_limite_pausa THEN 'pausa_automatica_erro_envio' ELSE 'erro_envio' END),
        true
      );

      IF v_erros >= v_limite_pausa THEN
        v_pausas := jsonb_set(v_pausas, ARRAY[v_fila.conexao_destino_id, 'pausada'], 'true'::jsonb, true);
        v_pausas := jsonb_set(v_pausas, ARRAY[v_fila.conexao_destino_id, 'pausada_em'], to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);
      END IF;

      UPDATE public.hub_vendas_config
        SET valor = v_pausas,
            updated_at = now()
        WHERE chave = 'pausas_conexoes';
    END IF;
  END IF;

  RETURN v_fila;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_vendas_confirmar_fila_enviada(uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_registrar_erro_fila(uuid, text, text, text, boolean, integer, boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hub_vendas_confirmar_fila_enviada(uuid, text, text, text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_registrar_erro_fila(uuid, text, text, text, boolean, integer, boolean)
  TO service_role;
