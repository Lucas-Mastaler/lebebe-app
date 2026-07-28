-- Hub/Vendas recuperacao - Fase 2: RPC atomica para conversao organica.
-- Nao cria webhook publico, cron, tela, fila runtime ou envio de mensagens.

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
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lead public.hub_vendas_leads%ROWTYPE;
  v_lojas text[];
  v_loja_ja_existia boolean;
BEGIN
  IF p_loja NOT IN ('portao', 'bigorrilho', 'hauer_marechal') THEN
    RAISE EXCEPTION 'hub_vendas_loja_invalida' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_lead
    FROM public.hub_vendas_leads
    WHERE id = p_lead_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_lead_id, false, 'lead_nao_encontrado', false, ARRAY[]::text[], NULL::text, NULL::timestamptz, false, NULL::text;
    RETURN;
  END IF;

  IF p_timestamp_evento < v_lead.data_entrada_hub
     OR p_timestamp_evento >= v_lead.data_entrada_hub + interval '24 hours' THEN
    RETURN QUERY SELECT v_lead.id, false, 'fora_janela_24h', false, v_lead.lojas_chamadas, v_lead.loja_principal, v_lead.data_conversao, v_lead.chamou_mais_de_uma_loja, v_lead.status;
    RETURN;
  END IF;

  IF v_lead.status NOT IN ('aguardando_conversao', 'convertido_organicamente') THEN
    RETURN QUERY SELECT v_lead.id, false, 'status_nao_elegivel', false, v_lead.lojas_chamadas, v_lead.loja_principal, v_lead.data_conversao, v_lead.chamou_mais_de_uma_loja, v_lead.status;
    RETURN;
  END IF;

  v_loja_ja_existia := p_loja = ANY (v_lead.lojas_chamadas);
  v_lojas := CASE
    WHEN v_loja_ja_existia THEN v_lead.lojas_chamadas
    ELSE array_append(v_lead.lojas_chamadas, p_loja)
  END;

  UPDATE public.hub_vendas_leads
    SET
      status = 'convertido_organicamente',
      loja_principal = COALESCE(v_lead.loja_principal, p_loja),
      lojas_chamadas = v_lojas,
      chamou_mais_de_uma_loja = cardinality(v_lojas) > 1,
      data_conversao = COALESCE(v_lead.data_conversao, p_timestamp_evento),
      updated_at = now()
    WHERE id = v_lead.id
    RETURNING
      hub_vendas_leads.id,
      true,
      CASE WHEN v_loja_ja_existia THEN 'loja_ja_registrada' ELSE 'conversao_registrada' END,
      v_loja_ja_existia,
      hub_vendas_leads.lojas_chamadas,
      hub_vendas_leads.loja_principal,
      hub_vendas_leads.data_conversao,
      hub_vendas_leads.chamou_mais_de_uma_loja,
      hub_vendas_leads.status
    INTO
      lead_id,
      atualizado,
      motivo,
      loja_ja_existia,
      lojas_chamadas,
      loja_principal,
      data_conversao,
      chamou_mais_de_uma_loja,
      status;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_vendas_registrar_conversao(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_vendas_registrar_conversao(uuid, text, timestamptz)
  TO service_role;
