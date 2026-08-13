-- Hub/Vendas: timestamps confiaveis de transicao e protocolo amigavel do Digisac.
-- O updated_at e usado somente no backfill historico inicial; novas transicoes
-- gravam seus timestamps dedicados.

ALTER TABLE public.hub_vendas_leads
  ADD COLUMN data_encerrado timestamptz NULL,
  ADD COLUMN data_fila_manual timestamptz NULL;

ALTER TABLE public.hub_vendas_recuperacao_fila
  ADD COLUMN digisac_protocolo text NULL;

UPDATE public.hub_vendas_leads
SET data_encerrado = updated_at
WHERE status = 'encerrado'
  AND data_encerrado IS NULL;

UPDATE public.hub_vendas_leads
SET data_fila_manual = updated_at
WHERE status = 'fila_manual'
  AND data_fila_manual IS NULL;

CREATE INDEX idx_hub_vendas_leads_data_encerrado
  ON public.hub_vendas_leads (data_encerrado)
  WHERE data_encerrado IS NOT NULL;

CREATE INDEX idx_hub_vendas_leads_data_fila_manual
  ON public.hub_vendas_leads (data_fila_manual)
  WHERE data_fila_manual IS NOT NULL;

CREATE INDEX idx_hub_vendas_leads_recuperacao_enviada
  ON public.hub_vendas_leads (data_recuperacao_enviada)
  WHERE data_recuperacao_enviada IS NOT NULL;

CREATE INDEX idx_hub_vendas_leads_recuperacao_respondida
  ON public.hub_vendas_leads (data_recuperacao_respondida)
  WHERE data_recuperacao_respondida IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hub_vendas_fechar_aguardando_expirados(
  p_limite_elegibilidade timestamptz
)
RETURNS TABLE (lead_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.hub_vendas_leads AS lead
    SET
      status = 'fila_manual',
      data_fila_manual = now(),
      updated_at = now()
    WHERE lead.status = 'aguardando_conversao'
      AND lead.data_entrada_hub <= p_limite_elegibilidade
      AND NOT EXISTS (
        SELECT 1
        FROM public.hub_vendas_recuperacao_fila AS fila
        WHERE fila.lead_id = lead.id
      )
    RETURNING lead.id;
$$;

REVOKE ALL ON FUNCTION public.hub_vendas_fechar_aguardando_expirados(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_vendas_fechar_aguardando_expirados(timestamptz)
  TO service_role;
