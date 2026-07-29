-- Hub/Vendas recuperacao - Fase 3: observabilidade de conversao e fila idempotente.
-- Nao cria envio, contato, transferencia, cron de VPS, tela ou API de metricas.

CREATE INDEX IF NOT EXISTS idx_hub_vendas_fila_conexao_programado_capacidade
  ON public.hub_vendas_recuperacao_fila (conexao_destino_id, programado_para)
  WHERE status IN ('agendado', 'reservado', 'enviando', 'enviado', 'resultado_incerto');

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

  SELECT *
    INTO v_lead
    FROM public.hub_vendas_leads
    WHERE id = p_lead_id
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
      v_resultado_semantico,
      false,
      hub_vendas_leads.lojas_chamadas,
      hub_vendas_leads.loja_principal,
      hub_vendas_leads.data_conversao,
      hub_vendas_leads.chamou_mais_de_uma_loja,
      hub_vendas_leads.status,
      v_resultado_semantico,
      cardinality(hub_vendas_leads.lojas_chamadas)
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

  UPDATE public.hub_vendas_recuperacao_fila
    SET
      status = 'cancelado',
      motivo_cancelamento = 'conversao_organica_reconciliada',
      ultima_reconciliacao_em = now(),
      quantidade_reconciliacoes = quantidade_reconciliacoes + 1,
      updated_at = now()
    WHERE lead_id = v_lead.id
      AND status IN ('agendado', 'reservado', 'enviando', 'resultado_incerto');

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_vendas_registrar_conversao(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_vendas_registrar_conversao(uuid, text, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.hub_vendas_preparar_fila_recuperacao(
  p_lead_id uuid,
  p_conexoes_elegiveis text[],
  p_programados_por_conexao jsonb,
  p_nomes_por_conexao jsonb,
  p_limite_diario integer,
  p_timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS TABLE (
  lead_id uuid,
  fila_id uuid,
  criado boolean,
  motivo text,
  conexao_destino_id text,
  programado_para timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lead public.hub_vendas_leads%ROWTYPE;
  v_conexoes_restantes text[];
  v_conexao text;
  v_programado timestamptz;
  v_inicio_local timestamp;
  v_inicio_utc timestamptz;
  v_fim_utc timestamptz;
  v_total integer;
  v_tentativas integer := 0;
  v_fila_id uuid;
BEGIN
  IF p_limite_diario IS NULL OR p_limite_diario < 1 THEN
    RETURN QUERY SELECT p_lead_id, NULL::uuid, false, 'limite_diario_invalido', NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF p_conexoes_elegiveis IS NULL OR cardinality(p_conexoes_elegiveis) = 0 THEN
    RETURN QUERY SELECT p_lead_id, NULL::uuid, false, 'sem_conexao_elegivel', NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT *
    INTO v_lead
    FROM public.hub_vendas_leads
    WHERE id = p_lead_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_lead_id, NULL::uuid, false, 'lead_nao_encontrado', NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_lead.status <> 'aguardando_conversao' THEN
    RETURN QUERY SELECT v_lead.id, NULL::uuid, false, 'status_nao_elegivel', NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.hub_vendas_recuperacao_fila fila
      WHERE fila.lead_id = v_lead.id
  ) THEN
    UPDATE public.hub_vendas_recuperacao_fila fila
      SET
        ultima_reconciliacao_em = now(),
        quantidade_reconciliacoes = fila.quantidade_reconciliacoes + 1,
        updated_at = now()
      WHERE fila.lead_id = v_lead.id;

    RETURN QUERY SELECT v_lead.id, NULL::uuid, false, 'fila_ja_existente', NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  v_conexoes_restantes := p_conexoes_elegiveis;

  WHILE cardinality(v_conexoes_restantes) > 0 LOOP
    v_tentativas := v_tentativas + 1;
    IF v_tentativas > 5 THEN
      EXIT;
    END IF;

    v_conexao := public.selecionar_proxima_conexao_hub_vendas(v_conexoes_restantes);
    IF v_conexao IS NULL THEN
      EXIT;
    END IF;

    v_programado := NULLIF(p_programados_por_conexao->>v_conexao, '')::timestamptz;
    IF v_programado IS NULL THEN
      v_conexoes_restantes := array_remove(v_conexoes_restantes, v_conexao);
      CONTINUE;
    END IF;

    v_inicio_local := date_trunc('day', v_programado AT TIME ZONE p_timezone);
    v_inicio_utc := v_inicio_local AT TIME ZONE p_timezone;
    v_fim_utc := (v_inicio_local + interval '1 day') AT TIME ZONE p_timezone;

    SELECT count(*)
      INTO v_total
      FROM public.hub_vendas_recuperacao_fila fila
      WHERE fila.conexao_destino_id = v_conexao
        AND fila.status IN ('agendado', 'reservado', 'enviando', 'enviado', 'resultado_incerto')
        AND fila.programado_para >= v_inicio_utc
        AND fila.programado_para < v_fim_utc;

    IF v_total >= p_limite_diario THEN
      v_conexoes_restantes := array_remove(v_conexoes_restantes, v_conexao);
      CONTINUE;
    END IF;

    INSERT INTO public.hub_vendas_recuperacao_fila (
      lead_id,
      conexao_destino_id,
      conexao_destino_nome,
      status,
      programado_para,
      ultima_reconciliacao_em,
      quantidade_reconciliacoes
    )
    VALUES (
      v_lead.id,
      v_conexao,
      p_nomes_por_conexao->>v_conexao,
      'agendado',
      v_programado,
      now(),
      1
    )
    RETURNING id
    INTO v_fila_id;

    UPDATE public.hub_vendas_leads
      SET
        status = 'encaminhado_recuperacao',
        conexao_recuperacao_id = v_conexao,
        updated_at = now()
      WHERE id = v_lead.id;

    RETURN QUERY SELECT v_lead.id, v_fila_id, true, 'fila_criada', v_conexao, v_programado;
    RETURN;
  END LOOP;

  RETURN QUERY SELECT v_lead.id, NULL::uuid, false, 'sem_capacidade_diaria', NULL::text, NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_vendas_preparar_fila_recuperacao(uuid, text[], jsonb, jsonb, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_vendas_preparar_fila_recuperacao(uuid, text[], jsonb, jsonb, integer, text)
  TO service_role;
