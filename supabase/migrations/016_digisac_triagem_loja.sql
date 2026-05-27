CREATE TABLE IF NOT EXISTS digisac_triagem_loja (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digisac_message_id    TEXT NOT NULL,
  digisac_contact_id    TEXT NOT NULL,
  digisac_ticket_id     TEXT,
  digisac_service_id    TEXT NOT NULL,
  texto_normalizado     TEXT,
  loja_detectada        TEXT,
  departamento_destino  TEXT,
  status                TEXT NOT NULL,
  erro                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT digisac_triagem_loja_message_unique
    UNIQUE (digisac_message_id),

  CONSTRAINT digisac_triagem_loja_status_check
    CHECK (
      status IN (
        'candidata',
        'roteado',
        'erro_transferencia',
        'ignorado_ja_processado',
        'ignorado_departamento_final'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_digisac_triagem_loja_ticket
  ON digisac_triagem_loja (digisac_ticket_id);

CREATE INDEX IF NOT EXISTS idx_digisac_triagem_loja_contact
  ON digisac_triagem_loja (digisac_contact_id);

CREATE INDEX IF NOT EXISTS idx_digisac_triagem_loja_status
  ON digisac_triagem_loja (status);

CREATE OR REPLACE FUNCTION atualizar_updated_at_digisac_triagem_loja()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_updated_at_digisac_triagem_loja
  ON digisac_triagem_loja;

CREATE TRIGGER trg_atualizar_updated_at_digisac_triagem_loja
  BEFORE UPDATE ON digisac_triagem_loja
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_updated_at_digisac_triagem_loja();

ALTER TABLE digisac_triagem_loja ENABLE ROW LEVEL SECURITY;
