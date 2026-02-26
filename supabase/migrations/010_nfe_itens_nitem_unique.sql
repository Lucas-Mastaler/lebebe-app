-- =========================================================
-- MIGRATION 010: Add n_item, corredor/nivel to nfe_itens + unique constraints
-- =========================================================

-- 1) Add n_item column (nItem from XML det)
ALTER TABLE nfe_itens ADD COLUMN IF NOT EXISTS n_item INT;

-- 2) Add corredor_sugerido and nivel_sugerido to nfe_itens (from matic_sku cross-ref)
ALTER TABLE nfe_itens ADD COLUMN IF NOT EXISTS corredor_sugerido TEXT;
ALTER TABLE nfe_itens ADD COLUMN IF NOT EXISTS nivel_sugerido TEXT;

-- 3) Unique constraint: nfe_itens (nfe_id, n_item) — one line per det item
CREATE UNIQUE INDEX IF NOT EXISTS idx_nfe_itens_nfe_nitem
  ON nfe_itens(nfe_id, n_item);

-- 4) Unique constraint: nfe_assistencias (nfe_id, os_oc_numero) — dedupe OS/OC
CREATE UNIQUE INDEX IF NOT EXISTS idx_nfe_assistencias_nfe_os
  ON nfe_assistencias(nfe_id, os_oc_numero);
