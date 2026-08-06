CREATE TABLE IF NOT EXISTS public.hub_vendas_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  chave_deduplicacao text NOT NULL,
  contato_id text NOT NULL,
  service_id text,
  status text NOT NULL DEFAULT 'enviado'
    CHECK (status IN ('enviado', 'falha')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_vendas_alertas_dedup
  ON public.hub_vendas_alertas (
    tipo,
    chave_deduplicacao,
    enviado_em DESC
  );

CREATE INDEX IF NOT EXISTS idx_hub_vendas_alertas_enviado_em
  ON public.hub_vendas_alertas (enviado_em DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_vendas_alertas_resumo_unico
  ON public.hub_vendas_alertas (tipo, chave_deduplicacao)
  WHERE tipo = 'resumo_diario'
    AND status = 'enviado';

ALTER TABLE public.hub_vendas_alertas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hub_vendas_alertas FROM anon;
REVOKE ALL ON TABLE public.hub_vendas_alertas FROM authenticated;

COMMENT ON TABLE public.hub_vendas_alertas IS
  'Registra alertas operacionais e resumos diarios enviados pelo Hub/Vendas para deduplicacao e idempotencia.';

COMMENT ON COLUMN public.hub_vendas_alertas.tipo IS
  'Tipo operacional do alerta ou resumo diario.';

COMMENT ON COLUMN public.hub_vendas_alertas.chave_deduplicacao IS
  'Chave usada para deduplicacao. No resumo diario utiliza YYYY-MM-DD no timezone configurado.';

COMMENT ON COLUMN public.hub_vendas_alertas.status IS
  'Resultado do envio: enviado ou falha.';