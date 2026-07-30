-- Hub/Vendas recuperacao - Fase 4: reserva atomica e transicoes seguras de envio.
-- Nao ativa automacao global, nao cria cron recorrente e nao envia mensagens.

ALTER TABLE public.hub_vendas_recuperacao_fila
  ADD COLUMN IF NOT EXISTS tentativas_envio integer NOT NULL DEFAULT 0;

ALTER TABLE public.hub_vendas_recuperacao_fila
  DROP CONSTRAINT IF EXISTS hub_vendas_fila_tentativas_envio_check;

ALTER TABLE public.hub_vendas_recuperacao_fila
  ADD CONSTRAINT hub_vendas_fila_tentativas_envio_check
    CHECK (tentativas_envio >= 0);

CREATE INDEX IF NOT EXISTS idx_hub_vendas_fila_reserva_vencida
  ON public.hub_vendas_recuperacao_fila (programado_para, created_at)
  WHERE status = 'agendado';

CREATE OR REPLACE FUNCTION public.hub_vendas_reservar_filas_recuperacao(
  p_limite integer,
  p_worker text,
  p_modo_teste boolean DEFAULT false,
  p_fila_id uuid DEFAULT NULL
)
RETURNS SETOF public.hub_vendas_recuperacao_fila
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_automacao jsonb;
  v_pausas jsonb;
  v_limite integer;
BEGIN
  IF p_limite IS NULL OR p_limite < 1 THEN
    RAISE EXCEPTION 'hub_vendas_limite_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_worker IS NULL OR btrim(p_worker) = '' OR length(p_worker) > 80 THEN
    RAISE EXCEPTION 'hub_vendas_worker_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_fila_id IS NOT NULL AND p_modo_teste IS NOT TRUE THEN
    RAISE EXCEPTION 'hub_vendas_modo_teste_obrigatorio' USING ERRCODE = '22023';
  END IF;

  v_limite := LEAST(p_limite, 5);

  SELECT valor INTO v_automacao
    FROM public.hub_vendas_config
    WHERE chave = 'automacao';

  SELECT valor INTO v_pausas
    FROM public.hub_vendas_config
    WHERE chave = 'pausas_conexoes';

  IF p_modo_teste IS NOT TRUE
     AND (
       COALESCE((v_automacao->>'ativa')::boolean, false) IS NOT TRUE
       OR COALESCE((v_automacao->>'pausada')::boolean, true) IS TRUE
     ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT fila.id
      FROM public.hub_vendas_recuperacao_fila AS fila
      WHERE fila.status = 'agendado'
        AND fila.programado_para <= now()
        AND (p_fila_id IS NULL OR fila.id = p_fila_id)
        AND (
          p_modo_teste IS TRUE
          OR COALESCE((v_pausas->fila.conexao_destino_id->>'pausada')::boolean, false) IS NOT TRUE
        )
      ORDER BY fila.programado_para ASC, fila.created_at ASC
      LIMIT v_limite
      FOR UPDATE SKIP LOCKED
  )
  UPDATE public.hub_vendas_recuperacao_fila AS fila
    SET
      status = 'reservado',
      reservado_em = now(),
      reservado_por = p_worker,
      erro = NULL,
      categoria_erro = NULL,
      resultado = NULL,
      updated_at = now()
    FROM candidatas
    WHERE fila.id = candidatas.id
    RETURNING fila.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.hub_vendas_marcar_fila_enviando(
  p_fila_id uuid,
  p_worker text,
  p_digisac_contact_id text,
  p_digisac_ticket_id text,
  p_versao_mensagem integer,
  p_texto_enviado text,
  p_hash_texto_enviado text
)
RETURNS public.hub_vendas_recuperacao_fila
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fila public.hub_vendas_recuperacao_fila%ROWTYPE;
BEGIN
  IF p_versao_mensagem IS NULL OR p_versao_mensagem < 1 OR p_versao_mensagem > 5 THEN
    RAISE EXCEPTION 'hub_vendas_versao_mensagem_invalida' USING ERRCODE = '22023';
  END IF;

  IF p_hash_texto_enviado IS NULL OR p_hash_texto_enviado !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'hub_vendas_hash_texto_invalido' USING ERRCODE = '22023';
  END IF;

  UPDATE public.hub_vendas_recuperacao_fila AS fila
    SET
      status = 'enviando',
      requisicao_iniciada_em = now(),
      digisac_contact_id = p_digisac_contact_id,
      digisac_ticket_id = p_digisac_ticket_id,
      versao_mensagem = p_versao_mensagem,
      texto_enviado = p_texto_enviado,
      hash_texto_enviado = p_hash_texto_enviado,
      tentativas_envio = fila.tentativas_envio + 1,
      erro = NULL,
      categoria_erro = NULL,
      resultado = NULL,
      updated_at = now()
    WHERE fila.id = p_fila_id
      AND fila.status = 'reservado'
      AND fila.reservado_por = p_worker
      AND fila.digisac_message_id IS NULL
    RETURNING fila.*
    INTO v_fila;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_transicao_enviando_invalida' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_fila;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.hub_vendas_cancelar_fila_reservada(
  p_fila_id uuid,
  p_worker text,
  p_motivo text
)
RETURNS public.hub_vendas_recuperacao_fila
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fila public.hub_vendas_recuperacao_fila%ROWTYPE;
BEGIN
  UPDATE public.hub_vendas_recuperacao_fila AS fila
    SET
      status = 'cancelado',
      motivo_cancelamento = p_motivo,
      ultima_reconciliacao_em = now(),
      quantidade_reconciliacoes = fila.quantidade_reconciliacoes + 1,
      updated_at = now()
    WHERE fila.id = p_fila_id
      AND fila.status IN ('agendado', 'reservado')
      AND (fila.reservado_por IS NULL OR fila.reservado_por = p_worker)
    RETURNING fila.*
    INTO v_fila;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_cancelamento_invalido' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_fila;
END;
$$;

CREATE OR REPLACE FUNCTION public.hub_vendas_registrar_resultado_incerto(
  p_fila_id uuid,
  p_worker text,
  p_categoria text,
  p_erro text
)
RETURNS public.hub_vendas_recuperacao_fila
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fila public.hub_vendas_recuperacao_fila%ROWTYPE;
BEGIN
  UPDATE public.hub_vendas_recuperacao_fila AS fila
    SET
      status = 'resultado_incerto',
      requisicao_finalizada_em = now(),
      categoria_erro = p_categoria,
      erro = left(p_erro, 500),
      resultado = 'resultado_incerto',
      updated_at = now()
    WHERE fila.id = p_fila_id
      AND fila.status = 'enviando'
      AND fila.reservado_por = p_worker
      AND fila.digisac_message_id IS NULL
    RETURNING fila.*
    INTO v_fila;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_resultado_incerto_invalido' USING ERRCODE = 'P0002';
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
      UPDATE public.hub_vendas_config
        SET valor = jsonb_set(
          jsonb_set(
            jsonb_set(valor, ARRAY[v_fila.conexao_destino_id, 'erros_consecutivos'], to_jsonb(v_erros), true),
            ARRAY[v_fila.conexao_destino_id, 'pausada'], to_jsonb(v_erros >= v_limite_pausa), true
          ),
          ARRAY[v_fila.conexao_destino_id, 'motivo'],
          to_jsonb(CASE WHEN v_erros >= v_limite_pausa THEN 'pausa_automatica_erros_envio' ELSE 'erro_envio' END),
          true
        )
        WHERE chave = 'pausas_conexoes';
    END IF;
  END IF;

  RETURN v_fila;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_vendas_reservar_filas_recuperacao(integer, text, boolean, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_marcar_fila_enviando(uuid, text, text, text, integer, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_confirmar_fila_enviada(uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_cancelar_fila_reservada(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_registrar_resultado_incerto(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_vendas_registrar_erro_fila(uuid, text, text, text, boolean, integer, boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hub_vendas_reservar_filas_recuperacao(integer, text, boolean, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_marcar_fila_enviando(uuid, text, text, text, integer, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_confirmar_fila_enviada(uuid, text, text, text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_cancelar_fila_reservada(uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_registrar_resultado_incerto(uuid, text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_vendas_registrar_erro_fila(uuid, text, text, text, boolean, integer, boolean)
  TO service_role;
