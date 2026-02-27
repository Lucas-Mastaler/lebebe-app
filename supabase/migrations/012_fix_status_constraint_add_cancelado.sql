-- Fix recebimentos status constraint to allow 'cancelado'
ALTER TABLE recebimentos
DROP CONSTRAINT IF EXISTS recebimentos_status_check;

ALTER TABLE recebimentos
ADD CONSTRAINT recebimentos_status_check CHECK (status IN ('aberto', 'fechado', 'cancelado'));

-- Add obs field to nfe table to store infCpl (where OS numbers come from)
ALTER TABLE nfe
ADD COLUMN IF NOT EXISTS obs TEXT;

COMMENT ON COLUMN nfe.obs IS 'Observações da NF (infCpl) - contém números de OS/OC';
