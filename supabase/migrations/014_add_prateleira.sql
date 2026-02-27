-- Add prateleira (shelf number) to recebimento_itens and matic_sku
ALTER TABLE recebimento_itens
ADD COLUMN IF NOT EXISTS prateleira_final TEXT;

ALTER TABLE matic_sku
ADD COLUMN IF NOT EXISTS prateleira_sugerida TEXT;

COMMENT ON COLUMN recebimento_itens.prateleira_final IS 'Número da prateleira onde o item foi armazenado (ex: P1, P2)';
COMMENT ON COLUMN matic_sku.prateleira_sugerida IS 'Número da prateleira sugerido para este SKU (aprendido de recebimentos anteriores)';
