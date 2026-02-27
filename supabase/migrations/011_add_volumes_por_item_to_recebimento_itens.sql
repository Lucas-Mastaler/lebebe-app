-- Add volumes_por_item column to recebimento_itens
ALTER TABLE recebimento_itens
ADD COLUMN IF NOT EXISTS volumes_por_item INT NOT NULL DEFAULT 1;

-- Add comment
COMMENT ON COLUMN recebimento_itens.volumes_por_item IS 'Quantos volumes cada unidade do produto tem (ajustável durante conferência)';
