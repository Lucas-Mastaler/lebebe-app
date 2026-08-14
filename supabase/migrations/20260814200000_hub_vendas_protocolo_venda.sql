-- Hub/Vendas: protocolo Digisac da conversa original (Hub de Vendas), separado
-- do protocolo da recuperacao ja existente em hub_vendas_recuperacao_fila.
-- Leads antigos ficam com valor NULL (exibidos como "-" na tela).

ALTER TABLE public.hub_vendas_leads
  ADD COLUMN digisac_protocolo_hub text NULL;
