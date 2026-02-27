-- Table to track OS (ordem de serviço) volumes in recebimentos
CREATE TABLE IF NOT EXISTS recebimento_os (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id UUID NOT NULL REFERENCES recebimentos(id) ON DELETE CASCADE,
  os_numero TEXT NOT NULL,
  volumes_previstos INT NOT NULL DEFAULT 0,
  volumes_recebidos INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recebimento_id, os_numero)
);

CREATE INDEX IF NOT EXISTS idx_recebimento_os_recebimento_id ON recebimento_os(recebimento_id);

COMMENT ON TABLE recebimento_os IS 'Tracking de volumes recebidos por número de OS em cada recebimento';
COMMENT ON COLUMN recebimento_os.os_numero IS 'Número da ordem de serviço (extraído das observações da NF)';
COMMENT ON COLUMN recebimento_os.volumes_previstos IS 'Total de volumes esperados para esta OS (geralmente volumes_total da NF)';
COMMENT ON COLUMN recebimento_os.volumes_recebidos IS 'Total de volumes já conferidos/recebidos';
