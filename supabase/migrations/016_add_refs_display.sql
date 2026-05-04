-- Add refs_display column to recebimento_itens
-- This field stores all product codes used for this item when grouped (e.g. "2466/71199")
-- Useful when same SKU comes with different codes (ref_meia and ref_inteira)

ALTER TABLE recebimento_itens ADD COLUMN IF NOT EXISTS refs_display TEXT;

COMMENT ON COLUMN recebimento_itens.refs_display IS 
  'Display string with all product codes used for this grouped item, separated by / (e.g. 2466/71199)';
