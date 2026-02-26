-- =========================================================
-- MIGRATION 009: Recebimento Matic
-- =========================================================

-- 1) matic_sku (espelho PROCV-LOJA)
CREATE TABLE IF NOT EXISTS matic_sku (
  codigo_produto TEXT PRIMARY KEY,
  descricao TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  volumes_por_item INT NOT NULL DEFAULT 1,
  corredor_sugerido TEXT,
  nivel_sugerido TEXT,
  ref_meia TEXT,
  ref_inteira TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) nfe
CREATE TABLE IF NOT EXISTS nfe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nf TEXT UNIQUE NOT NULL,
  data_emissao DATE NOT NULL,
  peso_total NUMERIC,
  volumes_total INT,
  is_os BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) nfe_itens
CREATE TABLE IF NOT EXISTS nfe_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_id UUID NOT NULL REFERENCES nfe(id) ON DELETE CASCADE,
  codigo_produto TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  quantidade INT NOT NULL DEFAULT 0,
  volumes_por_item INT NOT NULL DEFAULT 1,
  volumes_previstos_total INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','parcial','concluido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfe_itens_nfe_id ON nfe_itens(nfe_id);
CREATE INDEX IF NOT EXISTS idx_nfe_itens_codigo ON nfe_itens(codigo_produto);

-- 4) nfe_assistencias
CREATE TABLE IF NOT EXISTS nfe_assistencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_id UUID NOT NULL REFERENCES nfe(id) ON DELETE CASCADE,
  os_oc_numero TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfe_assistencias_nfe_id ON nfe_assistencias(nfe_id);

-- 5) recebimentos
CREATE TABLE IF NOT EXISTS recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_fim TIMESTAMPTZ,
  motorista TEXT,
  quantos_chapas INT,
  obs TEXT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) recebimento_nfes (junction)
CREATE TABLE IF NOT EXISTS recebimento_nfes (
  recebimento_id UUID NOT NULL REFERENCES recebimentos(id) ON DELETE CASCADE,
  nfe_id UUID NOT NULL REFERENCES nfe(id) ON DELETE CASCADE,
  PRIMARY KEY (recebimento_id, nfe_id)
);

-- 7) recebimento_itens
CREATE TABLE IF NOT EXISTS recebimento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id UUID NOT NULL REFERENCES recebimentos(id) ON DELETE CASCADE,
  nfe_item_id UUID NOT NULL REFERENCES nfe_itens(id) ON DELETE CASCADE,
  volumes_previstos_total INT NOT NULL DEFAULT 0,
  volumes_recebidos_total INT NOT NULL DEFAULT 0,
  corredor_final TEXT,
  nivel_final TEXT,
  divergencia_tipo TEXT CHECK (divergencia_tipo IN ('faltou','sobrou','avaria') OR divergencia_tipo IS NULL),
  divergencia_obs TEXT,
  avaria_foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recebimento_itens_rec ON recebimento_itens(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_recebimento_itens_nfe_item ON recebimento_itens(nfe_item_id);

-- 8) recebimento_item_volumes
CREATE TABLE IF NOT EXISTS recebimento_item_volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_item_id UUID NOT NULL REFERENCES recebimento_itens(id) ON DELETE CASCADE,
  volume_numero INT NOT NULL,
  qtd_prevista INT NOT NULL DEFAULT 0,
  qtd_recebida INT NOT NULL DEFAULT 0,
  UNIQUE(recebimento_item_id, volume_numero)
);

CREATE INDEX IF NOT EXISTS idx_rec_item_vol ON recebimento_item_volumes(recebimento_item_id);

-- =========================================================
-- RLS POLICIES — whitelist: posvenda@lebebe.com.br, lucas@lebebe.com.br
-- =========================================================

-- Helper function to check if current user is in the Matic whitelist
CREATE OR REPLACE FUNCTION is_matic_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT auth.jwt() ->> 'email' IN (
      'posvenda@lebebe.com.br',
      'lucas@lebebe.com.br'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Enable RLS on all tables
ALTER TABLE matic_sku ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfe ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfe_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfe_assistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE recebimento_nfes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recebimento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE recebimento_item_volumes ENABLE ROW LEVEL SECURITY;

-- matic_sku: read-only for matic users
CREATE POLICY "matic_sku_select" ON matic_sku FOR SELECT USING (is_matic_user());
CREATE POLICY "matic_sku_insert" ON matic_sku FOR INSERT WITH CHECK (is_matic_user());
CREATE POLICY "matic_sku_update" ON matic_sku FOR UPDATE USING (is_matic_user());

-- nfe: full access for matic users
CREATE POLICY "nfe_select" ON nfe FOR SELECT USING (is_matic_user());
CREATE POLICY "nfe_insert" ON nfe FOR INSERT WITH CHECK (is_matic_user());
CREATE POLICY "nfe_update" ON nfe FOR UPDATE USING (is_matic_user());

-- nfe_itens
CREATE POLICY "nfe_itens_select" ON nfe_itens FOR SELECT USING (is_matic_user());
CREATE POLICY "nfe_itens_insert" ON nfe_itens FOR INSERT WITH CHECK (is_matic_user());
CREATE POLICY "nfe_itens_update" ON nfe_itens FOR UPDATE USING (is_matic_user());

-- nfe_assistencias
CREATE POLICY "nfe_assistencias_select" ON nfe_assistencias FOR SELECT USING (is_matic_user());
CREATE POLICY "nfe_assistencias_insert" ON nfe_assistencias FOR INSERT WITH CHECK (is_matic_user());

-- recebimentos
CREATE POLICY "recebimentos_select" ON recebimentos FOR SELECT USING (is_matic_user());
CREATE POLICY "recebimentos_insert" ON recebimentos FOR INSERT WITH CHECK (is_matic_user());
CREATE POLICY "recebimentos_update" ON recebimentos FOR UPDATE USING (is_matic_user());

-- recebimento_nfes
CREATE POLICY "recebimento_nfes_select" ON recebimento_nfes FOR SELECT USING (is_matic_user());
CREATE POLICY "recebimento_nfes_insert" ON recebimento_nfes FOR INSERT WITH CHECK (is_matic_user());

-- recebimento_itens
CREATE POLICY "recebimento_itens_select" ON recebimento_itens FOR SELECT USING (is_matic_user());
CREATE POLICY "recebimento_itens_insert" ON recebimento_itens FOR INSERT WITH CHECK (is_matic_user());
CREATE POLICY "recebimento_itens_update" ON recebimento_itens FOR UPDATE USING (is_matic_user());

-- recebimento_item_volumes
CREATE POLICY "recebimento_item_volumes_select" ON recebimento_item_volumes FOR SELECT USING (is_matic_user());
CREATE POLICY "recebimento_item_volumes_insert" ON recebimento_item_volumes FOR INSERT WITH CHECK (is_matic_user());
CREATE POLICY "recebimento_item_volumes_update" ON recebimento_item_volumes FOR UPDATE USING (is_matic_user());
