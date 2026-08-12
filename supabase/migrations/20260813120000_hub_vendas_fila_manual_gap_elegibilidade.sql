-- Hub/Vendas: fecha o "Gap A" — leads presos em 'aguardando_conversao' que ultrapassaram
-- a janela de elegibilidade sem nunca terem recebido recuperação (nunca entraram na fila).
-- Reaproveita o status 'fila_manual', ja permitido pela constraint existente
-- (hub_vendas_leads_status_check). Nao altera constraint, nao altera schema.
--
-- Distinto de 'encerrado' (que representa recuperacao enviada + sem resposta em 24h):
-- 'fila_manual' representa quem nunca chegou a receber recuperacao.
--
-- A checagem NOT EXISTS contra hub_vendas_recuperacao_fila e uma garantia extra: hoje, por
-- construcao (RPCs hub_vendas_preparar_fila_recuperacao/hub_vendas_confirmar_fila_enviada
-- sempre mudam o status do lead junto com a fila), nenhum lead em 'aguardando_conversao'
-- possui fila associada — confirmado via MCP antes desta migration (0 linhas). A checagem
-- fica como rede de seguranca contra qualquer fila pendente/legitima que ainda deva ser
-- processada.

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
