-- Hub/Vendas recuperacao - hotfix: corrige ambiguidade PL/pgSQL na RPC de conversao.
-- Nao altera dados comerciais, automacao, cron, fila real ou envio de mensagens.

DROP FUNCTION IF EXISTS public.hub_vendas_registrar_conversao(uuid, text, timestamptz);

CREATE OR REPLACE FUNCTION public.hub_vendas_registrar_conversao(
  p_lead_id uuid,
  p_loja text,
  p_timestamp_evento timestamptz
)
RETURNS TABLE (
  lead_id uuid,
  atualizado boolean,
  motivo text,
  loja_ja_existia boolean,
  lojas_chamadas text[],
  loja_principal text,
  data_conversao timestamptz,
  chamou_mais_de_uma_loja boolean,
  status text,
  resultado_semantico text,
  quantidade_lojas integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lead public.hub_vendas_leads%ROWTYPE;
  v_lojas text[];
  v_loja_ja_existia boolean;
  v_resultado_semantico text;
BEGIN
  IF p_loja NOT IN ('portao', 'bigorrilho', 'hauer_marechal') THEN
    RAISE EXCEPTION 'hub_vendas_loja_invalida' USING ERRCODE = '22023';
  END IF;

  SELECT lead.*
    INTO v_lead
    FROM public.hub_vendas_leads AS lead
    WHERE lead.id = p_lead_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_lead_id, false, 'lead_nao_encontrado', false, ARRAY[]::text[], NULL::text, NULL::timestamptz, false, NULL::text, 'lead_nao_encontrado', 0;
    RETURN;
  END IF;

  IF p_timestamp_evento < v_lead.data_entrada_hub
     OR p_timestamp_evento >= v_lead.data_entrada_hub + interval '24 hours' THEN
    RETURN QUERY SELECT v_lead.id, false, 'fora_janela_24h', false, v_lead.lojas_chamadas, v_lead.loja_principal, v_lead.data_conversao, v_lead.chamou_mais_de_uma_loja, v_lead.status, 'fora_janela_conversao', cardinality(v_lead.lojas_chamadas);
    RETURN;
  END IF;

  IF v_lead.status NOT IN ('aguardando_conversao', 'convertido_organicamente') THEN
    RETURN QUERY SELECT v_lead.id, false, 'status_nao_elegivel', false, v_lead.lojas_chamadas, v_lead.loja_principal, v_lead.data_conversao, v_lead.chamou_mais_de_uma_loja, v_lead.status, 'status_nao_elegivel', cardinality(v_lead.lojas_chamadas);
    RETURN;
  END IF;

  v_loja_ja_existia := p_loja = ANY (v_lead.lojas_chamadas);

  IF v_loja_ja_existia THEN
    RETURN QUERY SELECT v_lead.id, false, 'loja_ja_registrada', true, v_lead.lojas_chamadas, v_lead.loja_principal, v_lead.data_conversao, v_lead.chamou_mais_de_uma_loja, v_lead.status, 'loja_ja_registrada', cardinality(v_lead.lojas_chamadas);
    RETURN;
  END IF;

  v_lojas := array_append(v_lead.lojas_chamadas, p_loja);
  v_resultado_semantico := CASE
    WHEN v_lead.loja_principal IS NULL THEN 'primeira_conversao'
    ELSE 'loja_adicional'
  END;

  UPDATE public.hub_vendas_leads AS lead
    SET
      status = 'convertido_organicamente',
      loja_principal = COALESCE(v_lead.loja_principal, p_loja),
      lojas_chamadas = v_lojas,
      chamou_mais_de_uma_loja = cardinality(v_lojas) > 1,
      data_conversao = COALESCE(v_lead.data_conversao, p_timestamp_evento),
      updated_at = now()
    WHERE lead.id = v_lead.id
    RETURNING
      lead.id,
      true,
      v_resultado_semantico,
      false,
      lead.lojas_chamadas,
      lead.loja_principal,
      lead.data_conversao,
      lead.chamou_mais_de_uma_loja,
      lead.status,
      v_resultado_semantico,
      cardinality(lead.lojas_chamadas)
    INTO
      lead_id,
      atualizado,
      motivo,
      loja_ja_existia,
      lojas_chamadas,
      loja_principal,
      data_conversao,
      chamou_mais_de_uma_loja,
      status,
      resultado_semantico,
      quantidade_lojas;

  UPDATE public.hub_vendas_recuperacao_fila AS fila
    SET
      status = 'cancelado',
      motivo_cancelamento = 'conversao_organica_reconciliada',
      ultima_reconciliacao_em = now(),
      quantidade_reconciliacoes = fila.quantidade_reconciliacoes + 1,
      updated_at = now()
    WHERE fila.lead_id = v_lead.id
      AND fila.status IN ('agendado', 'reservado', 'enviando', 'resultado_incerto');

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_vendas_registrar_conversao(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_vendas_registrar_conversao(uuid, text, timestamptz)
  TO service_role;
