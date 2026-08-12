-- Hub/Vendas Parte 2B: conversao pos-recuperacao.
-- Cria RPC especifica para registrar de forma atomica e idempotente a conversao
-- de um lead que respondeu dentro de 24h apos o envio da mensagem de recuperacao.
-- Reaproveita o status 'recuperado', ja permitido pela constraint existente
-- (hub_vendas_leads_status_check). Nao altera constraint, nao altera a RPC de
-- conversao organica, nao altera schema.

CREATE OR REPLACE FUNCTION public.hub_vendas_registrar_conversao_pos_recuperacao(
  p_lead_id uuid,
  p_timestamp_evento timestamptz
)
RETURNS TABLE (
  lead_id uuid,
  atualizado boolean,
  motivo text,
  status text,
  data_recuperacao_respondida timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lead public.hub_vendas_leads%ROWTYPE;
BEGIN
  SELECT lead.*
    INTO v_lead
    FROM public.hub_vendas_leads AS lead
    WHERE lead.id = p_lead_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_lead_id, false, 'lead_nao_encontrado', NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- Idempotencia: se o lead ja nao estiver mais em recuperacao_enviada (ja foi
  -- marcado 'recuperado' por um evento anterior, ja foi 'encerrado' pelo cron,
  -- ou qualquer outro status), a operacao e um no-op seguro.
  IF v_lead.status <> 'recuperacao_enviada' THEN
    RETURN QUERY SELECT v_lead.id, false, 'status_nao_elegivel', v_lead.status, v_lead.data_recuperacao_respondida;
    RETURN;
  END IF;

  IF v_lead.data_recuperacao_enviada IS NULL THEN
    RETURN QUERY SELECT v_lead.id, false, 'data_recuperacao_enviada_ausente', v_lead.status, v_lead.data_recuperacao_respondida;
    RETURN;
  END IF;

  -- Janela de 24h independente da janela organica: [data_recuperacao_enviada, +24h).
  IF p_timestamp_evento < v_lead.data_recuperacao_enviada
     OR p_timestamp_evento >= v_lead.data_recuperacao_enviada + interval '24 hours' THEN
    RETURN QUERY SELECT v_lead.id, false, 'fora_janela_24h_pos_recuperacao', v_lead.status, v_lead.data_recuperacao_respondida;
    RETURN;
  END IF;

  UPDATE public.hub_vendas_leads AS lead
    SET
      status = 'recuperado',
      data_recuperacao_respondida = p_timestamp_evento,
      updated_at = now()
    WHERE lead.id = v_lead.id
    RETURNING
      lead.id,
      true,
      'recuperado',
      lead.status,
      lead.data_recuperacao_respondida
    INTO
      lead_id,
      atualizado,
      motivo,
      status,
      data_recuperacao_respondida;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_vendas_registrar_conversao_pos_recuperacao(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_vendas_registrar_conversao_pos_recuperacao(uuid, timestamptz)
  TO service_role;
