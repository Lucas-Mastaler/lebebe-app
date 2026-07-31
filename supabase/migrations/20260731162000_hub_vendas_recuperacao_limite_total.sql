-- Hub/Vendas recuperacao - garante que p_limite seja global por execucao.

CREATE OR REPLACE FUNCTION public.hub_vendas_recuperar_filas_abandonadas(
  p_worker text,
  p_reserva_timeout_minutos integer DEFAULT 10,
  p_envio_timeout_minutos integer DEFAULT 15,
  p_limite integer DEFAULT 10,
  p_modo_simulacao boolean DEFAULT false
)
RETURNS TABLE (
  fila_id uuid,
  lead_id uuid,
  status_anterior text,
  status_novo text,
  acao text,
  motivo text,
  conexao_destino_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_worker text := NULLIF(btrim(p_worker), '');
  v_reserva_timeout interval := make_interval(mins => GREATEST(COALESCE(p_reserva_timeout_minutos, 10), 1));
  v_envio_timeout interval := make_interval(mins => GREATEST(COALESCE(p_envio_timeout_minutos, 15), 1));
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 10), 1), 50);
  v_restante integer := LEAST(GREATEST(COALESCE(p_limite, 10), 1), 50);
  v_processadas integer := 0;
BEGIN
  IF v_worker IS NULL OR length(v_worker) > 80 THEN
    RAISE EXCEPTION 'hub_vendas_worker_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_modo_simulacao IS TRUE THEN
    RETURN QUERY
    SELECT
      fila.id,
      fila.lead_id,
      fila.status,
      CASE
        WHEN fila.status = 'reservado' THEN 'agendado'
        WHEN fila.status = 'enviando' AND fila.digisac_message_id IS NOT NULL THEN 'enviado'
        ELSE 'resultado_incerto'
      END,
      CASE
        WHEN fila.status = 'reservado' THEN 'reserva_liberada'
        WHEN fila.status = 'enviando' AND fila.digisac_message_id IS NOT NULL THEN 'reconciliado_enviado'
        ELSE 'movido_resultado_incerto'
      END,
      CASE
        WHEN fila.status = 'reservado' THEN 'reserva_abandonada_antes_post'
        WHEN fila.status = 'enviando' AND fila.digisac_message_id IS NOT NULL THEN 'digisac_message_id_presente'
        ELSE 'envio_abandonado_apos_post'
      END,
      fila.conexao_destino_id
    FROM public.hub_vendas_recuperacao_fila AS fila
    WHERE (
        fila.status = 'reservado'
        AND fila.reservado_em < now() - v_reserva_timeout
        AND fila.requisicao_iniciada_em IS NULL
        AND fila.digisac_message_id IS NULL
      )
      OR (
        fila.status = 'enviando'
        AND fila.requisicao_iniciada_em < now() - v_envio_timeout
        AND fila.requisicao_finalizada_em IS NULL
      )
    ORDER BY COALESCE(fila.requisicao_iniciada_em, fila.reservado_em), fila.created_at
    LIMIT v_limite;
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT fila.id
    FROM public.hub_vendas_recuperacao_fila AS fila
    WHERE fila.status = 'reservado'
      AND fila.reservado_em < now() - v_reserva_timeout
      AND fila.requisicao_iniciada_em IS NULL
      AND fila.digisac_message_id IS NULL
    ORDER BY fila.reservado_em, fila.created_at
    LIMIT v_restante
    FOR UPDATE SKIP LOCKED
  ),
  atualizadas AS (
    UPDATE public.hub_vendas_recuperacao_fila AS fila
    SET
      status = 'agendado',
      reservado_em = NULL,
      reservado_por = NULL,
      resultado = 'recuperado_reserva_abandonada',
      erro = 'reserva_abandonada_antes_post',
      categoria_erro = 'recuperacao_segura',
      updated_at = now()
    FROM candidatas
    WHERE fila.id = candidatas.id
    RETURNING fila.id, fila.lead_id, fila.conexao_destino_id
  )
  SELECT
    atualizadas.id,
    atualizadas.lead_id,
    'reservado'::text,
    'agendado'::text,
    'reserva_liberada'::text,
    'reserva_abandonada_antes_post'::text,
    atualizadas.conexao_destino_id
  FROM atualizadas;

  GET DIAGNOSTICS v_processadas = ROW_COUNT;
  v_restante := v_restante - v_processadas;
  IF v_restante <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT fila.id
    FROM public.hub_vendas_recuperacao_fila AS fila
    WHERE fila.status = 'enviando'
      AND fila.requisicao_iniciada_em < now() - v_envio_timeout
      AND fila.requisicao_finalizada_em IS NULL
      AND fila.digisac_message_id IS NOT NULL
    ORDER BY fila.requisicao_iniciada_em, fila.created_at
    LIMIT v_restante
    FOR UPDATE SKIP LOCKED
  ),
  atualizadas AS (
    UPDATE public.hub_vendas_recuperacao_fila AS fila
    SET
      status = 'enviado',
      enviado_em = COALESCE(fila.enviado_em, now()),
      requisicao_finalizada_em = now(),
      resultado = COALESCE(fila.resultado, 'reconciliado_por_message_id'),
      erro = NULL,
      categoria_erro = NULL,
      updated_at = now()
    FROM candidatas
    WHERE fila.id = candidatas.id
    RETURNING fila.id, fila.lead_id, fila.conexao_destino_id, fila.enviado_em
  ),
  leads_atualizados AS (
    UPDATE public.hub_vendas_leads AS lead
    SET
      status = 'recuperacao_enviada',
      data_recuperacao_enviada = atualizadas.enviado_em,
      conexao_recuperacao_id = atualizadas.conexao_destino_id,
      updated_at = now()
    FROM atualizadas
    WHERE lead.id = atualizadas.lead_id
      AND lead.status = 'encaminhado_recuperacao'
    RETURNING lead.id
  )
  SELECT
    atualizadas.id,
    atualizadas.lead_id,
    'enviando'::text,
    'enviado'::text,
    'reconciliado_enviado'::text,
    'digisac_message_id_presente'::text,
    atualizadas.conexao_destino_id
  FROM atualizadas;

  GET DIAGNOSTICS v_processadas = ROW_COUNT;
  v_restante := v_restante - v_processadas;
  IF v_restante <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT fila.id
    FROM public.hub_vendas_recuperacao_fila AS fila
    WHERE fila.status = 'enviando'
      AND fila.requisicao_iniciada_em < now() - v_envio_timeout
      AND fila.requisicao_finalizada_em IS NULL
      AND fila.digisac_message_id IS NULL
    ORDER BY fila.requisicao_iniciada_em, fila.created_at
    LIMIT v_restante
    FOR UPDATE SKIP LOCKED
  ),
  atualizadas AS (
    UPDATE public.hub_vendas_recuperacao_fila AS fila
    SET
      status = 'resultado_incerto',
      requisicao_finalizada_em = now(),
      resultado = 'resultado_incerto',
      erro = 'envio_abandonado_apos_post',
      categoria_erro = 'timeout_resultado_incerto',
      updated_at = now()
    FROM candidatas
    WHERE fila.id = candidatas.id
    RETURNING fila.id, fila.lead_id, fila.conexao_destino_id
  )
  SELECT
    atualizadas.id,
    atualizadas.lead_id,
    'enviando'::text,
    'resultado_incerto'::text,
    'movido_resultado_incerto'::text,
    'envio_abandonado_apos_post'::text,
    atualizadas.conexao_destino_id
  FROM atualizadas;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_vendas_recuperar_filas_abandonadas(text, integer, integer, integer, boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hub_vendas_recuperar_filas_abandonadas(text, integer, integer, integer, boolean)
  TO service_role;
