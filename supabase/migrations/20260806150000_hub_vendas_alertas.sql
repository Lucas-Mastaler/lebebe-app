-- Tabela para deduplicacao de alertas operacionais e idempotencia do resumo diario do Hub/Vendas.
-- Permite:
--   1) Deduplicar alertas por tipo + chave dentro de uma janela temporal.
--   2) Garantir que o resumo diario seja enviado no maximo uma vez por data local.
-- Nao altera tabelas existentes.

CREATE TABLE IF NOT EXISTS hub_vendas_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  chave_deduplicacao text NOT NULL,
  contato_id text NOT NULL,
  service_id text,
  status text NOT NULL DEFAULT 'enviado',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indice para consulta rapida de deduplicacao (tipo + chave + envio mais recente primeiro).
CREATE INDEX IF NOT EXISTS idx_hub_vendas_alertas_dedup
  ON hub_vendas_alertas (tipo, chave_deduplicacao, enviado_em DESC);

-- Indice unico parcial para resumo diario: no maximo um resumo por data local.
-- A chave_deduplicacao para resumo sera a data local no formato YYYY-MM-DD.
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_vendas_alertas_resumo_unico
  ON hub_vendas_alertas (tipo, chave_deduplicacao)
  WHERE tipo = 'resumo_diario';

-- Comentario para documentacao.
COMMENT ON TABLE hub_vendas_alertas IS 'Registra alertas operacionais e resumos diarios enviados pelo Hub/Vendas para deduplicacao e idempotencia.';
COMMENT ON COLUMN hub_vendas_alertas.tipo IS 'Tipo do alerta: conexao_pausada, erro_envio, resultado_incerto, analise_manual, reserva_liberada, envio_travado, retry_agendado, falha_recorrente, cron_falhou, resumo_diario.';
COMMENT ON COLUMN hub_vendas_alertas.chave_deduplicacao IS 'Chave composta para deduplicacao. Para alertas: tipo+fila_id ou tipo+conexao_id. Para resumo: data local YYYY-MM-DD.';
COMMENT ON COLUMN hub_vendas_alertas.status IS 'enviado, deduplicado, falha.';
